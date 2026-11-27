import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../context/FeatureFlagsContext';
import NotificationBell from './NotificationBell';
import LanguageSelect from './LanguageSelect';
import KhatamPattern from './KhatamPattern';
import { tx } from '../lib/tx';
import PageNavBar from './PageNavBar';
import Icon from './Icon';

/**
 * DashboardSidebarLayout
 * Unified institutional sidebar layout for all role-based workspaces.
 * Complies with Modern Manuscript design system:
 * - #F8FAFC Parchment background
 * - #FFFFFF Paper cards
 * - #E2E8F0 Sand borders
 * - #0B3B2E Ink green & #11694A Emerald
 * - #C29A3A Brass gold
 * - Zero emojis (Material Symbols Outlined only)
 * - Official D.U. Kashiful Hudha Arabic College, Mudalaippali branding
 */
export default function DashboardSidebarLayout({
  title_en = 'Portal Console',
  title_ar = 'لوحة التحكم',
  roleBadge = { text_en: 'Authorized User', text_ar: 'مستخدم معتمد', color: 'bg-[#E3F1EA] text-[#0B3B2E] border-[#0B3B2E]/20' },
  navItems = [],
  activeItem,
  onSelect,
  roleSwitcher = null,
  quickLinks = [],
  topActions = null,
  homeItem,
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('kh_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('kh_theme') === 'dark';
    } catch {
      return false;
    }
  });
  const [navSearch, setNavSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout, isAdmin, isSuperAdmin, isEmployee, isLibrarian, isParent, isApproved } = useAuth();
  const { enabled } = useFeatures();
  const canMessage = !isSuperAdmin && isApproved && enabled('messaging') && (user?.accountType !== 'guest' || isEmployee || isAdmin || isLibrarian);
  useTranslation();
  const location = useLocation();

  useEffect(() => {
    try {
      localStorage.setItem('kh_sidebar_collapsed', sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore storage errors */
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', darkMode);
    }
    try {
      localStorage.setItem('kh_theme', darkMode ? 'dark' : 'light');
    } catch {
      /* ignore storage errors */
    }
  }, [darkMode]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((open) => !open);
        setCmdQuery('');
      } else if (e.key === 'Escape') {
        setCmdOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return undefined;
    const onPointerDown = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [userMenuOpen]);

  useEffect(() => {
    setUserMenuOpen(false);
    setCmdOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const toggleGroup = (groupKey) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  const hasMessagesTab = Boolean(onSelect && navItems.some((n) => n.id === 'messages'));
  const onPortalDashboard = location.pathname === '/dashboard';

  // Standard institutional quick links across workspaces (stay in-place on /dashboard)
  const defaultQuickLinks = [];
  if (isAdmin) {
    if (location.pathname !== '/admin') defaultQuickLinks.push({ to: '/admin', label_en: 'Admin Console', label_ar: 'لوحة الإدارة', icon: 'admin_panel_settings' });
    if (!onPortalDashboard && location.pathname !== '/erp') defaultQuickLinks.push({ to: '/erp', label_en: 'Campus ERP', label_ar: 'نظام ERP', icon: 'domain' });
    if (location.pathname !== '/library-admin') defaultQuickLinks.push({ to: '/library-admin', label_en: 'Maktabah Admin', label_ar: 'إدارة المكتبة', icon: 'local_library' });
  } else {
    if (!onPortalDashboard && isEmployee && location.pathname !== '/erp') {
      defaultQuickLinks.push({ to: '/erp', label_en: 'Campus ERP', label_ar: 'نظام ERP', icon: 'domain' });
    }
    if (isLibrarian && !onPortalDashboard && location.pathname !== '/library-admin') {
      defaultQuickLinks.push({ to: '/library-admin', label_en: 'Maktabah Admin', label_ar: 'إدارة المكتبة', icon: 'local_library' });
    }
  }

  if (canMessage && !hasMessagesTab && location.pathname !== '/messages') {
    defaultQuickLinks.push({ to: '/messages', label_en: 'Messages & Chat', label_ar: 'الرسائل والمحادثات', icon: 'forum' });
  }
  if (!isParent && isApproved && enabled('library') && (user?.accountType !== 'guest' || isEmployee || isAdmin || isLibrarian) && location.pathname !== '/library') {
    defaultQuickLinks.push({ to: '/library', label_en: 'Digital Maktabah', label_ar: 'المكتبة الرقمية', icon: 'auto_stories' });
  }
  if (!onPortalDashboard) {
    defaultQuickLinks.push({ to: '/', label_en: 'College Homepage', label_ar: 'بوابة الكلية العامة', icon: 'public' });
  }

  const effectiveQuickLinks = quickLinks.length > 0 ? quickLinks : defaultQuickLinks;
  const normalizedSearch = navSearch.trim().toLocaleLowerCase();
  const visibleNavItems = normalizedSearch
    ? navItems.filter((item) =>
        `${tx(item.label_ar, item.label_en)} ${tx(item.group_ar || item.group, item.group || '')}`
          .toLocaleLowerCase()
          .includes(normalizedSearch),
      )
    : navItems;

  // Active item details for breadcrumb
  const currentNav = navItems.find((n) => n.id === activeItem);
  const cmdMatches = (() => {
    const q = cmdQuery.trim().toLocaleLowerCase();
    const sections = navItems.map((item) => ({
      kind: 'tab',
      id: item.id,
      icon: item.icon || 'circle',
      label: tx(item.label_ar, item.label_en),
      group: tx(item.group_ar || item.group || '', item.group || ''),
    }));
    const links = effectiveQuickLinks.map((link) => ({
      kind: 'link',
      to: link.to,
      icon: link.icon || 'open_in_new',
      label: tx(link.label_ar, link.label_en),
      group: tx('روابط سريعة', 'Quick links'),
    }));
    const all = [...sections, ...links];
    return q ? all.filter((entry) => `${entry.label} ${entry.group}`.toLocaleLowerCase().includes(q)) : all;
  })();

  return (
    <div className="erp-theme min-h-screen bg-[#F8FAFC] dark:bg-dark-canvas text-[#0F172A] dark:text-dark-text-primary flex relative overflow-hidden" dir={tx('rtl', 'ltr')}>
      <a className="skip-link" href="#workspace-main">{tx('تخطي إلى المحتوى', 'Skip to main content')}</a>

      {/* Subtle Institutional Watermark */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <KhatamPattern className="opacity-[0.02]" strokeColor="#0B3B2E" id="workspace-sidebar-khatam" />
      </div>

      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label={tx('إغلاق القائمة الجانبية', 'Close sidebar menu')}
        />
      )}

      {/* ── Fixed Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`fixed top-0 bottom-0 start-0 z-50 w-72 ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'} bg-white dark:bg-dark-surface border-e border-slate-200 dark:border-dark-border flex flex-col shadow-[2px_0_12px_rgba(15,23,42,0.04)] transition-transform duration-300 ease-in-out motion-reduce:transition-none lg:translate-x-0 rtl:lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:translate-x-0 rtl:lg:translate-x-0'
        }`}
      >
        {/* Sidebar Header: College Crest & Institutional Title */}
        <div className={`p-5 border-b border-[#E2E8F0] relative overflow-hidden ${sidebarCollapsed ? 'lg:px-3' : ''}`}>
          <div className={`flex items-center gap-3.5 ${sidebarCollapsed ? 'lg:justify-center lg:gap-0' : ''}`}>
            <Link to="/" className="shrink-0 group" title={tx('الصفحة الرئيسية', 'Home')}>
              <img
                src="/images/logo.svg"
                alt={tx('شعار دار العلوم كاشف الهدى', 'D.U. Kashiful Hudha Arabic College Crest')}
                width="48"
                height="48"
                className="w-12 h-12 object-contain rounded-xl border border-[#E2E8F0] p-0.5 bg-[#F8FAFC] shadow-xs group-hover:border-[#11694A] transition-colors"
              />
            </Link>

            <div className={`flex flex-col min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              <span className="font-serif font-bold text-sm text-[#0B3B2E] truncate leading-tight">
                {tx('دار العلوم كاشف الهدى', 'D.U. Kashiful Hudha')}
              </span>
              <span className="text-[11px] font-sans text-[#11694A] font-semibold truncate leading-tight mt-0.5">
                {tx('الكلية العربية — مدلي بالي', 'Arabic College · Mudalaippali')}
              </span>
              <span className="text-[10px] text-[#4A5E56] font-sans truncate">
                {tx('سريلانكا · تأسست ١٩٩٦', 'Sri Lanka · Est. 1996')}
              </span>
            </div>
          </div>

          {/* Active Role Badge */}
          <div className={`mt-3 flex items-center justify-between gap-2 ${sidebarCollapsed ? 'lg:justify-center' : ''}`}>
            <span
              title={tx(roleBadge.text_ar, roleBadge.text_en)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleBadge.color || 'bg-[#E3F1EA] text-[#0B3B2E] border-[#0B3B2E]/20'} ${sidebarCollapsed ? 'lg:px-1.5' : ''}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{tx(roleBadge.text_ar, roleBadge.text_en)}</span>
            </span>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1 rounded-lg text-[#4A5E56] hover:bg-[#F8FAFC] hover:text-[#0B3B2E]"
              aria-label={tx('إغلاق القائمة الجانبية', 'Close sidebar')}
            >
              <Icon name="close" className="text-[20px]" />
            </button>
          </div>
        </div>

        {/* Multi-role Switcher (if assigned) */}
        {roleSwitcher && (
          <div className={`px-4 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0] ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
            {roleSwitcher}
          </div>
        )}

        {navItems.length > 5 && (
          <div className={`px-3 pt-3 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
            <label htmlFor="workspace-navigation-search" className="sr-only">
              {tx('البحث في أقسام مساحة العمل', 'Search workspace sections')}
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/15">
              <Icon name="search" className="text-[17px] text-slate-400" aria-hidden="true" />
              <input
                id="workspace-navigation-search"
                name="workspace_navigation_search"
                type="search"
                autoComplete="off"
                value={navSearch}
                onChange={(event) => setNavSearch(event.target.value)}
                placeholder={tx('ابحث عن قسم…', 'Find a section…')}
                className="min-w-0 w-full border-0 bg-transparent py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
              />
              {navSearch && (
                <button
                  type="button"
                  onClick={() => setNavSearch('')}
                  aria-label={tx('مسح البحث', 'Clear search')}
                  className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-emerald-700"
                >
                  <Icon name="close" className="text-[15px]" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Sidebar Nav Items (Scrollable) */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 hide-scrollbar" aria-label={tx('أقسام مساحة العمل', 'Workspace sections')}>
          {!visibleNavItems.some((n) => n.group) && visibleNavItems.length > 0 && (
            <div className={`px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              {tx('أقسام وميزات البوابة', 'Workspace Features')}
            </div>
          )}

          {visibleNavItems.map((item, idx) => {
            const prevGroup = idx > 0 ? visibleNavItems[idx - 1].group : null;
            const showGroup = item.group && item.group !== prevGroup;
            const isActive = activeItem === item.id;
            const groupClosed = !normalizedSearch && !sidebarCollapsed && item.group && collapsedGroups.has(item.group) && !isActive;
            return (
              <div key={item.id} className="space-y-1">
                {showGroup && (
                  <>
                    {idx > 0 && sidebarCollapsed && <div className="hidden lg:block my-2 border-t border-slate-200 dark:border-dark-border" />}
                    <button
                      type="button"
                      onClick={() => toggleGroup(item.group)}
                      aria-expanded={!collapsedGroups.has(item.group)}
                      className={`w-full flex items-center justify-between px-3 ${idx === 0 ? 'pt-1' : 'pt-3'} pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 font-sans ${sidebarCollapsed ? 'lg:hidden' : ''}`}
                    >
                      <span>{tx(item.group_ar || item.group, item.group)}</span>
                      <Icon name={collapsedGroups.has(item.group) ? 'expand_more' : 'expand_less'} className="text-[14px]" aria-hidden="true" />
                    </button>
                  </>
                )}
                {!groupClosed && (
                <button
                  type="button"
                  title={sidebarCollapsed ? tx(item.label_ar, item.label_en) : undefined}
                  aria-label={tx(item.label_ar, item.label_en)}
                  aria-pressed={isActive}
                  onClick={() => {
                    if (onSelect) onSelect(item.id);
                    setMobileOpen(false);
                  }}
                  className={`relative w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 ${
                    sidebarCollapsed ? 'lg:justify-center lg:px-2' : ''
                  } ${
                    isActive
                      ? 'bg-emerald-50 text-[#0B3B2E] ring-1 ring-emerald-700/10'
                      : 'text-slate-600 hover:text-[#0B3B2E] hover:bg-slate-50'
                  }`}
                >
                  <div className={`flex items-center gap-2.5 min-w-0 ${sidebarCollapsed ? 'lg:justify-center' : ''}`}>
                    <Icon
                      name={item.icon || 'circle'}
                      className={`text-[20px] shrink-0 ${isActive ? 'text-emerald-700' : 'text-slate-500'}`}
                      aria-hidden="true"
                    />
                    <span className={`truncate ${sidebarCollapsed ? 'lg:hidden' : ''}`}>{tx(item.label_ar, item.label_en)}</span>
                  </div>

                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        sidebarCollapsed ? 'lg:absolute lg:-top-1 lg:-end-1 lg:px-1' : ''
                      } ${
                        isActive
                          ? 'bg-emerald-700 text-white'
                          : item.badgeTone === 'emerald'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
                )}
              </div>
            );
          })}
          {normalizedSearch && visibleNavItems.length === 0 && (
            <p className="px-3 py-4 text-xs text-slate-500">{tx('لا توجد أقسام مطابقة', 'No matching sections')}</p>
          )}

          {/* Institutional Shortcuts (ERP, Maktabah, Admin) */}
          {effectiveQuickLinks.length > 0 && (
            <div className="pt-4 mt-2 border-t border-[#E2E8F0]">
              <div className={`px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                {tx('الروابط المؤسسية', 'Institutional Workspaces')}
              </div>
              {effectiveQuickLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  title={sidebarCollapsed ? tx(link.label_ar, link.label_en) : undefined}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-[#0B3B2E] hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 ${sidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}`}
                >
                  <Icon name={link.icon} className="text-[19px] text-emerald-700" aria-hidden="true" />
                  <span className={`min-w-0 truncate ${sidebarCollapsed ? 'lg:hidden' : ''}`}>{tx(link.label_ar, link.label_en)}</span>
                </Link>
              ))}
            </div>
          )}
        </nav>

        {/* Sidebar Footer: Profile Card + Language + Sign Out */}
        <div className={`p-3.5 border-t border-slate-200 bg-white space-y-2.5 ${sidebarCollapsed ? 'lg:p-2' : ''}`}>
          {/* User Profile Card -> /profile */}
          <Link
            to="/profile"
            title={tx('الملف الشخصي والإعدادات', 'Profile & Settings')}
            className={`flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 ${sidebarCollapsed ? 'lg:justify-center lg:px-1' : ''}`}
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user?.username || 'Profile'} width="36" height="36" className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-[#E3F1EA] text-[#11694A] font-serif font-bold text-sm flex items-center justify-center shrink-0 border border-[#11694A]/20">
                {(user?.username || user?.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div className={`flex flex-col min-w-0 flex-1 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              <span className="text-xs font-bold text-[#0B3B2E] truncate leading-tight">
                {user?.username || user?.email}
              </span>
              <span className="text-[10px] text-[#4A5E56] font-mono truncate leading-none mt-1">
                {user?.indexNumber || user?.role || 'authorized'} · {tx('الملف', 'Profile')}
              </span>
            </div>
          </Link>

          {/* Language Selector & Sign Out */}
          <div className={`grid grid-cols-2 gap-2 items-center ${sidebarCollapsed ? 'lg:grid-cols-1' : ''}`}>
            <div className="relative flex items-center">
              <Icon name="translate" className="text-[15px] text-[#11694A] absolute start-2.5 pointer-events-none" />
              <LanguageSelect className={`w-full ps-8 pe-2 py-2 text-[11px] rounded-xl ${sidebarCollapsed ? 'lg:px-1.5' : ''}`} />
            </div>
            <button
              type="button"
              onClick={logout}
              title={tx('تسجيل الخروج', 'Sign out')}
              aria-label={tx('تسجيل الخروج', 'Sign out')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold border border-rose-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600/40 ${sidebarCollapsed ? 'lg:px-2' : ''}`}
            >
              <Icon name="logout" className="text-[16px]" aria-hidden="true" />
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{tx('تسجيل الخروج', 'Sign out')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Workspace Body ────────────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col min-w-0 relative z-10 ${sidebarCollapsed ? 'lg:ms-20' : 'lg:ms-72'}`}>
        
        {/* Top Utility Header */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-dark-surface/95 backdrop-blur-md border-b border-slate-200 dark:border-dark-border px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden shrink-0 p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40"
              aria-label={tx('فتح القائمة الجانبية', 'Open sidebar menu')}
            >
              <Icon name="menu" className="text-[20px]" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              aria-label={sidebarCollapsed ? tx('توسيع القائمة الجانبية', 'Expand sidebar') : tx('طي القائمة الجانبية', 'Collapse sidebar')}
              aria-pressed={sidebarCollapsed}
              title={sidebarCollapsed ? tx('توسيع القائمة الجانبية', 'Expand sidebar') : tx('طي القائمة الجانبية', 'Collapse sidebar')}
              className="hidden lg:inline-flex shrink-0 items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40"
            >
              <Icon name={sidebarCollapsed ? 'chevron_right' : 'chevron_left'} className="text-[20px] rtl:rotate-180" aria-hidden="true" />
            </button>

            {/* Breadcrumb / Title */}
            <div className="flex items-center gap-2 text-xs font-sans min-w-0">
              <span className="font-sans font-semibold text-sm sm:text-base text-slate-800 truncate">
                {tx(title_ar, title_en)}
              </span>
              {currentNav && (
                <>
                  <span className="text-slate-300 font-bold hidden sm:inline">/</span>
                  <span className="text-emerald-700 font-medium hidden sm:inline truncate">
                    {tx(currentNav.label_ar, currentNav.label_en)}
                  </span>
                </>
              )}
              {roleBadge && (
                <span className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${roleBadge.color || 'bg-[#E3F1EA] text-[#0B3B2E] border-[#0B3B2E]/20'}`}>
                  {tx(roleBadge.text_ar, roleBadge.text_en)}
                </span>
              )}
            </div>
          </div>

          {/* Right Top Header Actions — notifications live here so mobile users can open them without the sidebar */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {topActions}

            <button
              type="button"
              onClick={() => {
                setCmdOpen(true);
                setCmdQuery('');
              }}
              aria-label={tx('انتقال سريع (Ctrl+K)', 'Quick jump (Ctrl+K)')}
              title={tx('انتقال سريع (Ctrl+K)', 'Quick jump (Ctrl+K)')}
              className="hidden md:inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-dark-canvas text-xs text-slate-500 hover:bg-white hover:text-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40"
            >
              <Icon name="search" className="text-[16px] text-slate-400" aria-hidden="true" />
              <span>{tx('بحث سريع…', 'Quick search…')}</span>
              <kbd className="rounded border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                {'⌘K'}
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-pressed={darkMode}
              aria-label={darkMode ? tx('تفعيل الوضع الفاتح', 'Switch to light mode') : tx('تفعيل الوضع الداكن', 'Switch to dark mode')}
              title={darkMode ? tx('الوضع الفاتح', 'Light mode') : tx('الوضع الداكن', 'Dark mode')}
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-canvas text-slate-700 dark:text-dark-text-primary hover:bg-slate-50 hover:text-emerald-700 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40"
            >
              <Icon name={darkMode ? 'light_mode' : 'dark_mode'} className="text-[18px]" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-pressed={isFullscreen}
              aria-label={isFullscreen ? tx('إنهاء ملء الشاشة', 'Exit fullscreen') : tx('ملء الشاشة', 'Toggle fullscreen')}
              title={isFullscreen ? tx('إنهاء ملء الشاشة', 'Exit fullscreen') : tx('ملء الشاشة', 'Fullscreen')}
              className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-canvas text-slate-700 dark:text-dark-text-primary hover:bg-slate-50 hover:text-emerald-700 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40"
            >
              <Icon name={isFullscreen ? 'fullscreen_exit' : 'fullscreen'} className="text-[18px]" aria-hidden="true" />
            </button>

            <NotificationBell />

            {canMessage && (
              hasMessagesTab ? (
                <button
                  type="button"
                  onClick={() => onSelect('messages')}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-canvas text-slate-700 dark:text-dark-text-primary hover:bg-slate-50 hover:text-emerald-700 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40"
                  title={tx('الرسائل', 'Messages')}
                  aria-label={tx('الرسائل', 'Messages')}
                >
                  <Icon name="chat" className="text-[18px]" aria-hidden="true" />
                </button>
              ) : (
                <Link
                  to="/messages"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-canvas text-slate-700 dark:text-dark-text-primary hover:bg-slate-50 hover:text-emerald-700 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40"
                  title={tx('الرسائل', 'Messages')}
                  aria-label={tx('الرسائل', 'Messages')}
                >
                  <Icon name="chat" className="text-[18px]" aria-hidden="true" />
                </Link>
              )
            )}

            {!isParent && isApproved && enabled('library') && (user?.accountType !== 'guest' || isEmployee || isAdmin || isLibrarian) && (
              <Link
                to="/library"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-canvas text-xs font-semibold text-slate-700 dark:text-dark-text-primary hover:bg-slate-50 hover:text-emerald-700 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40"
              >
                <Icon name="auto_stories" className="text-[16px] text-emerald-700" aria-hidden="true" />
                <span>{tx('المكتبة', 'Library')}</span>
              </Link>
            )}

            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label={tx('قائمة الحساب', 'Account menu')}
                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-canvas hover:bg-slate-50 shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40"
              >
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user?.username || 'Profile'} width="28" height="28" className="w-7 h-7 rounded-lg object-cover border border-slate-200 shrink-0" />
                ) : (
                  <span className="w-7 h-7 rounded-lg bg-[#E3F1EA] text-[#11694A] text-xs font-bold flex items-center justify-center shrink-0">
                    {(user?.username || user?.email || 'U')[0].toUpperCase()}
                  </span>
                )}
                <span className="hidden md:inline text-xs font-semibold text-[#0B3B2E] dark:text-dark-text-primary max-w-[120px] truncate">
                  {user?.username || tx('ملفي', 'Profile')}
                </span>
                <Icon name="expand_more" className={`hidden sm:inline text-[16px] text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  aria-label={tx('خيارات الحساب', 'Account options')}
                  className="absolute end-0 mt-2 w-60 rounded-2xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface p-2 shadow-lg z-50"
                >
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-dark-border mb-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-dark-text-primary truncate">
                      {user?.username || user?.email || tx('المستخدم', 'User')}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {tx(roleBadge.text_ar, roleBadge.text_en)}
                    </div>
                  </div>
                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-dark-text-primary hover:bg-slate-50 hover:text-emerald-800"
                  >
                    <Icon name="person" className="text-[17px] text-slate-500" aria-hidden="true" />
                    <span>{tx('الملف الشخصي', 'My Profile')}</span>
                  </Link>
                  <Link
                    to="/account"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-dark-text-primary hover:bg-slate-50 hover:text-emerald-800"
                  >
                    <Icon name="verified_user" className="text-[17px] text-slate-500" aria-hidden="true" />
                    <span>{tx('أمان الحساب والمصادقة', 'Account Security & MFA')}</span>
                  </Link>
                  {canMessage && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        if (hasMessagesTab) onSelect('messages');
                        else navigate('/messages');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-dark-text-primary hover:bg-slate-50 hover:text-emerald-800 text-start"
                    >
                      <Icon name="forum" className="text-[17px] text-slate-500" aria-hidden="true" />
                      <span>{tx('الرسائل والمحادثات', 'Messages')}</span>
                    </button>
                  )}
                  <div className="my-1 border-t border-slate-100 dark:border-dark-border" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 text-start"
                  >
                    <Icon name="logout" className="text-[17px]" aria-hidden="true" />
                    <span>{tx('تسجيل الخروج', 'Sign out')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content Workspace — erp-theme so embedded ERP panels use the official light manuscript palette */}
        <main id="workspace-main" tabIndex="-1" className="erp-theme flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 space-y-5 max-w-screen-2xl w-full mx-auto text-ink-text-primary focus:outline-none">
          {(() => {
            // Back / Forward / Home + "Portal › Section" on every section.
            const homeId = homeItem || navItems[0]?.id;
            const goHome = () => onSelect && homeId && onSelect(homeId);
            const crumbs = [{ label: tx(title_ar, title_en), onClick: goHome }];
            if (currentNav && currentNav.id !== homeId) crumbs.push({ label: tx(currentNav.label_ar, currentNav.label_en) });
            return <PageNavBar crumbs={crumbs} home={onSelect && homeId ? { onClick: goHome, label: tx('الرئيسية', 'Overview') } : undefined} />;
          })()}
          {children}
        </main>

        {/* Minimal Institutional Footer */}
        <footer className="py-4 px-6 text-center text-[11px] text-slate-500 font-sans border-t border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface">
          {tx(
            'دار العلوم كاشف الهدى العربية · مدلي بالي، سريلانكا · البوابة المعتمدة © 2026',
            'D.U. Kashiful Hudha Arabic College · Mudalaippali, Sri Lanka · Institutional Portal © 2026'
          )}
        </footer>
      </div>

      {/* Quick-Jump Command Palette (Ctrl+K / Cmd+K) */}
      {cmdOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={tx('الانتقال السريع', 'Quick navigation')}
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 backdrop-blur-xs pt-20 px-4"
          onClick={() => setCmdOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-dark-border px-4 py-3">
              <Icon name="search" className="text-[18px] text-slate-400" aria-hidden="true" />
              <input
                type="search"
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder={tx('انتقل إلى قسم أو رابط…', 'Jump to a section or workspace…')}
                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-dark-text-primary placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCmdOpen(false)}
                className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
              >
                {'Esc'}
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto p-2 space-y-0.5">
              {cmdMatches.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-slate-500">
                  {tx('لا توجد نتائج مطابقة', 'No matching sections')}
                </p>
              ) : (
                cmdMatches.map((entry) => (
                  <button
                    key={entry.kind === 'tab' ? `tab:${entry.id}` : `link:${entry.to}`}
                    type="button"
                    onClick={() => {
                      setCmdOpen(false);
                      if (entry.kind === 'tab') onSelect?.(entry.id);
                      else navigate(entry.to);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-start text-xs font-medium text-slate-700 dark:text-dark-text-primary hover:bg-emerald-50 hover:text-emerald-900"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon name={entry.icon} className="text-[18px] text-emerald-700 shrink-0" aria-hidden="true" />
                      <span className="truncate font-semibold">{entry.label}</span>
                    </span>
                    {entry.group && <span className="text-[10px] text-slate-400 shrink-0">{entry.group}</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
