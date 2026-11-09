import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import LanguageSelect from './LanguageSelect';
import KhatamPattern from './KhatamPattern';
import { tx } from '../lib/tx';

/**
 * DashboardSidebarLayout
 * Unified institutional sidebar layout for all role-based workspaces.
 * Complies with Modern Manuscript design system:
 * - #FBF8F0 Parchment background
 * - #FFFFFF Paper cards
 * - #E8E1D0 Sand borders
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
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, isAdmin, isEmployee, isLibrarian, isParent } = useAuth();
  useTranslation();
  const location = useLocation();

  // Standard institutional quick links across workspaces
  const defaultQuickLinks = [];
  if (isAdmin) {
    if (location.pathname !== '/admin') defaultQuickLinks.push({ to: '/admin', label_en: 'Admin Console', label_ar: 'لوحة الإدارة', icon: 'admin_panel_settings' });
    if (location.pathname !== '/erp') defaultQuickLinks.push({ to: '/erp', label_en: 'Campus ERP', label_ar: 'نظام ERP', icon: 'domain' });
    if (location.pathname !== '/library-admin') defaultQuickLinks.push({ to: '/library-admin', label_en: 'Maktabah Admin', label_ar: 'إدارة المكتبة', icon: 'local_library' });
  } else {
    if (isEmployee && location.pathname !== '/erp') {
      defaultQuickLinks.push({ to: '/erp', label_en: 'Campus ERP', label_ar: 'نظام ERP', icon: 'domain' });
    }
    if (isLibrarian && location.pathname !== '/library-admin') {
      defaultQuickLinks.push({ to: '/library-admin', label_en: 'Maktabah Admin', label_ar: 'إدارة المكتبة', icon: 'local_library' });
    }
  }

  const effectiveQuickLinks = quickLinks.length > 0 ? quickLinks : defaultQuickLinks;

  // Active item details for breadcrumb
  const currentNav = navItems.find((n) => n.id === activeItem);

  return (
    <div className="min-h-screen bg-[#FBF8F0] text-[#14201B] flex relative overflow-hidden" dir={tx('rtl', 'ltr')}>
      
      {/* Background Watermark (Page-Wide) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <KhatamPattern className="opacity-[0.035]" strokeColor="#0B3B2E" id="workspace-sidebar-khatam" />
      </div>

      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-[#0B3B2E]/50 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Fixed Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`fixed top-0 bottom-0 start-0 z-50 w-72 bg-white border-e border-[#E8E1D0] flex flex-col shadow-[2px_0_12px_rgba(11,59,46,0.04)] transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Sidebar Header: College Crest & Institutional Title */}
        <div className="p-5 border-b border-[#E8E1D0] relative overflow-hidden">
          <div className="flex items-center gap-3.5">
            <Link to="/" className="shrink-0 group" title={tx('الصفحة الرئيسية', 'Home')}>
              <img
                src="/images/logo.svg"
                alt={tx('شعار دار العلوم كاشف الهدى', 'D.U. Kashiful Hudha Arabic College Crest')}
                className="w-12 h-12 object-contain rounded-xl border border-[#E8E1D0] p-0.5 bg-[#FBF8F0] shadow-xs group-hover:border-[#11694A] transition-colors"
              />
            </Link>

            <div className="flex flex-col min-w-0">
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
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleBadge.color || 'bg-[#E3F1EA] text-[#0B3B2E] border-[#0B3B2E]/20'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80"></span>
              {tx(roleBadge.text_ar, roleBadge.text_en)}
            </span>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1 rounded-lg text-[#4A5E56] hover:bg-[#FBF8F0] hover:text-[#0B3B2E]"
              aria-label={tx('إغلاق القائمة الجانبية', 'Close sidebar')}
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Multi-role Switcher (if assigned) */}
        {roleSwitcher && (
          <div className="px-4 py-2 bg-[#FBF8F0] border-b border-[#E8E1D0]">
            {roleSwitcher}
          </div>
        )}

        {/* Sidebar Nav Items (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 hide-scrollbar">
          <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#4A5E56] font-sans">
            {tx('أقسام وميزات البوابة', 'Workspace Features')}
          </div>

          {navItems.map((item) => {
            const isActive = activeItem === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (onSelect) onSelect(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-start transition-all ${
                  isActive
                    ? 'bg-[#0B3B2E] text-white shadow-xs'
                    : 'text-[#4A5E56] hover:text-[#0B3B2E] hover:bg-[#FBF8F0]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`material-symbols-outlined text-[19px] shrink-0 ${
                      isActive ? 'text-[#C29A3A]' : 'text-[#4A5E56]'
                    }`}
                  >
                    {item.icon || 'circle'}
                  </span>
                  <span className="truncate">{tx(item.label_ar, item.label_en)}</span>
                </div>

                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold shrink-0 ${
                      isActive
                        ? 'bg-[#C29A3A] text-[#0B3B2E]'
                        : item.badgeTone === 'emerald'
                        ? 'bg-[#E3F1EA] text-[#11694A]'
                        : 'bg-[#FEE2E2] text-[#B91C1C]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Institutional Shortcuts (ERP, Maktabah, Admin) */}
          {effectiveQuickLinks.length > 0 && (
            <div className="pt-4 mt-2 border-t border-[#E8E1D0]">
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#4A5E56] font-sans">
                {tx('الروابط المؤسسية', 'Institutional Workspaces')}
              </div>
              {effectiveQuickLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#4A5E56] hover:text-[#0B3B2E] hover:bg-[#FBF8F0] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-[#11694A]">
                    {link.icon}
                  </span>
                  <span>{tx(link.label_ar, link.label_en)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Footer: Profile Card + Tools + Logout */}
        <div className="p-3 border-t border-[#E8E1D0] bg-[#FDFBF7] space-y-2.5">
          {/* User Profile Card */}
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-[#E8E1D0]">
            <div className="w-9 h-9 rounded-lg bg-[#E3F1EA] text-[#11694A] font-serif font-bold text-sm flex items-center justify-center shrink-0 border border-[#11694A]/20">
              {(user?.username || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-[#0B3B2E] truncate leading-tight">
                {user?.username || user?.email}
              </span>
              <span className="text-[10px] text-[#4A5E56] font-mono truncate leading-none mt-0.5">
                {user?.indexNumber || user?.role || 'authorized'}
              </span>
            </div>
          </div>

          {/* Tools strip — language only here; notifications sit in the sticky header */}
          <div className="flex items-center justify-between gap-1.5 pt-1">
            <LanguageSelect className="text-[11px] bg-white border border-[#E8E1D0] text-[#0B3B2E] py-1 px-2 rounded-lg flex-1" />
            <button
              type="button"
              onClick={logout}
              title={tx('تسجيل الخروج', 'Sign out')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FEE2E2]/70 hover:bg-[#FEE2E2] text-[#991B1B] text-[11px] font-bold border border-[#991B1B]/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">logout</span>
              <span>{tx('خروج', 'Logout')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Workspace Body ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ms-72 relative z-10">
        
        {/* Top Utility Header */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E8E1D0] px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-[#E8E1D0] text-[#0B3B2E] hover:bg-[#FBF8F0]"
              aria-label={tx('فتح القائمة الجانبية', 'Open sidebar menu')}
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>

            {/* Breadcrumb / Title */}
            <div className="flex items-center gap-2 text-xs font-sans">
              <span className="font-serif font-bold text-sm sm:text-base text-[#0B3B2E]">
                {tx(title_ar, title_en)}
              </span>
              {currentNav && (
                <>
                  <span className="text-[#E8E1D0] font-bold">/</span>
                  <span className="text-[#11694A] font-semibold hidden sm:inline">
                    {tx(currentNav.label_ar, currentNav.label_en)}
                  </span>
                </>
              )}
              {roleBadge && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${roleBadge.color || 'bg-[#E3F1EA] text-[#0B3B2E] border-[#0B3B2E]/20'}`}>
                  {tx(roleBadge.text_ar, roleBadge.text_en)}
                </span>
              )}
            </div>
          </div>

          {/* Right Top Header Actions — notifications live here so mobile users can open them without the sidebar */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {topActions}

            <NotificationBell />

            <Link
              to="/messages"
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-[#E8E1D0] bg-white text-[#0B3B2E] hover:bg-[#FBF8F0] shadow-xs"
              title={tx('الرسائل', 'Messages')}
              aria-label={tx('الرسائل', 'Messages')}
            >
              <span className="material-symbols-outlined text-[18px] text-[#11694A]">chat</span>
            </Link>

            {!isParent && (
              <Link
                to="/library"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8E1D0] bg-white text-xs font-semibold text-[#0B3B2E] hover:bg-[#FBF8F0] shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px] text-[#11694A]">auto_stories</span>
                <span>{tx('المكتبة', 'Library')}</span>
              </Link>
            )}

            <button
              type="button"
              onClick={logout}
              title={tx('تسجيل الخروج', 'Sign out')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#FEE2E2]/70 hover:bg-[#FEE2E2] text-[#991B1B] text-xs font-bold border border-[#991B1B]/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span className="hidden sm:inline">{tx('خروج', 'Logout')}</span>
            </button>
          </div>
        </header>

        {/* Scrollable Content Workspace */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Minimal Institutional Footer */}
        <footer className="py-3 px-6 text-center text-[11px] text-[#4A5E56] font-sans border-t border-[#E8E1D0]/60 bg-white/40">
          {tx(
            'دار العلوم كاشف الهدى العربية · مدلي بالي، سريلانكا · البوابة المعتمدة © 2026',
            'D.U. Kashiful Hudha Arabic College · Mudalaippali, Sri Lanka · Institutional Portal © 2026'
          )}
        </footer>
      </div>

    </div>
  );
}
