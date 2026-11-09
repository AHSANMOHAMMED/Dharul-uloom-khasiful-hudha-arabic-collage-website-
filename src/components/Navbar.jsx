import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'
import LanguageSelect from './LanguageSelect'
import { tx } from '../lib/tx'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [mobileAcademicsOpen, setMobileAcademicsOpen] = useState(false)
  const [mobileExploreOpen, setMobileExploreOpen] = useState(false)
  const { t } = useTranslation()
  const location = useLocation()
  const { isAuthenticated, isAdmin, isSuperAdmin, isLibrarian, isEmployee, isParent, isStudent, isTutor, logout } = useAuth()
  const canManageLibrary = isAdmin || isLibrarian
  // E-library is for campus accounts only — not the public site, and not parents.
  const showLibrary = isAuthenticated && !isParent && (isStudent || isTutor || isLibrarian || isAdmin || isEmployee || isSuperAdmin)

  // A section is active on its own page and on any detail page beneath it (/news/:id, /library/:id).
  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(`${path}/`)
  const academicsActive = ['/courses', '/curriculum', '/faculty'].some(isActive)
  const exploreActive = [showLibrary ? '/library' : null, '/gallery', '/news'].filter(Boolean).some(isActive)

  // Close the mobile drawer on navigation (incl. browser back/forward) and on Escape.
  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  return (
    <header className="sticky top-0 z-50 bg-[#fffefa]/95 backdrop-blur-md border-b border-[#e5dfd3] shadow-[0_2px_12px_rgba(14,42,30,0.05)]">
      {/* Single-line sticky bar — no utility ribbon */}
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 min-h-[4.25rem] flex items-center justify-between gap-2 sm:gap-3">
        
        {/* Brand Logo & Name */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group py-1 min-w-0">
          <img 
            src="/images/logo.png" 
            alt={tx('شعار دار العلوم كاشف الهدى', 'D.U. Kashiful Hudha Arabic College Emblem')}
            className="w-10 h-10 sm:w-11 sm:h-11 object-contain rounded-full border border-sand-border shadow-xs group-hover:border-emerald-700 transition-colors bg-white shrink-0"
          />
          <div className="flex flex-col min-w-0">
            <span className="font-serif text-sm sm:text-base lg:text-lg font-bold text-ink-green-900 leading-tight tracking-tight truncate">
              {tx('كاشف الهدى', 'Kashiful Hudha')}
            </span>
            <span className="hidden sm:block text-[10px] lg:text-xs text-ink-text-muted leading-tight font-sans tracking-wide truncate">
              {tx('الكلية العربية · كالبيتيا', 'Arabic College · Kalpitiya')}
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links (Visible on Laptops & Desktops) */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5" aria-label={tx('التنقل الرئيسي', 'Main navigation')}>
          <Link
            to="/"
            className={`px-3 py-2 rounded-lg text-sm transition-all ${
              location.pathname === '/' 
                ? 'text-emerald-700 font-semibold bg-[#eaf1e9]' 
                : 'text-ink-text-secondary hover:text-ink-green-900 hover:bg-[#f4f2ec] font-medium'
            }`}
          >
            {t('nav.home')}
          </Link>

          <Link
            to="/about"
            className={`px-3 py-2 rounded-lg text-sm transition-all ${
              isActive('/about') 
                ? 'text-emerald-700 font-semibold bg-[#eaf1e9]' 
                : 'text-ink-text-secondary hover:text-ink-green-900 hover:bg-[#f4f2ec] font-medium'
            }`}
          >
            {t('nav.about')}
          </Link>

          {/* Academics Dropdown */}
          <div className="relative group py-2">
            <button
              type="button"
              aria-haspopup="true"
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                academicsActive ? 'text-emerald-700 font-semibold bg-[#eaf1e9]' : 'text-ink-text-secondary hover:text-ink-green-900 hover:bg-[#f4f2ec]'
              }`}
            >
              <span>{t('nav.academics')}</span>
              <span className="material-symbols-outlined text-[18px] transition-transform group-hover:rotate-180">{'expand_more'}</span>
            </button>
            <div className="absolute start-0 top-full mt-1 w-52 rounded-[12px] bg-paper-white border border-sand-border shadow-manuscript-md py-2 z-50 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-all">
              <Link
                to="/courses"
                className={`block px-4 py-2.5 text-sm transition-colors hover:bg-mint-wash-100 hover:text-emerald-700 ${
                  isActive('/courses') ? 'text-emerald-700 bg-mint-wash-100/60 font-semibold' : 'text-ink-text-primary'
                }`}
              >
                {t('nav.courses')}
              </Link>
              <Link
                to="/curriculum"
                className={`block px-4 py-2.5 text-sm transition-colors hover:bg-mint-wash-100 hover:text-emerald-700 ${
                  isActive('/curriculum') ? 'text-emerald-700 bg-mint-wash-100/60 font-semibold' : 'text-ink-text-primary'
                }`}
              >
                {t('nav.curriculum')}
              </Link>
              <Link
                to="/faculty"
                className={`block px-4 py-2.5 text-sm transition-colors hover:bg-mint-wash-100 hover:text-emerald-700 ${
                  isActive('/faculty') ? 'text-emerald-700 bg-mint-wash-100/60 font-semibold' : 'text-ink-text-primary'
                }`}
              >
                {t('nav.faculty')}
              </Link>
            </div>
          </div>

          {/* Explore Dropdown */}
          <div className="relative group py-2">
            <button
              type="button"
              aria-haspopup="true"
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                exploreActive ? 'text-emerald-700 font-semibold bg-[#eaf1e9]' : 'text-ink-text-secondary hover:text-ink-green-900 hover:bg-[#f4f2ec]'
              }`}
            >
              <span>{t('nav.explore')}</span>
              <span className="material-symbols-outlined text-[18px] transition-transform group-hover:rotate-180">{'expand_more'}</span>
            </button>
            <div className="absolute start-0 top-full mt-1 w-52 rounded-[12px] bg-paper-white border border-sand-border shadow-manuscript-md py-2 z-50 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-all">
              {showLibrary && (
                <Link
                  to="/library"
                  className={`block px-4 py-2.5 text-sm transition-colors hover:bg-mint-wash-100 hover:text-emerald-700 ${
                    isActive('/library') ? 'text-emerald-700 bg-mint-wash-100/60 font-semibold' : 'text-ink-text-primary'
                  }`}
                >
                  {t('nav.library')}
                </Link>
              )}
              <Link
                to="/gallery"
                className={`block px-4 py-2.5 text-sm transition-colors hover:bg-mint-wash-100 hover:text-emerald-700 ${
                  isActive('/gallery') ? 'text-emerald-700 bg-mint-wash-100/60 font-semibold' : 'text-ink-text-primary'
                }`}
              >
                {t('nav.gallery')}
              </Link>
              <Link
                to="/news"
                className={`block px-4 py-2.5 text-sm transition-colors hover:bg-mint-wash-100 hover:text-emerald-700 ${
                  isActive('/news') ? 'text-emerald-700 bg-mint-wash-100/60 font-semibold' : 'text-ink-text-primary'
                }`}
              >
                {t('nav.news')}
              </Link>
            </div>
          </div>

          <Link
            to="/admissions"
            className={`px-3 py-2 rounded-lg text-sm transition-all ${
              isActive('/admissions') 
                ? 'text-emerald-700 font-semibold bg-[#eaf1e9]' 
                : 'text-ink-text-secondary hover:text-ink-green-900 hover:bg-[#f4f2ec] font-medium'
            }`}
          >
            {t('nav.admissions')}
          </Link>

          <Link
            to="/contact"
            className={`px-3 py-2 rounded-lg text-sm transition-all ${
              isActive('/contact') 
                ? 'text-emerald-700 font-semibold bg-[#eaf1e9]' 
                : 'text-ink-text-secondary hover:text-ink-green-900 hover:bg-[#f4f2ec] font-medium'
            }`}
          >
            {t('nav.contact')}
          </Link>

          {isEmployee && (
            <Link
              to="/erp"
              className={`px-3 py-2 rounded-lg text-sm transition-all font-semibold ${
                isActive('/erp')
                  ? 'text-brass-gold-500 font-bold bg-gold-wash-100/60'
                  : 'text-emerald-700 hover:text-ink-green-900 hover:bg-mint-wash-100'
              }`}
            >
              {tx('نظام الإدارة (ERP)', 'College ERP')}
            </Link>
          )}
        </nav>

        {/* Right Actions: Language Switcher, Notifications, Auth */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          {/* Trilingual Language Selector */}
          <div className="flex items-center">
            <LanguageSelect className="text-xs bg-paper-white border border-sand-border text-ink-green-900 py-1.5 px-2.5 rounded-lg shadow-2xs hover:border-emerald-700 transition-colors" />
          </div>

          {/* Authenticated State vs Public CTA */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2 sm:gap-2.5">
              {!isSuperAdmin && (
                <Link
                  to="/messages"
                  aria-label={tx('الرسائل', 'Messages')}
                  title={tx('الرسائل', 'Messages')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-sand-border px-2.5 text-xs font-semibold text-ink-green-900 hover:bg-mint-wash-100"
                >
                  <span className="material-symbols-outlined text-[18px]">forum</span>
                  <span className="hidden xl:inline">{tx('الرسائل', 'Messages')}</span>
                </Link>
              )}
              <NotificationBell />

              {isSuperAdmin ? (
                <Link
                  to="/platform"
                  className="hidden sm:inline-flex items-center h-9 px-3 rounded-[10px] bg-mint-wash-100 text-emerald-700 text-xs font-semibold border border-emerald-700/20 hover:bg-emerald-700 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] mr-1.5">{'admin_panel_settings'}</span>
                  <span>{tx('المدير العام', 'Super Admin')}</span>
                </Link>
              ) : isAdmin ? (
                <Link
                  to="/admin"
                  className="hidden sm:inline-flex items-center h-9 px-3 rounded-[10px] bg-mint-wash-100 text-emerald-700 text-xs font-semibold border border-emerald-700/20 hover:bg-emerald-700 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] mr-1.5">{'admin_panel_settings'}</span>
                  <span>{tx('لوحة الإدارة', 'Admin')}</span>
                </Link>
              ) : (
                <Link
                  to="/dashboard"
                  className="hidden sm:inline-flex items-center h-9 px-3 rounded-[10px] bg-mint-wash-100 text-emerald-700 text-xs font-semibold border border-emerald-700/20 hover:bg-emerald-700 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] mr-1.5">{'dashboard'}</span>
                  <span>{tx('البوابة', 'My Portal')}</span>
                </Link>
              )}

              {isEmployee && (
                <Link
                  to="/erp"
                  className="hidden xl:inline-flex items-center h-9 px-3 rounded-[10px] bg-sand-border/30 text-ink-green-900 text-xs font-semibold border border-sand-border hover:bg-mint-wash-100 transition-colors"
                >
                  <span>{tx('نظام الإدارة', 'ERP')}</span>
                </Link>
              )}

              {canManageLibrary && (
                <Link
                  to="/library-admin"
                  className="hidden xl:inline-flex items-center h-9 px-3 rounded-[10px] bg-gold-wash-100 text-brass-gold-500 text-xs font-semibold border border-brass-gold-500/20 hover:bg-brass-gold-500 hover:text-white transition-colors"
                >
                  <span>{tx('إدارة المكتبة', 'Maktabah')}</span>
                </Link>
              )}

              <button
                type="button"
                onClick={logout}
                title={tx('تسجيل الخروج', 'Sign out')}
                className="inline-flex items-center justify-center w-9 h-9 rounded-[10px] border border-sand-border text-ink-text-secondary hover:text-feedback-danger hover:border-feedback-danger/30 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">{'logout'}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-2.5">
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center h-9 px-3 rounded-lg text-xs font-semibold text-ink-text-secondary hover:text-ink-green-900 hover:bg-sand-border/30 transition-colors"
              >
                <span>{tx('دخول', 'Sign in')}</span>
              </Link>

              <Link
                to="/admissions"
                className="inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 px-3.5 sm:px-4 rounded-lg bg-[#e77835] hover:bg-[#ce6327] text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] hidden sm:inline">edit_document</span>
                {/* Short label on phones so the menu button stays on screen. */}
                <span className="sm:hidden">{tx('تقديم', 'Apply')}</span>
                <span className="hidden sm:inline">{tx('التقديم للقبول', 'Apply for Admission')}</span>
              </Link>
            </div>
          )}

          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-sand-border text-ink-text-primary hover:bg-sand-border/30 focus:outline-none transition-colors"
            aria-label={tx('فتح/إغلاق القائمة', 'Toggle navigation menu')}
          >
            <span className="material-symbols-outlined text-[22px]">
              {isOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {isOpen && (
        <div className="lg:hidden bg-paper-white border-b border-sand-border px-4 pt-3 pb-6 space-y-2 shadow-manuscript-lg">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className={`block px-3 py-2 rounded-lg text-sm font-medium ${
              location.pathname === '/' ? 'bg-mint-wash-100 text-emerald-700 font-semibold' : 'text-ink-text-primary'
            }`}
          >
            {t('nav.home')}
          </Link>

          <Link
            to="/about"
            onClick={() => setIsOpen(false)}
            className={`block px-3 py-2 rounded-lg text-sm font-medium ${
              isActive('/about') ? 'bg-mint-wash-100 text-emerald-700 font-semibold' : 'text-ink-text-primary'
            }`}
          >
            {t('nav.about')}
          </Link>

          {/* Mobile Academics Submenu */}
          <div>
            <button
              type="button"
              onClick={() => setMobileAcademicsOpen(!mobileAcademicsOpen)}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium text-ink-text-primary"
            >
              <span>{t('nav.academics')}</span>
              <span className="material-symbols-outlined text-[18px]">
                {mobileAcademicsOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {mobileAcademicsOpen && (
              <div className="ps-4 space-y-1 mt-1 border-s-2 border-sand-border ms-3">
                <Link
                  to="/courses"
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-1.5 text-sm text-ink-text-secondary hover:text-emerald-700"
                >
                  {t('nav.courses')}
                </Link>
                <Link
                  to="/curriculum"
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-1.5 text-sm text-ink-text-secondary hover:text-emerald-700"
                >
                  {t('nav.curriculum')}
                </Link>
                <Link
                  to="/faculty"
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-1.5 text-sm text-ink-text-secondary hover:text-emerald-700"
                >
                  {t('nav.faculty')}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Explore Submenu */}
          <div>
            <button
              type="button"
              onClick={() => setMobileExploreOpen(!mobileExploreOpen)}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium text-ink-text-primary"
            >
              <span>{t('nav.explore')}</span>
              <span className="material-symbols-outlined text-[18px]">
                {mobileExploreOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {mobileExploreOpen && (
              <div className="ps-4 space-y-1 mt-1 border-s-2 border-sand-border ms-3">
                {showLibrary && (
                  <Link
                    to="/library"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-1.5 text-sm text-ink-text-secondary hover:text-emerald-700"
                  >
                    {t('nav.library')}
                  </Link>
                )}
                <Link
                  to="/gallery"
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-1.5 text-sm text-ink-text-secondary hover:text-emerald-700"
                >
                  {t('nav.gallery')}
                </Link>
                <Link
                  to="/news"
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-1.5 text-sm text-ink-text-secondary hover:text-emerald-700"
                >
                  {t('nav.news')}
                </Link>
              </div>
            )}
          </div>

          <Link
            to="/admissions"
            onClick={() => setIsOpen(false)}
            className={`block px-3 py-2 rounded-lg text-sm font-medium ${
              isActive('/admissions') ? 'bg-mint-wash-100 text-emerald-700 font-semibold' : 'text-ink-text-primary'
            }`}
          >
            {t('nav.admissions')}
          </Link>

          <Link
            to="/contact"
            onClick={() => setIsOpen(false)}
            className={`block px-3 py-2 rounded-lg text-sm font-medium ${
              isActive('/contact') ? 'bg-mint-wash-100 text-emerald-700 font-semibold' : 'text-ink-text-primary'
            }`}
          >
            {t('nav.contact')}
          </Link>

          {isEmployee && (
            <Link
              to="/erp"
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-semibold bg-mint-wash-100 text-emerald-700"
            >
              {tx('نظام الإدارة (ERP)', 'College ERP')}
            </Link>
          )}

          <div className="flex items-center justify-between border-y border-sand-border py-3 sm:hidden">
            <span className="text-sm font-medium text-ink-text-secondary">{tx('اللغة', 'Language')}</span>
            <LanguageSelect className="text-xs bg-paper-white border border-sand-border text-ink-green-900 py-1 px-2 rounded-lg" />
          </div>

          <div className="pt-3 border-t border-sand-border flex flex-col gap-2">
            {isAuthenticated ? (
              <>
                <Link
                  to={isSuperAdmin ? "/platform" : isAdmin ? "/admin" : "/dashboard"}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center h-10 rounded-[10px] bg-emerald-700 text-white font-medium text-sm"
                >
                  {isAdmin ? tx('لوحة الإدارة', 'Admin Console') : tx('بوابة المستخدم', 'Go to Portal')}
                </Link>
                {canManageLibrary && (
                  <Link
                    to="/library-admin"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center h-10 rounded-[10px] bg-gold-wash-100 text-brass-gold-500 font-medium text-sm border border-brass-gold-500/20"
                  >
                    {tx('إدارة المكتبة', 'Library Admin')}
                  </Link>
                )}
                <Link
                  to="/account/security"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center h-10 rounded-[10px] border border-sand-border text-ink-text-primary font-medium text-sm"
                >
                  {tx('الأمان وتسجيل الدخول', 'Security & sign-in')}
                </Link>
                <button
                  type="button"
                  onClick={() => { logout(); setIsOpen(false); }}
                  className="flex items-center justify-center h-10 rounded-[10px] border border-sand-border text-feedback-danger font-medium text-sm"
                >
                  {tx('تسجيل الخروج', 'Sign Out')}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center h-10 rounded-[10px] border border-sand-border text-ink-text-primary font-medium text-sm"
                >
                  {tx('دخول', 'Sign In')}
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center h-10 rounded-[10px] border border-sand-border text-ink-text-primary font-medium text-sm"
                >
                  {tx('تسجيل جديد', 'Register Account')}
                </Link>
                <Link
                  to="/admissions"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center h-10 rounded-[10px] bg-[#e77835] hover:bg-[#ce6327] text-white font-medium text-sm"
                >
                  {tx('التقديم للقبول', 'Apply for Admission')}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
