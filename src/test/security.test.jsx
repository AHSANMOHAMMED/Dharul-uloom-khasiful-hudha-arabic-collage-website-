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
vi.mock('../lib/supabaseClient', () => ({ supabase: null, isSupabaseConfigured: false }))

const { default: MfaGate } = await import('../components/security/MfaGate')
const { default: MfaChallenge } = await import('../components/security/MfaChallenge')

const base = () => ({
  mfaChallengeNeeded: false,
  mfaSetupNeeded: false,
  refreshUser: vi.fn(async () => {}),
  logout: vi.fn(async () => {}),
})

beforeEach(() => {
  authState = base()
  verifySignInCode.mockReset()
  startTotpEnrollment.mockReset()
  verifyTotp.mockReset()
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
