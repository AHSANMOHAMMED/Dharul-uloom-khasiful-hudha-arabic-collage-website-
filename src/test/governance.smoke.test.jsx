import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Mock backend: every query resolves to an empty result, every RPC to null.
// The goal is to catch render-time crashes in the governance modules.
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
    channel: () => {
      const ch = { on: () => ch, subscribe: () => ch, unsubscribe: () => {} }
      return ch
    },
    removeChannel: () => {},
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

vi.mock('../context/FeatureFlagsContext', () => ({
  useFeatures: () => ({
    features: {},
    loading: false,
    enabled: () => true,
    refreshFeatures: async () => {},
  }),
  FeatureFlagsProvider: ({ children }) => children,
}))

const MODULES = {
  'governance/DutiesPanel': () => import('../components/erp/governance/DutiesPanel'),
  'governance/PettyCashPanel': () => import('../components/erp/governance/PettyCashPanel'),
  'governance/MashooraPanel': () => import('../components/erp/governance/MashooraPanel'),
  'governance/TaskBoard': () => import('../components/erp/governance/TaskBoard'),
  'pages/ErpWorkspace': () => import('../pages/erp/ErpWorkspace'),
}

describe('Governance modules render without crashing', () => {
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
    })
  }
})

// Click through tabs / open forms to render every view once.
const FLOWS = {
  'governance/DutiesPanel': ['Year-end rotation', 'History', 'Duty catalog', '+ New duty'],
  'governance/PettyCashPanel': ['My funds', 'Review queue', 'Ledger', '+ Open fund'],
  'governance/MashooraPanel': ['+ New mashoora'],
  'governance/TaskBoard': ['All tasks', '+ New task'],
}

describe('Governance views render without crashing', () => {
  for (const [name, clicks] of Object.entries(FLOWS)) {
    it(name, async () => {
      const errors = []
      const spy = vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.join(' ')))
      const { default: Component } = await MODULES[name]()
      render(
        <MemoryRouter>
          <Component />
        </MemoryRouter>,
      )
      for (const label of clicks) {
        const btn = await screen.findByText((_, el) => el?.tagName === 'BUTTON' && el.textContent.trim() === label)
        fireEvent.click(btn)
        await new Promise((r) => setTimeout(r, 30))
      }
      spy.mockRestore()
      const fatal = errors.filter((e) => /The above error|Uncaught|is not a function|Cannot read prop/i.test(e))
      expect(fatal).toEqual([])
    })
  }
})
