import { useState } from 'react'
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
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const { isAuthenticated, isAdmin, isLibrarian, isEmployee, isStaff, logout, user } = useAuth()
  const canManageLibrary = isAdmin || isLibrarian || isStaff

  const academicsActive = ['/courses', '/curriculum', '/faculty'].includes(location.pathname)
  const exploreActive = ['/library', '/gallery', '/news'].includes(location.pathname)

  const isRTL = i18n.language === 'ar'

  return (
    <header className="sticky top-0 z-50 bg-paper-white/95 backdrop-blur-sm border-b border-sand-border shadow-[0_1px_8px_rgba(11,59,46,0.04)]">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Brand Logo & Name */}
        <Link to="/" className="flex items-center gap-3 shrink-0 group">
          <img 
            src="/images/logo.jpg" 
            alt="Kashiful Hudha Emblem" 
            className="w-10 h-10 object-contain rounded-lg border border-sand-border shadow-xs group-hover:border-emerald-700 transition-colors"
          />
          <div className="flex flex-col">
            <span className="font-serif text-base sm:text-lg font-semibold text-ink-green-900 leading-tight tracking-tight">
              {tx('دار العلوم كاشف الهدى', 'Dharul Uloom Kashiful Hudha')}
            </span>
            <span className="text-xs text-ink-text-muted leading-none hidden sm:inline font-arabic" dir="rtl">
              كاشف الهدى العربية
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden xl:flex items-center gap-6" aria-label="Main Navigation">
          <Link
            to="/"
            className={`text-sm transition-colors ${
              location.pathname === '/' 
                ? 'text-emerald-700 font-semibold' 
                : 'text-ink-text-secondary hover:text-ink-green-900 font-medium'
            }`}
          >
            {tx('الرئيسية', t('nav.home') || 'Home')}
          </Link>

          <Link
            to="/about"
            className={`text-sm transition-colors ${
              location.pathname === '/about' 
                ? 'text-emerald-700 font-semibold' 
                : 'text-ink-text-secondary hover:text-ink-green-900 font-medium'
            }`}
          >
            {tx('من نحن', t('nav.about') || 'About')}
          </Link>

          {/* Academics Dropdown */}
          <div className="relative group py-2">
            <button
              type="button"
              className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                academicsActive ? 'text-emerald-700 font-semibold' : 'text-ink-text-secondary hover:text-ink-green-900'
              }`}
            >
              <span>{tx('الدراسة', t('nav.academics') || 'Academics')}</span>
              <span className="material-symbols-outlined text-[18px] transition-transform group-hover:rotate-180">
                expand_more
              </span>
            </button>
            <div className="absolute left-0 top-full mt-1 w-48 rounded-[12px] bg-paper-white border border-sand-border shadow-manuscript-md py-2 z-50 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all">
              <Link
                to="/courses"
                className={`block px-4 py-2 text-sm transition-colors hover:bg-mint-wash-100 hover:text-emerald-700 ${
                  location.pathname === '/courses' ? 'text-emerald-700 bg-mint-wash-100/60 font-semibold' : 'text-ink-text-primary'
                }`}
              >
                {tx('المساقات الدراسية', t('nav.courses') || 'Courses')}
              </Link>
              <Link
                to="/curriculum"
                className={`block px-4 py-2 text-sm transition-colors hover:bg-mint-wash-100 hover:text-emerald-700 ${
                  location.pathname === '/curriculum' ? 'text-emerald-700 bg-mint-wash-100/60 font-semibold' : 'text-ink-text-primary'
                }`}
              >
                {tx('المنهج الدراسي', t('nav.curriculum') || 'Curriculum')}
              </Link>
              <Link
                to="/faculty"
                className={`block px-4 py-2 text-sm transition-colors hover:bg-mint-wash-100 hover:text-emerald-700 ${
                  location.pathname === '/faculty' ? 'text-emerald-700 bg-mint-wash-100/60 font-semibold' : 'text-ink-text-primary'
                }`}
              >
                {tx('هيئة التدريس', t('nav.faculty') || 'Faculty')}
              </Link>
            </div>
          </div>

          {/* Explore Dropdown */}
          <div className="relative group py-2">
            <button
              type="button"
              className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                exploreActive ? 'text-emerald-700 font-semibold' : 'text-ink-text-secondary hover:text-ink-green-900'
              }`}
            >
              <span>{tx('استكشف', t('nav.explore') || 'Explore')}</span>
              <span className="material-symbols-outlined text-[18px] transition-transform group-hover:rotate-180">
                expand_more
              </span>
            </button>
            <div className="absolute left-0 top-full mt-1 w-48 rounded-[12px] bg-paper-white border border-sand-border shadow-manuscript-md py-2 z-50 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all">
              <Link
                to="/library"
                className={`block px-4 py-2 text-sm transition-colors hover:bg-mint-wash-100 hover:text-emerald-700 ${
                  location.pathname === '/library' ? 'text-emerald-700 bg-mint-wash-100/60 font-semibold' : 'text-ink-text-primary'
                }`}
              >
                {tx('المكتبة الرقمية', t('nav.library') || 'Islamic Library')}
              </Link>
              <Link
                to="/gallery"
                className={`block px-4 py-2 text-sm transition-colors hover:bg-mint-wash-100 hover:text-emerald-700 ${
                  location.pathname === '/gallery' ? 'text-emerald-700 bg-mint-wash-100/60 font-semibold' : 'text-ink-text-primary'
                }`}
              >
                {tx('معرض الصور', t('nav.gallery') || 'Campus Gallery')}
              </Link>
              <Link
                to="/news"
                className={`block px-4 py-2 text-sm transition-colors hover:bg-mint-wash-100 hover:text-emerald-700 ${
                  location.pathname === '/news' ? 'text-emerald-700 bg-mint-wash-100/60 font-semibold' : 'text-ink-text-primary'
                }`}
              >
                {tx('الأخبار والفعاليات', t('nav.news') || 'News & Events')}
              </Link>
            </div>
          </div>

          <Link
            to="/admissions"
            className={`text-sm transition-colors ${
              location.pathname === '/admissions' 
                ? 'text-emerald-700 font-semibold' 
                : 'text-ink-text-secondary hover:text-ink-green-900 font-medium'
            }`}
          >
            {tx('القبول والتسجيل', t('nav.admissions') || 'Admissions')}
          </Link>

          <Link
            to="/contact"
            className={`text-sm transition-colors ${
              location.pathname === '/contact' 
                ? 'text-emerald-700 font-semibold' 
                : 'text-ink-text-secondary hover:text-ink-green-900 font-medium'
            }`}
          >
            {tx('اتصل بنا', t('nav.contact') || 'Contact')}
          </Link>

          {isEmployee && (
            <Link
              to="/erp"
              className={`text-sm transition-colors font-semibold ${
                location.pathname.startsWith('/erp')
                  ? 'text-brass-gold-500 font-bold'
                  : 'text-emerald-700 hover:text-ink-green-900'
              }`}
            >
              {tx('نظام الإدارة (ERP)', 'College ERP')}
            </Link>
          )}
        </nav>

        {/* Right Actions: Language Switcher, Notifications, Auth */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          {/* Trilingual Language Selector */}
          <LanguageSelect className="text-xs bg-paper-white border border-sand-border text-ink-green-900 py-1 px-2 rounded-lg" />

          {/* Authenticated State vs Public CTA */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <NotificationBell />

              {isAdmin ? (
                <Link
                  to="/admin"
                  className="hidden sm:inline-flex items-center h-9 px-3.5 rounded-[10px] bg-mint-wash-100 text-emerald-700 text-xs font-semibold border border-emerald-700/20 hover:bg-emerald-700 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] mr-1.5">admin_panel_settings</span>
                  <span>{tx('لوحة الإدارة', 'Admin Console')}</span>
                </Link>
              ) : (
                <Link
                  to="/dashboard"
                  className="hidden sm:inline-flex items-center h-9 px-3.5 rounded-[10px] bg-mint-wash-100 text-emerald-700 text-xs font-semibold border border-emerald-700/20 hover:bg-emerald-700 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] mr-1.5">dashboard</span>
                  <span>{tx('البوابة', 'My Portal')}</span>
                </Link>
              )}

              {isEmployee && (
                <Link
                  to="/erp"
                  className="hidden lg:inline-flex items-center h-9 px-3 rounded-[10px] bg-sand-border/30 text-ink-green-900 text-xs font-semibold border border-sand-border hover:bg-mint-wash-100 transition-colors"
                >
                  <span>{tx('نظام الإدارة', 'ERP')}</span>
                </Link>
              )}

              {canManageLibrary && (
                <Link
                  to="/library-admin"
                  className="hidden md:inline-flex items-center h-9 px-3 rounded-[10px] bg-gold-wash-100 text-brass-gold-500 text-xs font-semibold border border-brass-gold-500/20 hover:bg-brass-gold-500 hover:text-white transition-colors"
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
                <span className="material-symbols-outlined text-[18px]">logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/login"
                className="hidden md:inline-flex items-center h-9 px-3 rounded-[10px] text-xs font-medium text-ink-text-secondary hover:text-ink-green-900 hover:bg-sand-border/30 transition-colors"
              >
                <span>{tx('دخول', 'Sign in')}</span>
              </Link>

              <Link
                to="/admissions"
                className="inline-flex items-center justify-center h-9 px-3.5 sm:px-4 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 active:bg-ink-green-900 text-white text-xs font-medium shadow-xs transition-colors"
              >
                <span>{tx('التقديم للقبول', 'Apply for Admission')}</span>
              </Link>
            </div>
          )}

          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="xl:hidden inline-flex items-center justify-center w-9 h-9 rounded-[10px] border border-sand-border text-ink-text-primary hover:bg-sand-border/30 focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            <span className="material-symbols-outlined text-[22px]">
              {isOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {isOpen && (
        <div className="xl:hidden bg-paper-white border-b border-sand-border px-4 pt-3 pb-6 space-y-2 shadow-manuscript-lg">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className={`block px-3 py-2 rounded-lg text-sm font-medium ${
              location.pathname === '/' ? 'bg-mint-wash-100 text-emerald-700 font-semibold' : 'text-ink-text-primary'
            }`}
          >
            {tx('الرئيسية', t('nav.home') || 'Home')}
          </Link>

          <Link
            to="/about"
            onClick={() => setIsOpen(false)}
            className={`block px-3 py-2 rounded-lg text-sm font-medium ${
              location.pathname === '/about' ? 'bg-mint-wash-100 text-emerald-700 font-semibold' : 'text-ink-text-primary'
            }`}
          >
            {tx('من نحن', t('nav.about') || 'About')}
          </Link>

          {/* Mobile Academics Submenu */}
          <div>
            <button
              type="button"
              onClick={() => setMobileAcademicsOpen(!mobileAcademicsOpen)}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium text-ink-text-primary"
            >
              <span>{tx('الدراسة', t('nav.academics') || 'Academics')}</span>
              <span className="material-symbols-outlined text-[18px]">
                {mobileAcademicsOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {mobileAcademicsOpen && (
              <div className="pl-4 space-y-1 mt-1 border-l-2 border-sand-border ml-3">
                <Link
                  to="/courses"
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-1.5 text-sm text-ink-text-secondary hover:text-emerald-700"
                >
                  {tx('المساقات', t('nav.courses') || 'Courses')}
                </Link>
                <Link
                  to="/curriculum"
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-1.5 text-sm text-ink-text-secondary hover:text-emerald-700"
                >
                  {tx('المنهج', t('nav.curriculum') || 'Curriculum')}
                </Link>
                <Link
                  to="/faculty"
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-1.5 text-sm text-ink-text-secondary hover:text-emerald-700"
                >
                  {tx('هيئة التدريس', t('nav.faculty') || 'Faculty')}
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
              <span>{tx('استكشف', t('nav.explore') || 'Explore')}</span>
              <span className="material-symbols-outlined text-[18px]">
                {mobileExploreOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {mobileExploreOpen && (
              <div className="pl-4 space-y-1 mt-1 border-l-2 border-sand-border ml-3">
                <Link
                  to="/library"
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-1.5 text-sm text-ink-text-secondary hover:text-emerald-700"
                >
                  {tx('المكتبة', t('nav.library') || 'Islamic Library')}
                </Link>
                <Link
                  to="/gallery"
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-1.5 text-sm text-ink-text-secondary hover:text-emerald-700"
                >
                  {tx('معرض الصور', t('nav.gallery') || 'Gallery')}
                </Link>
                <Link
                  to="/news"
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-1.5 text-sm text-ink-text-secondary hover:text-emerald-700"
                >
                  {tx('الأخبار', t('nav.news') || 'News & Events')}
                </Link>
              </div>
            )}
          </div>

          <Link
            to="/admissions"
            onClick={() => setIsOpen(false)}
            className={`block px-3 py-2 rounded-lg text-sm font-medium ${
              location.pathname === '/admissions' ? 'bg-mint-wash-100 text-emerald-700 font-semibold' : 'text-ink-text-primary'
            }`}
          >
            {tx('القبول', t('nav.admissions') || 'Admissions')}
          </Link>

          <Link
            to="/contact"
            onClick={() => setIsOpen(false)}
            className={`block px-3 py-2 rounded-lg text-sm font-medium ${
              location.pathname === '/contact' ? 'bg-mint-wash-100 text-emerald-700 font-semibold' : 'text-ink-text-primary'
            }`}
          >
            {tx('اتصل بنا', t('nav.contact') || 'Contact')}
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

          <div className="pt-3 border-t border-sand-border flex flex-col gap-2">
            {isAuthenticated ? (
              <>
                <Link
                  to={isAdmin ? "/admin" : "/dashboard"}
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
                  to="/admissions"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center h-10 rounded-[10px] bg-emerald-700 text-white font-medium text-sm"
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
