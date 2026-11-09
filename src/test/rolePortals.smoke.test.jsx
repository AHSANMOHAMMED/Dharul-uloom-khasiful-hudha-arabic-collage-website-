import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/supabaseClient', () => {
  const result = { data: [], error: null, count: 0 }
  const builder = () => {
    const b = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') return (res, rej) => Promise.resolve(result).then(res, rej)
          if (prop === 'single' || prop === 'maybeSingle') {
            return () => ({ then: (res, rej) => Promise.resolve({ data: null, error: null }).then(res, rej) })
          }
          return () => b
        },
      },
    )
    return b
  }
  return {
    supabase: {
      from: () => builder(),
      rpc: () => Promise.resolve({ data: null, error: null }),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
        getUser: () => Promise.resolve({ data: { user: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
    },
    isSupabaseConfigured: true,
    supabaseFunctionBaseUrl: '',
  }
})

vi.mock('../context/AuthContext', () => {
  const all = new Proxy(
    {
      user: { id: 'u1', orgId: 'o1', username: 'Tester', staffRoles: ['accountant'], isApproved: true },
      loading: false,
      hasRole: () => true,
      logout: () => {},
    },
    { get: (t, p) => (p in t ? t[p] : true) },
  )
  return { useAuth: () => all, AuthProvider: ({ children }) => children }
})

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k, i18n: { language: 'en', changeLanguage: () => {} } }),
}))

const PORTALS = {
  AccountantPortal: () => import('../pages/portals/AccountantPortal'),
  HrPortal: () => import('../pages/portals/HrPortal'),
  AdmissionsPortal: () => import('../pages/portals/AdmissionsPortal'),
  WardenPortal: () => import('../pages/portals/WardenPortal'),
  CounselorPortal: () => import('../pages/portals/CounselorPortal'),
  ExamPortal: () => import('../pages/portals/ExamPortal'),
  TreasurerPortal: () => import('../pages/portals/TreasurerPortal'),
  PrincipalPortal: () => import('../pages/portals/PrincipalPortal'),
}

describe('Role portals render without crashing', () => {
  for (const [name, load] of Object.entries(PORTALS)) {
    it(name, async () => {
      const errors = []
      const spy = vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.join(' ')))
      const { default: Component } = await load()
      const { container } = render(
        <MemoryRouter>
          <Component />
        </MemoryRouter>,
      )
      await waitFor(() => expect(container.textContent.length).toBeGreaterThan(0))
      await new Promise((r) => setTimeout(r, 80))
      spy.mockRestore()
      const fatal = errors.filter((e) => /The above error|Uncaught|is not a function|Cannot read prop/i.test(e))
      expect(fatal).toEqual([])
    })
  }
})
