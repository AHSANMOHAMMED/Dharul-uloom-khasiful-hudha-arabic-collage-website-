import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}))

vi.mock('../context/FeatureFlagsContext', () => ({
  useFeatures: () => ({ enabled: () => true, loading: false }),
}))

vi.mock('../lib/admissionsApi', () => ({
  DEFAULT_AGE_LIMITS: { minAge: 5, maxAge: 25 },
  ageFromDob: (dob) => (dob ? { years: 14, months: 0 } : null),
  isSriLankanPhone: (phone) => /^0\d{9}$/.test(phone || ''),
  loadAdmissionAgeLimits: async () => ({ minAge: 5, maxAge: 25 }),
  shiftIso: () => '2001-01-01',
  submitAdmission: vi.fn(),
  submitPublicAdmission: vi.fn(),
  todayIso: () => '2026-11-27',
}))

vi.mock('../lib/tx', () => ({
  tx: (_arabic, english) => english,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' } }),
}))

const { default: Admissions } = await import('../pages/Admissions')

describe('multi-step admissions navigation', () => {
  it('validates before advancing and preserves entered values when moving back', async () => {
    render(
      <MemoryRouter>
        <Admissions />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Step 1: Prospective Student Details' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Next Step' }))
    expect(await screen.findByText('Student name is required')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Step 1: Prospective Student Details' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Full Name/), { target: { value: 'Student Example' } })
    fireEvent.change(screen.getByLabelText('Date of Birth *'), { target: { value: '2011-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Next Step' }))
    expect(screen.getByRole('heading', { name: 'Step 2: Guardian / Parental Contact' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Parent / Guardian Name *'), { target: { value: 'Parent Example' } })
    fireEvent.change(screen.getByLabelText('Primary Phone Number *'), { target: { value: '0771234567' } })
    fireEvent.change(screen.getByLabelText('Residential Permanent Address *'), { target: { value: 'Mudalippalli, Kalpitiya' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Next Step' }))
    expect(screen.getByRole('heading', { name: 'Step 3: Academic Program Selection' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'Step 2: Guardian / Parental Contact' })).toBeInTheDocument()
    expect(screen.getByLabelText('Parent / Guardian Name *')).toHaveValue('Parent Example')

    fireEvent.click(screen.getByRole('button', { name: 'Continue to Next Step' }))
    expect(screen.getByRole('heading', { name: 'Step 3: Academic Program Selection' })).toBeInTheDocument()
  })
})
