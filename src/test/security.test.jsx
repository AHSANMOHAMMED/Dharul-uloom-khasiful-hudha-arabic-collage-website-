import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { passwordProblem } from '../lib/passwordPolicy'

let authState = {}
vi.mock('../context/AuthContext', () => ({ useAuth: () => authState }))

const verifySignInCode = vi.fn()
const startTotpEnrollment = vi.fn()
const verifyTotp = vi.fn()
vi.mock('../lib/mfaApi', () => ({
  verifySignInCode: (...a) => verifySignInCode(...a),
  startTotpEnrollment: (...a) => startTotpEnrollment(...a),
  verifyTotp: (...a) => verifyTotp(...a),
}))
vi.mock('../lib/supabaseClient', () => ({ supabase: null, isSupabaseConfigured: false, subscribeTableWithFallback: vi.fn(() => () => {}) }))

let featureFlagsState = { features: {}, loading: false, enabled: () => true, refreshFeatures: vi.fn() }
vi.mock('../context/FeatureFlagsContext', () => ({ useFeatures: () => featureFlagsState }))

const listChatConversations = vi.fn(async () => [])
const searchChatContacts = vi.fn(async () => [])
vi.mock('../lib/chatApi', () => ({
  listChatConversations: (...a) => listChatConversations(...a),
  searchChatContacts: (...a) => searchChatContacts(...a),
  listChatMessages: vi.fn(async () => []),
  listOlderChatMessages: vi.fn(async () => []),
  openChatConversation: vi.fn(async () => 'c1'),
  sendChatMessage: vi.fn(async () => 'm1'),
  markChatRead: vi.fn(async () => 0),
  markChatDelivered: vi.fn(async () => 0),
  touchMyPresence: vi.fn(async () => {}),
  subscribeOrgPresence: vi.fn(() => () => {}),
  uploadChatAttachment: vi.fn(async () => ({ url: 'u1', name: 'f', type: 'image/png', size: 1 })),
  getChatAttachmentUrl: vi.fn(async () => null),
  subscribeToChat: vi.fn(() => () => {}),
}))

const { default: MfaGate } = await import('../components/security/MfaGate')
const { default: MfaChallenge } = await import('../components/security/MfaChallenge')
const { default: Messages } = await import('../pages/Messages')
const { default: UserDashboard } = await import('../pages/UserDashboard')

const base = () => ({
  mfaChallengeNeeded: false,
  mfaSetupNeeded: false,
  refreshUser: vi.fn(async () => {}),
  logout: vi.fn(async () => {}),
})

beforeEach(() => {
  authState = base()
  featureFlagsState = { features: {}, loading: false, enabled: () => true, refreshFeatures: vi.fn() }
  verifySignInCode.mockReset()
  startTotpEnrollment.mockReset()
  verifyTotp.mockReset()
  listChatConversations.mockClear()
  searchChatContacts.mockClear()
})

describe('password policy', () => {
  it('requires 10+ characters with letters and digits', () => {
    expect(passwordProblem('short1')).toMatch(/10 characters/)
    expect(passwordProblem('onlyletterslong')).toMatch(/letters and numbers/)
    expect(passwordProblem('1234567890')).toMatch(/letters and numbers/)
    expect(passwordProblem('kashif2026hudha')).toBe('')
  })
})

describe('MfaGate', () => {
  it('renders the workspace when no 2FA step is owed', () => {
    render(<MemoryRouter><MfaGate><p>secret ledger</p></MfaGate></MemoryRouter>)
    expect(screen.getByText('secret ledger')).toBeInTheDocument()
  })

  it('hides the workspace behind the code step for a password-only session', () => {
    authState = { ...base(), mfaChallengeNeeded: true }
    render(<MemoryRouter><MfaGate><p>secret ledger</p></MfaGate></MemoryRouter>)
    expect(screen.queryByText('secret ledger')).toBeNull()
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
  })

  it('requires enrolment when the org mandates 2FA', async () => {
    authState = { ...base(), mfaSetupNeeded: true }
    startTotpEnrollment.mockResolvedValue({ id: 'f1', qrCode: 'data:image/svg+xml;base64,AA==', secret: 'ABC123', uri: 'otpauth://' })
    render(<MemoryRouter><MfaGate><p>secret ledger</p></MfaGate></MemoryRouter>)
    expect(screen.queryByText('secret ledger')).toBeNull()
    expect(await screen.findByAltText(/QR code/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: '12 34 56' } })
    verifyTotp.mockResolvedValue({})
    fireEvent.click(screen.getByRole('button', { name: /turn on two-step/i }))
    await waitFor(() => expect(verifyTotp).toHaveBeenCalledWith('f1', '123456'))
    expect(authState.refreshUser).toHaveBeenCalled()
  })
})

describe('MfaChallenge', () => {
  it('verifies the code then refreshes the session', async () => {
    const onVerified = vi.fn()
    verifySignInCode.mockResolvedValue({})
    render(<MemoryRouter><MfaChallenge onVerified={onVerified} /></MemoryRouter>)
    const input = screen.getByLabelText(/verification code/i)
    fireEvent.change(input, { target: { value: 'ab1234567' } })
    expect(input).toHaveValue('123456')
    fireEvent.click(screen.getByRole('button', { name: /^verify$/i }))
    await waitFor(() => expect(onVerified).toHaveBeenCalled())
    expect(verifySignInCode).toHaveBeenCalledWith('123456')
    expect(authState.refreshUser).toHaveBeenCalled()
  })

  it('shows an error and clears the field on a wrong code', async () => {
    verifySignInCode.mockRejectedValue(new Error('Invalid TOTP code'))
    render(<MemoryRouter><MfaChallenge /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: /^verify$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect or expired/i)
    expect(screen.getByLabelText(/verification code/i)).toHaveValue('')
  })
})

describe('Messages RBAC & gating', () => {
  it('blocks unapproved users without calling chat RPCs', () => {
    authState = { ...base(), isAuthenticated: true, loading: false, isApproved: false, user: { id: 'u1', accountType: 'student' } }
    render(<MemoryRouter><Messages /></MemoryRouter>)
    expect(screen.getByText(/Account pending approval/i)).toBeInTheDocument()
    expect(listChatConversations).not.toHaveBeenCalled()
    expect(searchChatContacts).not.toHaveBeenCalled()
  })

  it('blocks guest visitors without calling chat RPCs', () => {
    authState = { ...base(), isAuthenticated: true, loading: false, isApproved: true, user: { id: 'u2', accountType: 'guest' } }
    render(<MemoryRouter><Messages /></MemoryRouter>)
    expect(screen.getByText(/Messaging is for campus members/i)).toBeInTheDocument()
    expect(listChatConversations).not.toHaveBeenCalled()
  })

  it('blocks when messaging feature flag is disabled', () => {
    featureFlagsState = { ...featureFlagsState, enabled: (k) => k !== 'messaging' }
    authState = { ...base(), isAuthenticated: true, loading: false, isApproved: true, isStudent: true, user: { id: 'u3', accountType: 'student' } }
    render(<MemoryRouter><Messages /></MemoryRouter>)
    expect(screen.getByText(/Messaging is currently disabled/i)).toBeInTheDocument()
    expect(listChatConversations).not.toHaveBeenCalled()
  })

  it('shows student-scoped search placeholder for approved students', async () => {
    authState = { ...base(), isAuthenticated: true, loading: false, isApproved: true, isStudent: true, user: { id: 'u4', accountType: 'student' } }
    render(<MemoryRouter><Messages /></MemoryRouter>)
    expect(await screen.findByPlaceholderText(/Find admin, tutor, or staff/i)).toBeInTheDocument()
    await waitFor(() => expect(listChatConversations).toHaveBeenCalled())
  })
})

describe('UserDashboard multi-hat feature gating', () => {
  it('blocks multi-hat staff portal when staff_portal feature is disabled', () => {
    featureFlagsState = { ...featureFlagsState, enabled: (k) => k !== 'staff_portal' }
    authState = {
      ...base(),
      isAuthenticated: true,
      loading: false,
      isApproved: true,
      isTutor: true,
      isTreasurer: true,
      hasRole: (r) => r === 'treasurer',
      user: { id: 't1', accountType: 'tutor', staffRoles: ['treasurer'] },
    }
    render(<MemoryRouter><UserDashboard /></MemoryRouter>)
    expect(screen.getByText(/This portal is currently disabled/i)).toBeInTheDocument()
  })
})
