import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Mock backend: queries resolve to empty results; the ops RPCs return small
// fixtures so the charts, tables and totals actually render.
// ---------------------------------------------------------------------------
const fixtures = vi.hoisted(() => {
  const soon = new Date(Date.now() + 3 * 864e5).toISOString()
  return {
    finance_today: {
      date: '2026-11-08', collected: 15000, receipts: 3, by_method: { cash: 10000, payhere: 5000 }, online: 5000,
      latest: [{ id: 'r1', receipt_no: 'R-1', amount: 5000, method: 'payhere', paid_at: '2026-11-08T04:00:00Z', student: 'Ali', index_number: 'S1' }],
      outstanding: 42000, pending_petty_cash: 1, pending_expenses: 2, messages_failed_24h: 1,
    },
    finance_analytics: {
      as_of: '2026-11-08',
      months: [
        { month: '2026-10', invoiced: 1000, collected_for_month: 800, cash_received: 900, expenses: 100, petty_cash: 50, donations: 20, payroll: 300 },
        { month: '2026-11', invoiced: 1200, collected_for_month: 600, cash_received: 700, expenses: 0, petty_cash: 0, donations: 0, payroll: 0 },
      ],
      aging: { not_due: 100, d0_30: 200, d31_60: 0, d61_90: 0, d90_plus: 500, total: 800, students: 4 },
      collection_rate: 63.6,
      by_class: [{ class_number: 1, invoiced: 2200, paid: 1400, outstanding: 800, rate: 63.6 }],
      by_method: { cash: 1200, payhere: 400 },
      top_arrears: [{ student_id: 's1', full_name: 'Ali', index_number: 'S1', class_number: 1, balance: 500, oldest_due: '2026-06-10' }],
      expenses_by_account: [{ code: '5100', name: 'Utilities', amount: 100 }],
      petty_cash_by_duty: [{ duty: 'Kitchen', name_ar: null, name_ta: null, spent: 50 }],
    },
    academic_analytics: {
      as_of: '2026-11-08',
      attendance_by_month: [{ month: '2026-10', marked: 100, rate: 91.5 }],
      attendance_by_class: [{ class_number: 1, rate: 88, marked: 40 }],
      chronic_absentees: [{ student_id: 's2', full_name: 'Omar', class_number: 1, marked: 10, rate: 60 }],
      latest_exam: { exam_id: 'e1', name: 'Term 1', class_number: 1, subjects: [{ subject: 'Fiqh', average: 71.2, pass_rate: 90, entries: 20 }] },
      admissions_funnel: { submitted: 5, enrolled: 2 },
      admissions_conversion: 28.6,
      enrolment_by_class: [{ class_number: 1, students: 30 }],
      staff_leave_days: { annual: 4 },
      tasks: { open: 3, overdue: 1, done_30d: 5 },
    },
    my_responsibilities: {
      duties: [{ assignment_id: 'd1', name_en: 'Hostel warden', since: '2026-01-01', is_lead: true, grants_leave_review: true, petty_fund_id: 'f1' }],
      activities: [{
        activity_id: 'a1', title: 'Quran competition', category: 'event', starts_at: soon, ends_at: null, location: 'Hall', status: 'planned',
        role: 'lead', responsibilities: 'Judging', my_status: 'assigned', team: [{ name: 'Tester', role: 'lead', status: 'assigned' }],
      }],
      tasks: { todo: 1, in_progress: 0, review: 0, overdue: 0 },
      permissions: {},
    },
  }
})

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
    rpc: (name) => Promise.resolve({ data: fixtures[name] ?? null, error: null }),
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

const MODULES = {
  'ops/ActivitiesPanel': () => import('../components/erp/ops/ActivitiesPanel'),
  'ops/FinanceTodayPanel': () => import('../components/erp/ops/FinanceTodayPanel'),
  'ops/AnalyticsPanel': () => import('../components/erp/ops/AnalyticsPanel'),
}

const isFatal = (e) => /The above error|Uncaught|is not a function|Cannot read prop/i.test(e)

describe('Ops modules render without crashing', () => {
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
      expect(errors.filter(isFatal)).toEqual([])
    })
  }
})

// Click through tabs / open forms to render every view once.
const FLOWS = {
  'ops/ActivitiesPanel': ['Accept', 'Cancel', 'Decline', 'Cancel', 'All activities', '+ New activity', 'Cancel'],
  'ops/FinanceTodayPanel': ['Send reminders', 'Cancel', 'Resend'],
  'ops/AnalyticsPanel': ['Show table', '24 months', 'Academic', 'Show table', '365 days', 'Finance'],
}

describe('Ops views render without crashing', () => {
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
        const [btn] = await screen.findAllByText((_, el) => el?.tagName === 'BUTTON' && el.textContent.trim() === label)
        fireEvent.click(btn)
        await new Promise((r) => setTimeout(r, 30))
      }
      spy.mockRestore()
      expect(errors.filter(isFatal)).toEqual([])
    })
  }
})

describe('Ops totals', () => {
  it('shows finance totals that add up', async () => {
    const { default: Component } = await MODULES['ops/AnalyticsPanel']()
    render(
      <MemoryRouter>
        <Component />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Balanced', { exact: false })).toBeTruthy()
    // invoiced 1000 + 1200
    expect(screen.getAllByText('LKR 2,200.00').length).toBeGreaterThan(0)
  })

  it('helpers: ageing sum, outgoings and time split', async () => {
    const { ageingRows, monthRows, splitByTime } = await import('../lib/erp/opsApi')
    const a = ageingRows(fixtures.finance_analytics.aging)
    expect(a.sum).toBe(800)
    expect(a.balanced).toBe(true)
    expect(ageingRows({ ...fixtures.finance_analytics.aging, total: 801 }).balanced).toBe(false)
    expect(monthRows(fixtures.finance_analytics.months)[0].outgoing).toBe(450)
    const now = new Date('2026-11-08T12:00:00Z')
    const s = splitByTime(
      [
        { id: 'p', starts_at: '2026-11-01T08:00:00Z', status: 'planned' },
        { id: 'o', starts_at: '2026-11-08T08:00:00Z', ends_at: '2026-11-08T18:00:00Z', status: 'planned' },
        { id: 'u', starts_at: '2026-11-20T08:00:00Z', status: 'planned' },
        { id: 'c', starts_at: '2026-11-21T08:00:00Z', status: 'cancelled' },
      ],
      now,
    )
    expect(s.past.map((x) => x.id).sort()).toEqual(['c', 'p'])
    expect(s.ongoing.map((x) => x.id)).toEqual(['o'])
    expect(s.upcoming.map((x) => x.id)).toEqual(['u'])
  })
})
