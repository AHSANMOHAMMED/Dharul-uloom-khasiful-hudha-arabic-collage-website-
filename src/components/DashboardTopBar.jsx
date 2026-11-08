import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import LanguageSelect from './LanguageSelect';
import { tx } from '../lib/tx';

export default function DashboardTopBar() {
  const { user, isAdmin, isSuperAdmin, isLibrarian, isTutor, isStudent, isParent, isTreasurer, isPrincipal, isVP, isEmployee, logout } = useAuth();
  useTranslation(); // re-render on language change
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  // Determine primary role label & color
  let roleLabel = tx('مستخدم البوابة', 'Portal User');
  let roleBg = 'bg-[#E3F1EA] text-[#11694A] border-[#11694A]/20';

  if (isSuperAdmin) {
    roleLabel = tx('المدير العام الأعلى', 'Super Admin');
    roleBg = 'bg-[#E3F1EA] text-[#0B3B2E] border-[#0B3B2E]/30 font-bold';
  } else if (isAdmin) {
    roleLabel = tx('مسؤول النظام', 'Site Admin');
    roleBg = 'bg-[#E3F1EA] text-[#11694A] border-[#11694A]/25';
  } else if (isPrincipal) {
    roleLabel = tx('مكتب المدير', 'Principal');
    roleBg = 'bg-[#E3F1EA] text-[#0B3B2E] border-[#0B3B2E]/25';
  } else if (isVP) {
    roleLabel = tx('نائب المدير', 'Vice Principal');
    roleBg = 'bg-[#EEF2FF] text-[#3730A3] border-[#3730A3]/25';
  } else if (isTreasurer) {
    roleLabel = tx('أمين الصندوق', 'Treasurer');
    roleBg = 'bg-[#FEF9EE] text-[#C29A3A] border-[#C29A3A]/30';
  } else if (isLibrarian) {
    roleLabel = tx('أمين المكتبة', 'Librarian');
    roleBg = 'bg-[#FEF9EE] text-[#C29A3A] border-[#C29A3A]/30';
  } else if (isTutor) {
    roleLabel = tx('أستاذ / مدرّس', 'Faculty Tutor');
    roleBg = 'bg-[#E0F2F1] text-[#0F7C86] border-[#0F7C86]/25';
  } else if (isParent) {
    roleLabel = tx('ولي أمر', 'Parent Guardian');
    roleBg = 'bg-[#FFFBEB] text-[#B45309] border-[#B45309]/25';
  } else if (isStudent) {
    roleLabel = tx('طالب', 'Student');
    roleBg = 'bg-[#E3F1EA] text-[#11694A] border-[#11694A]/25';
  }

  // Workspace shortcuts available to the current user
  const shortcuts = [];
  if (isAdmin) {
    shortcuts.push({ to: '/admin', label: tx('لوحة الإدارة', 'Admin Console'), icon: 'admin_panel_settings' });
    shortcuts.push({ to: '/erp', label: tx('نظام ERP', 'Campus ERP'), icon: 'domain' });
    shortcuts.push({ to: '/library-admin', label: tx('إدارة المكتبة', 'Maktabah Admin'), icon: 'local_library' });
  } else {
    if (isEmployee) {
      shortcuts.push({ to: '/erp', label: tx('نظام ERP', 'ERP'), icon: 'domain' });
    }
    if (isLibrarian) {
      shortcuts.push({ to: '/library-admin', label: tx('إدارة المكتبة', 'Maktabah'), icon: 'local_library' });
    }
    shortcuts.push({ to: '/dashboard', label: tx('لوحتي', 'My Desk'), icon: 'dashboard' });
  }

  const isActive = (to) => location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E8E1D0] shadow-[0_1px_6px_rgba(11,59,46,0.03)]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Left: Brand Identity + Current Portal Pill */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <Link
            to={isAdmin ? '/admin' : '/dashboard'}
            className="flex items-center gap-2.5 sm:gap-3 group"
            title={tx('العودة إلى لوحة التحكم', 'Back to dashboard')}
          >
            <img
              src="/images/logo.svg"
              alt={tx('شعار كاشف الهدى', 'Kashiful Hudha Emblem')}
              className="w-9 h-9 object-contain rounded-lg border border-[#E8E1D0] shadow-xs group-hover:border-[#11694A] transition-colors"
            />
            <div className="flex flex-col">
              <span className="font-serif text-sm sm:text-base font-bold text-[#0B3B2E] leading-tight">
                {tx('دار العلوم كاشف الهدى', 'Dharul Uloom Kashiful Hudha')}
              </span>
              <span className="text-[11px] text-[#4A5E56] font-sans hidden sm:inline">
                {tx('البوابة الأكاديمية والإدارية الموحدة', 'Unified Institutional Workspace')}
              </span>
            </div>
          </Link>

          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] border ${roleBg}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80"></span>
            {roleLabel}
          </span>
        </div>

        {/* Center: Internal Workspace Navigation (NO public marketing links) */}
        {shortcuts.length > 0 && (
          <nav className="hidden 2xl:flex items-center gap-1 bg-[#FBF8F0] p-1 rounded-xl border border-[#E8E1D0]" aria-label={tx('روابط مساحة العمل', 'Workspace Links')}>
            {shortcuts.map((s) => {
              const active = isActive(s.to);
              return (
                <Link
                  key={s.to}
                  to={s.to}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    active
                      ? 'bg-[#0B3B2E] text-white shadow-xs'
                      : 'text-[#4A5E56] hover:text-[#0B3B2E] hover:bg-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{s.icon}</span>
                  <span>{s.label}</span>
                </Link>
              );
            })}
            <Link
              to="/"
              title={tx('الموقع العام', 'Public website')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#4A5E56] hover:text-[#0B3B2E] hover:bg-white transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">{'public'}</span>
              <span className="hidden lg:inline">{tx('الموقع', 'Website')}</span>
            </Link>
          </nav>
        )}

        {/* Right: Trilingual Switcher, Notifications, User Badge & Logout */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <LanguageSelect className="text-xs bg-white border border-[#E8E1D0] text-[#0B3B2E] py-1 px-2 rounded-lg" />
          <Link to="/messages" aria-label={tx('الرسائل', 'Messages')} title={tx('الرسائل', 'Messages')} className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E8E1D0] text-[#0B3B2E] hover:bg-[#FBF8F0]">
            <span className="material-symbols-outlined text-[18px]">forum</span>
          </Link>
          
          <NotificationBell />

          {/* User Name & Initial */}
          <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-[#E8E1D0]">
            <div className="w-8 h-8 rounded-full bg-[#E3F1EA] text-[#11694A] font-serif font-bold text-xs flex items-center justify-center border border-[#11694A]/20">
              {(user?.username || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-[#0B3B2E] max-w-[130px] truncate leading-tight">
                {user?.username || user?.email}
              </span>
              <span className="text-[10px] text-[#4A5E56] font-mono leading-none">
                {user?.indexNumber || user?.role}
              </span>
            </div>
          </div>

          <Link
            to="/account/security"
            title={tx('الأمان وتسجيل الدخول', 'Security & sign-in')}
            aria-label={tx('الأمان وتسجيل الدخول', 'Security & sign-in')}
            className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-[10px] border border-[#E8E1D0] text-[#0B3B2E] hover:bg-[#FBF8F0]"
          >
            <span className="material-symbols-outlined text-[18px]">{'shield_person'}</span>
          </Link>

          {/* Logout Button */}
          <button
            type="button"
            onClick={logout}
            title={tx('تسجيل الخروج', 'Sign out')}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] bg-[#FEE2E2]/60 hover:bg-[#FEE2E2] text-[#991B1B] text-xs font-semibold border border-[#991B1B]/20 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">{'logout'}</span>
            <span className="hidden sm:inline">{tx('خروج', 'Logout')}</span>
          </button>

          {/* Mobile workspace menu toggle */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="workspace-mobile-menu"
            aria-label={tx('قائمة مساحة العمل', 'Workspace menu')}
            className="2xl:hidden inline-flex items-center justify-center w-9 h-9 rounded-[10px] border border-[#E8E1D0] text-[#0B3B2E] hover:bg-[#FBF8F0]"
          >
            <span className="material-symbols-outlined text-[22px]">{menuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>

      </div>

      {menuOpen && (
        <nav
          id="workspace-mobile-menu"
          className="2xl:hidden border-t border-[#E8E1D0] bg-white px-4 py-3 space-y-1 shadow-[0_6px_16px_rgba(11,59,46,0.06)]"
          aria-label={tx('روابط مساحة العمل', 'Workspace Links')}
        >
          <div className="px-3 pb-2 mb-1 border-b border-[#E8E1D0]/70">
            <div className="text-sm font-semibold text-[#0B3B2E] truncate">{user?.username || user?.email}</div>
            <div className="text-[11px] text-[#4A5E56] font-mono">{user?.indexNumber || user?.email}</div>
          </div>
          {shortcuts.map((s) => {
            const active = isActive(s.to);
            return (
              <Link
                key={s.to}
                to={s.to}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  active ? 'bg-[#E3F1EA] text-[#11694A] font-semibold' : 'text-[#14201B] hover:bg-[#FBF8F0]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                <span>{s.label}</span>
              </Link>
            );
          })}
          <Link to="/" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-[#14201B] hover:bg-[#FBF8F0]">
            <span className="material-symbols-outlined text-[18px]">{'public'}</span>
            <span>{tx('الموقع العام', 'Public website')}</span>
          </Link>
          <Link to="/account/security" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-[#14201B] hover:bg-[#FBF8F0]">
            <span className="material-symbols-outlined text-[18px]">{'shield_person'}</span>
            <span>{tx('الأمان وتسجيل الدخول', 'Security & sign-in')}</span>
          </Link>
          <Link to="/library" className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-[#14201B] hover:bg-[#FBF8F0]">
            <span className="material-symbols-outlined text-[18px]">{'menu_book'}</span>
            <span>{tx('المكتبة الرقمية', 'Digital Library')}</span>
          </Link>
        </nav>
      )}
    </header>
  );
}

