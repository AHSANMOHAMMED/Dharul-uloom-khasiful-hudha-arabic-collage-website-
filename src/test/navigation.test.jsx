import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { safeRedirectPath, useTabParam } from '../lib/useTabParam'

// ---------------------------------------------------------------------------
// Mocks: auth state is controlled per test; notifications come from notifyApi.
// ---------------------------------------------------------------------------
let authState = {}
vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}))

let notifications = []
const markRead = vi.fn(async () => {})
vi.mock('../lib/notifyApi', () => ({
  listMyNotifications: async () => notifications,
  markNotificationRead: (...a) => markRead(...a),
  markAllNotificationsRead: async () => {},
  updateNotifyPrefs: async () => {},
}))

vi.mock('../lib/supabaseClient', () => ({ supabase: null, isSupabaseConfigured: false }))

const { default: DashboardTopBar } = await import('../components/DashboardTopBar')
const { default: Navbar } = await import('../components/Navbar')
const { default: NotificationBell } = await import('../components/NotificationBell')

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname + loc.search}</div>
}

const staffAuth = {
  user: { id: 'u1', username: 'Ustadh Ahmed', email: 'a@x.lk', role: 'user' },
  isAuthenticated: true,
  isEmployee: true,
  isLibrarian: true,
  isTutor: true,
  logout: vi.fn(),
}

beforeEach(() => {
  authState = {}
  notifications = []
  markRead.mockClear()
})

describe('safeRedirectPath', () => {
  it('accepts in-app paths only', () => {
    expect(safeRedirectPath('/erp?module=tasks')).toBe('/erp?module=tasks')
    expect(safeRedirectPath('//evil.com')).toBeNull()
    expect(safeRedirectPath('/\\evil.com')).toBeNull()
    expect(safeRedirectPath('https://evil.com')).toBeNull()
    expect(safeRedirectPath('/login')).toBeNull()
    expect(safeRedirectPath(undefined)).toBeNull()
  })
})

describe('useTabParam', () => {
  function Tabs() {
    const [tab, setTab] = useTabParam(['a', 'b'], 'a')
    return (
      <>
        <span data-testid="tab">{tab}</span>
        <button onClick={() => setTab('b')}>go-b</button>
        <button onClick={() => setTab('a')}>go-a</button>
        <LocationProbe />
      </>
    )
  }

  it('reads, validates and writes ?tab=', () => {
    render(
      <MemoryRouter initialEntries={['/admin?tab=bogus']}>
        <Tabs />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('tab')).toHaveTextContent('a')
    fireEvent.click(screen.getByText('go-b'))
    expect(screen.getByTestId('tab')).toHaveTextContent('b')
    expect(screen.getByTestId('loc')).toHaveTextContent('/admin?tab=b')
    fireEvent.click(screen.getByText('go-a'))
    expect(screen.getByTestId('loc')).toHaveTextContent(/^\/admin$/)
  })
})

describe('DashboardTopBar', () => {
  it('offers workspace links in a mobile menu, including the public site', () => {
    authState = staffAuth
    render(
      <MemoryRouter initialEntries={['/erp']}>
        <DashboardTopBar />
      </MemoryRouter>,
    )
    expect(document.getElementById('workspace-mobile-menu')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /workspace menu/i }))
    const menu = document.getElementById('workspace-mobile-menu')
    expect(menu).not.toBeNull()
    const hrefs = [...menu.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(expect.arrayContaining(['/erp', '/library-admin', '/dashboard', '/']))
    expect(menu.querySelector('a[href="/erp"]')).toHaveAttribute('aria-current', 'page')
  })
})

describe('Navbar', () => {
  it('highlights a section on its detail pages', () => {
    authState = { isAuthenticated: false, logout: vi.fn() }
    render(
      <MemoryRouter initialEntries={['/news/42']}>
        <Navbar />
      </MemoryRouter>,
    )
    // The Explore dropdown trigger is active because /news/42 is under /news.
    const explore = screen.getAllByRole('button').find((b) => b.getAttribute('aria-haspopup') && /explore|استكشف/i.test(b.textContent))
    expect(explore.className).toMatch(/text-emerald-700/)
  })

  it('closes the mobile drawer on navigation', async () => {
    authState = { isAuthenticated: false, logout: vi.fn() }
    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>,
    )
    const toggle = screen.getByRole('button', { name: /toggle navigation menu/i })
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const aboutLinks = screen.getAllByRole('link').filter((a) => a.getAttribute('href') === '/about')
    fireEvent.click(aboutLinks[aboutLinks.length - 1])
    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'false'))
  })
})

describe('NotificationBell', () => {
  it('follows a notification deep link and marks it read', async () => {
    authState = { isAuthenticated: true }
    notifications = [
      { id: 'n1', title: 'New task', message: 'Prepare exam', is_read: false, link: '/erp?module=tasks', created_at: new Date().toISOString() },
    ]
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="*" element={<><NotificationBell /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>,
    )
    const bell = screen.getByRole('button', { name: /notifications/i })
    await waitFor(() => expect(bell.textContent).toContain('1'))
    fireEvent.click(bell)
    fireEvent.click(await screen.findByText('New task'))
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/erp?module=tasks'))
    expect(markRead).toHaveBeenCalledWith('n1')
  })
})
