import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let authState;
vi.mock('../context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../context/FeatureFlagsContext', () => ({ useFeatures: () => ({ enabled: () => true }) }));
vi.mock('../components/NotificationBell', () => ({ default: () => null }));
vi.mock('../components/LanguageSelect', () => ({ default: () => <select aria-label="Language" /> }));
vi.mock('../components/KhatamPattern', () => ({ default: () => null }));
vi.mock('../components/PageNavBar', () => ({ default: () => null }));

const { default: DashboardSidebarLayout } = await import('../components/DashboardSidebarLayout');

const navItems = [
  { id: 'overview', label_en: 'Overview', icon: 'dashboard' },
  { id: 'attendance', label_en: 'Attendance', icon: 'event' },
  { id: 'fees', label_en: 'Fees', icon: 'payments' },
  { id: 'results', label_en: 'Results', icon: 'grade' },
  { id: 'messages', label_en: 'Messages', icon: 'forum' },
  { id: 'settings', label_en: 'Settings', icon: 'settings' },
];

function renderLayout(onSelect = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <DashboardSidebarLayout
        title_en="Student workspace"
        navItems={navItems}
        activeItem="overview"
        onSelect={onSelect}
      >
        <p>Workspace content</p>
      </DashboardSidebarLayout>
    </MemoryRouter>,
  );
}

describe('DashboardSidebarLayout', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    authState = {
      user: { username: 'Student', role: 'student' },
      logout: vi.fn(),
      isApproved: true,
    };
  });

  it('toggles and persists the desktop sidebar collapsed state', () => {
    renderLayout();

    const collapseButton = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(collapseButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(collapseButton);

    const expandButton = screen.getByRole('button', { name: 'Expand sidebar' });
    expect(expandButton).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('kh_sidebar_collapsed')).toBe('1');
  });

  it('filters workspace navigation and selects a matching section', () => {
    const onSelect = vi.fn();
    renderLayout(onSelect);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search workspace sections' }), {
      target: { value: 'Fees' },
    });

    const feesButton = screen.getByRole('button', { name: 'Fees' });
    expect(screen.queryByRole('button', { name: 'Attendance' })).not.toBeInTheDocument();

    fireEvent.click(feesButton);
    expect(onSelect).toHaveBeenCalledWith('fees');
  });

  it('opens the header account dropdown and triggers sign out', () => {
    renderLayout();

    const menuBtn = screen.getByRole('button', { name: 'Account menu' });
    expect(menuBtn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(menuBtn);
    expect(menuBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'My Profile' })).toBeInTheDocument();

    const signOutItem = screen.getByRole('menuitem', { name: 'Sign out' });
    fireEvent.click(signOutItem);
    expect(authState.logout).toHaveBeenCalledTimes(1);
  });

  it('opens quick-jump dialog and toggles dark mode', () => {
    const onSelect = vi.fn();
    renderLayout(onSelect);

    const themeBtn = screen.getByRole('button', { name: 'Switch to dark mode' });
    fireEvent.click(themeBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('kh_theme')).toBe('dark');

    fireEvent.click(screen.getByRole('button', { name: 'Quick jump (Ctrl+K)' }));
    const dialog = screen.getByRole('dialog', { name: 'Quick navigation' });
    expect(dialog).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /Results/i }));
    expect(onSelect).toHaveBeenCalledWith('results');
  });
});
