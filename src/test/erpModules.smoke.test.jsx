import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Mock backend: every query resolves to an empty result, every RPC to null.
// The goal is to catch render-time crashes in every ERP module.
// ---------------------------------------------------------------------------
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
  const supabase = {
    from: () => builder(),
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      getUser: () => Promise.resolve({ data: { user: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    storage: { from: () => ({ upload: async () => ({}), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  }
  return { supabase, default: supabase, isSupabaseConfigured: true, supabaseFunctionBaseUrl: '' }
})

vi.mock('../context/AuthContext', () => {
  const all = new Proxy(
    {
      user: { id: 'u1', orgId: 'o1', username: 'Tester', staffRoles: [], isApproved: true, classNumber: 3 },
      loading: false,
      hasRole: () => true,
      logout: () => {},
    },
    { get: (t, p) => (p in t ? t[p] : true) },
  )
  return { useAuth: () => all, AuthProvider: ({ children }) => children }
})

const MODULES = {
  'finance/FeeManagement': () => import('../components/erp/finance/FeeManagement'),
  'finance/AccountingPanel': () => import('../components/erp/finance/AccountingPanel'),
  'finance/ExpensesPanel': () => import('../components/erp/finance/ExpensesPanel'),
  'finance/DonationsPanel': () => import('../components/erp/finance/DonationsPanel'),
  'finance/PayrollPanel': () => import('../components/erp/finance/PayrollPanel'),
  'finance/AuditLogPanel': () => import('../components/erp/finance/AuditLogPanel'),
  'campus/ErpDashboard': () => import('../components/erp/campus/ErpDashboard'),
  'campus/MySelfServicePanel': () => import('../components/erp/campus/MySelfServicePanel'),
  'campus/StudentsPanel': () => import('../components/erp/campus/StudentsPanel'),
  'campus/AcademicsPanel': () => import('../components/erp/campus/AcademicsPanel'),
  'campus/CrmPanel': () => import('../components/erp/campus/CrmPanel'),
  'campus/StaffHrPanel': () => import('../components/erp/campus/StaffHrPanel'),
  'campus/HostelPanel': () => import('../components/erp/campus/HostelPanel'),
  'campus/WelfarePanel': () => import('../components/erp/campus/WelfarePanel'),
  'campus/CertificatesPanel': () => import('../components/erp/campus/CertificatesPanel'),
  'campus/PlatformPanel': () => import('../components/erp/campus/PlatformPanel'),
  'pages/VerifyCertificate': () => import('../pages/erp/VerifyCertificate'),
}

describe('ERP modules render without crashing', () => {
  for (const [name, load] of Object.entries(MODULES)) {
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
      await new Promise((r) => setTimeout(r, 50))
      spy.mockRestore()
      const fatal = errors.filter((e) => /The above error|Uncaught|is not a function|Cannot read prop/i.test(e))
      expect(fatal).toEqual([])
      expect(screen.queryByText(/Module under construction/)).toBeNull()
    })
  }
})
