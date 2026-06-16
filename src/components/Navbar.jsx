import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [mobileAcademicsOpen, setMobileAcademicsOpen] = useState(false)
  const [mobileExploreOpen, setMobileExploreOpen] = useState(false)
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const { isAuthenticated, isAdmin, isStaff, logout } = useAuth()

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ar' : 'en'
    i18n.changeLanguage(newLang)
  }

  const academicsActive = ['/courses', '/curriculum', '/faculty'].includes(location.pathname)
  const exploreActive = ['/library', '/gallery', '/news'].includes(location.pathname)

  return (
    <nav className="glass-panel sticky top-0 z-50 border-b border-gray-800/60 shadow-glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-glow-emerald group-hover:shadow-amber transition-all duration-500">
                <span className="text-white font-arabic font-bold text-xl">ك</span>
              </div>
              <span className="text-2xl font-arabic font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200 tracking-wide">
                {i18n.language === 'ar' ? 'كاشف الهدى' : 'Kashiful Hudha'}
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1 ml-8">
            <Link
              to="/"
              className={`relative px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 group ${
                location.pathname === '/' ? 'text-amber-400' : 'text-gray-300 hover:text-white'
              }`}
            >
              <span className="relative z-10">{t('nav.home')}</span>
              {location.pathname === '/' && (
                <div className="absolute inset-0 bg-amber-500/10 rounded-xl border border-amber-500/20 z-0"></div>
              )}
            </Link>

            <Link
              to="/about"
              className={`relative px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 group ${
                location.pathname === '/about' ? 'text-amber-400' : 'text-gray-300 hover:text-white'
              }`}
            >
              <span className="relative z-10">{t('nav.about')}</span>
              {location.pathname === '/about' && (
                <div className="absolute inset-0 bg-amber-500/10 rounded-xl border border-amber-500/20 z-0"></div>
              )}
            </Link>

            {/* Academics Dropdown */}
            <div className="relative group py-2">
              <button
                className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                  academicsActive ? 'text-amber-400 bg-amber-500/5' : 'text-gray-300 hover:text-white'
                }`}
              >
                <span>{t('nav.academics')}</span>
                <svg className="w-4 h-4 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute left-0 top-full mt-1 w-48 rounded-xl bg-gray-950/95 border border-gray-800 shadow-2xl backdrop-blur-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 py-2 z-50">
                <Link
                  to="/courses"
                  className={`block px-4 py-2 text-sm font-semibold transition-all hover:bg-emerald-950/40 hover:text-emerald-400 ${
                    location.pathname === '/courses' ? 'text-amber-400 bg-amber-500/5' : 'text-gray-300'
                  }`}
                >
                  {t('nav.courses')}
                </Link>
                <Link
                  to="/curriculum"
                  className={`block px-4 py-2 text-sm font-semibold transition-all hover:bg-emerald-950/40 hover:text-emerald-400 ${
                    location.pathname === '/curriculum' ? 'text-amber-400 bg-amber-500/5' : 'text-gray-300'
                  }`}
                >
                  {t('nav.curriculum')}
                </Link>
                <Link
                  to="/faculty"
                  className={`block px-4 py-2 text-sm font-semibold transition-all hover:bg-emerald-950/40 hover:text-emerald-400 ${
                    location.pathname === '/faculty' ? 'text-amber-400 bg-amber-500/5' : 'text-gray-300'
                  }`}
                >
                  {t('nav.faculty')}
                </Link>
              </div>
            </div>

            <Link
              to="/admissions"
              className={`relative px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 group ${
                location.pathname === '/admissions' ? 'text-amber-400' : 'text-gray-300 hover:text-white'
              }`}
            >
              <span className="relative z-10">{t('nav.admissions')}</span>
              {location.pathname === '/admissions' && (
                <div className="absolute inset-0 bg-amber-500/10 rounded-xl border border-amber-500/20 z-0"></div>
              )}
            </Link>

            {/* Explore Dropdown */}
            <div className="relative group py-2">
              <button
                className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                  exploreActive ? 'text-amber-400 bg-amber-500/5' : 'text-gray-300 hover:text-white'
                }`}
              >
                <span>{t('nav.explore')}</span>
                <svg className="w-4 h-4 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute left-0 top-full mt-1 w-48 rounded-xl bg-gray-950/95 border border-gray-800 shadow-2xl backdrop-blur-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 py-2 z-50">
                <Link
                  to="/library"
                  className={`block px-4 py-2 text-sm font-semibold transition-all hover:bg-emerald-950/40 hover:text-emerald-400 ${
                    location.pathname === '/library' ? 'text-amber-400 bg-amber-500/5' : 'text-gray-300'
                  }`}
                >
                  {t('nav.library')}
                </Link>
                <Link
                  to="/gallery"
                  className={`block px-4 py-2 text-sm font-semibold transition-all hover:bg-emerald-950/40 hover:text-emerald-400 ${
                    location.pathname === '/gallery' ? 'text-amber-400 bg-amber-500/5' : 'text-gray-300'
                  }`}
                >
                  {t('nav.gallery')}
                </Link>
                <Link
                  to="/news"
                  className={`block px-4 py-2 text-sm font-semibold transition-all hover:bg-emerald-950/40 hover:text-emerald-400 ${
                    location.pathname === '/news' ? 'text-amber-400 bg-amber-500/5' : 'text-gray-300'
                  }`}
                >
                  {t('nav.news')}
                </Link>
              </div>
            </div>

            <Link
              to="/contact"
              className={`relative px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 group ${
                location.pathname === '/contact' ? 'text-amber-400' : 'text-gray-300 hover:text-white'
              }`}
            >
              <span className="relative z-10">{t('nav.contact')}</span>
              {location.pathname === '/contact' && (
                <div className="absolute inset-0 bg-amber-500/10 rounded-xl border border-amber-500/20 z-0"></div>
              )}
            </Link>

            <div className="h-6 w-px bg-gray-800 mx-4"></div>

            {/* Auth Buttons */}
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                {isAdmin ? (
                  <Link
                    to="/admin"
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-800/50 transition-all shadow-lg hover:shadow-glow-emerald"
                  >
                    {i18n.language === 'ar' ? 'لوحة الإدارة' : 'Admin Portal'}
                  </Link>
                ) : (
                  <Link
                    to="/dashboard"
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-800/50 transition-all shadow-lg hover:shadow-glow-emerald"
                  >
                    {i18n.language === 'ar' ? 'البوابة' : 'My Portal'}
                  </Link>
                )}
                {isStaff && (
                  <Link
                    to="/library-admin"
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-amber-900/40 text-amber-300 border border-amber-500/30 hover:bg-amber-800/50 transition-all shadow-lg"
                  >
                    {i18n.language === 'ar' ? 'إدارة المكتبة' : 'Library Admin'}
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="px-4 py-2 rounded-xl bg-gray-900/50 text-gray-300 font-bold border border-gray-700 hover:bg-red-900/30 hover:text-red-400 hover:border-red-500/30 transition-all"
                >
                  {i18n.language === 'ar' ? 'خروج' : 'Logout'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-xl text-sm font-bold text-gray-300 hover:text-white transition-all"
                >
                  {i18n.language === 'ar' ? 'دخول' : 'Sign In'}
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold hover:from-emerald-500 hover:to-teal-600 transition-all shadow-lg hover:shadow-glow-emerald border border-emerald-400/20"
                >
                  {i18n.language === 'ar' ? 'تسجيل' : 'Register'}
                </Link>
              </div>
            )}

            <button
              onClick={toggleLanguage}
              className="ml-4 px-3 py-1.5 rounded-lg bg-gray-800/50 text-amber-400 font-bold text-xs border border-gray-700 hover:bg-gray-700 transition-all"
            >
              {i18n.language === 'en' ? 'عربي' : 'EN'}
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className="px-3 py-1.5 rounded-lg bg-gray-800/50 text-amber-400 font-bold text-xs border border-gray-700"
            >
              {i18n.language === 'en' ? 'عربي' : 'EN'}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-300 hover:text-amber-400 focus:outline-none p-2 rounded-lg bg-gray-900 border border-gray-800"
            >
              <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                {isOpen ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="lg:hidden glass-panel border-t border-gray-800 absolute w-full left-0 top-full">
          <div className="px-4 py-4 space-y-2 max-h-[80vh] overflow-y-auto">
            <Link
              to="/"
              onClick={() => setIsOpen(false)}
              className={`block px-4 py-3 rounded-xl text-base font-bold transition-all ${
                location.pathname === '/' ? 'bg-amber-500/10 text-amber-400' : 'text-gray-300'
              }`}
            >
              {t('nav.home')}
            </Link>

            <Link
              to="/about"
              onClick={() => setIsOpen(false)}
              className={`block px-4 py-3 rounded-xl text-base font-bold transition-all ${
                location.pathname === '/about' ? 'bg-amber-500/10 text-amber-400' : 'text-gray-300'
              }`}
            >
              {t('nav.about')}
            </Link>

            {/* Mobile Academics Collapse */}
            <div>
              <button
                onClick={() => setMobileAcademicsOpen(!mobileAcademicsOpen)}
                className={`flex justify-between items-center w-full px-4 py-3 rounded-xl text-base font-bold transition-all ${
                  academicsActive ? 'bg-emerald-950/20 text-amber-400' : 'text-gray-300'
                }`}
              >
                <span>{t('nav.academics')}</span>
                <svg className={`w-5 h-5 transition-transform ${mobileAcademicsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {mobileAcademicsOpen && (
                <div className="pl-6 pr-4 py-2 space-y-2 bg-gray-950/40 rounded-xl mt-1 border border-gray-900">
                  <Link
                    to="/courses"
                    onClick={() => setIsOpen(false)}
                    className="block py-2 text-sm font-semibold text-gray-400 hover:text-white"
                  >
                    {t('nav.courses')}
                  </Link>
                  <Link
                    to="/curriculum"
                    onClick={() => setIsOpen(false)}
                    className="block py-2 text-sm font-semibold text-gray-400 hover:text-white"
                  >
                    {t('nav.curriculum')}
                  </Link>
                  <Link
                    to="/faculty"
                    onClick={() => setIsOpen(false)}
                    className="block py-2 text-sm font-semibold text-gray-400 hover:text-white"
                  >
                    {t('nav.faculty')}
                  </Link>
                </div>
              )}
            </div>

            <Link
              to="/admissions"
              onClick={() => setIsOpen(false)}
              className={`block px-4 py-3 rounded-xl text-base font-bold transition-all ${
                location.pathname === '/admissions' ? 'bg-amber-500/10 text-amber-400' : 'text-gray-300'
              }`}
            >
              {t('nav.admissions')}
            </Link>

            {/* Mobile Explore Collapse */}
            <div>
              <button
                onClick={() => setMobileExploreOpen(!mobileExploreOpen)}
                className={`flex justify-between items-center w-full px-4 py-3 rounded-xl text-base font-bold transition-all ${
                  exploreActive ? 'bg-emerald-950/20 text-amber-400' : 'text-gray-300'
                }`}
              >
                <span>{t('nav.explore')}</span>
                <svg className={`w-5 h-5 transition-transform ${mobileExploreOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {mobileExploreOpen && (
                <div className="pl-6 pr-4 py-2 space-y-2 bg-gray-950/40 rounded-xl mt-1 border border-gray-900">
                  <Link
                    to="/library"
                    onClick={() => setIsOpen(false)}
                    className="block py-2 text-sm font-semibold text-gray-400 hover:text-white"
                  >
                    {t('nav.library')}
                  </Link>
                  <Link
                    to="/gallery"
                    onClick={() => setIsOpen(false)}
                    className="block py-2 text-sm font-semibold text-gray-400 hover:text-white"
                  >
                    {t('nav.gallery')}
                  </Link>
                  <Link
                    to="/news"
                    onClick={() => setIsOpen(false)}
                    className="block py-2 text-sm font-semibold text-gray-400 hover:text-white"
                  >
                    {t('nav.news')}
                  </Link>
                </div>
              )}
            </div>

            <Link
              to="/contact"
              onClick={() => setIsOpen(false)}
              className={`block px-4 py-3 rounded-xl text-base font-bold transition-all ${
                location.pathname === '/contact' ? 'bg-amber-500/10 text-amber-400' : 'text-gray-300'
              }`}
            >
              {t('nav.contact')}
            </Link>

            <div className="h-px w-full bg-gray-800 my-4"></div>

            {isAuthenticated ? (
              <div className="space-y-2">
                <Link
                  to={isAdmin ? "/admin" : "/dashboard"}
                  onClick={() => setIsOpen(false)}
                  className="block w-full text-center px-4 py-3 rounded-xl text-base font-bold bg-emerald-900/40 text-emerald-400 border border-emerald-500/30"
                >
                  {i18n.language === 'ar' ? 'الذهاب للوحة التحكم' : 'Go to Portal'}
                </Link>
                {isStaff && (
                  <Link
                    to="/library-admin"
                    onClick={() => setIsOpen(false)}
                    className="block w-full text-center px-4 py-3 rounded-xl text-base font-bold bg-amber-900/40 text-amber-300 border border-amber-500/30"
                  >
                    {i18n.language === 'ar' ? 'إدارة المكتبة' : 'Library Admin'}
                  </Link>
                )}
                <button
                  onClick={() => { logout(); setIsOpen(false); }}
                  className="block w-full text-center px-4 py-3 rounded-xl text-base font-bold bg-gray-900 border border-gray-800 text-red-400"
                >
                  {i18n.language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="block w-full text-center px-4 py-3 rounded-xl text-base font-bold text-gray-300 border border-gray-800 bg-gray-900"
                >
                  {i18n.language === 'ar' ? 'دخول' : 'Sign In'}
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsOpen(false)}
                  className="block w-full text-center px-4 py-3 rounded-xl text-base font-bold bg-gradient-to-r from-emerald-600 to-teal-700 text-white"
                >
                  {i18n.language === 'ar' ? 'تسجيل جديد' : 'Register Account'}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar
