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
    <nav className="bg-white/95 sticky top-0 z-50 border-b border-slate-100 shadow-sm backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-3 group">
              <img 
                src="/images/logo.jpg" 
                alt="Dharul Uloom Kashiful Hudha Logo" 
                className="w-12 h-12 object-contain rounded-xl shadow-sm border border-slate-100 group-hover:scale-105 transition-transform duration-300"
              />
              <span className="text-xl sm:text-2xl font-arabic font-extrabold text-emerald-950 tracking-wide">
                {i18n.language === 'ar' ? 'كاشف الهدى' : 'Kashiful Hudha'}
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1 ml-8">
            <Link
              to="/"
              className={`relative px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                location.pathname === '/' ? 'text-emerald-700' : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              <span className="relative z-10">{t('nav.home')}</span>
              {location.pathname === '/' && (
                <div className="absolute inset-0 bg-emerald-50 rounded-xl border border-emerald-100/50 z-0"></div>
              )}
            </Link>

            <Link
              to="/about"
              className={`relative px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                location.pathname === '/about' ? 'text-emerald-700' : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              <span className="relative z-10">{t('nav.about')}</span>
              {location.pathname === '/about' && (
                <div className="absolute inset-0 bg-emerald-50 rounded-xl border border-emerald-100/50 z-0"></div>
              )}
            </Link>

            {/* Academics Dropdown */}
            <div className="relative group py-2">
              <button
                className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                  academicsActive ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                <span>{t('nav.academics')}</span>
                <svg className="w-4 h-4 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute left-0 top-full mt-1 w-48 rounded-xl bg-white border border-slate-100 shadow-xl py-2 z-50 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300">
                <Link
                  to="/courses"
                  className={`block px-4 py-2 text-sm font-semibold transition-all hover:bg-emerald-50 hover:text-emerald-700 ${
                    location.pathname === '/courses' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-700'
                  }`}
                >
                  {t('nav.courses')}
                </Link>
                <Link
                  to="/curriculum"
                  className={`block px-4 py-2 text-sm font-semibold transition-all hover:bg-emerald-50 hover:text-emerald-700 ${
                    location.pathname === '/curriculum' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-700'
                  }`}
                >
                  {t('nav.curriculum')}
                </Link>
                <Link
                  to="/faculty"
                  className={`block px-4 py-2 text-sm font-semibold transition-all hover:bg-emerald-50 hover:text-emerald-700 ${
                    location.pathname === '/faculty' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-700'
                  }`}
                >
                  {t('nav.faculty')}
                </Link>
              </div>
            </div>

            <Link
              to="/admissions"
              className={`relative px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                location.pathname === '/admissions' ? 'text-emerald-700' : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              <span className="relative z-10">{t('nav.admissions')}</span>
              {location.pathname === '/admissions' && (
                <div className="absolute inset-0 bg-emerald-50 rounded-xl border border-emerald-100/50 z-0"></div>
              )}
            </Link>

            {/* Explore Dropdown */}
            <div className="relative group py-2">
              <button
                className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                  exploreActive ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                <span>{t('nav.explore')}</span>
                <svg className="w-4 h-4 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute left-0 top-full mt-1 w-48 rounded-xl bg-white border border-slate-100 shadow-xl py-2 z-50 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300">
                <Link
                  to="/library"
                  className={`block px-4 py-2 text-sm font-semibold transition-all hover:bg-emerald-50 hover:text-emerald-700 ${
                    location.pathname === '/library' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-700'
                  }`}
                >
                  {t('nav.library')}
                </Link>
                <Link
                  to="/gallery"
                  className={`block px-4 py-2 text-sm font-semibold transition-all hover:bg-emerald-50 hover:text-emerald-700 ${
                    location.pathname === '/gallery' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-700'
                  }`}
                >
                  {t('nav.gallery')}
                </Link>
                <Link
                  to="/news"
                  className={`block px-4 py-2 text-sm font-semibold transition-all hover:bg-emerald-50 hover:text-emerald-700 ${
                    location.pathname === '/news' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-700'
                  }`}
                >
                  {t('nav.news')}
                </Link>
              </div>
            </div>

            <Link
              to="/contact"
              className={`relative px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                location.pathname === '/contact' ? 'text-emerald-700' : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              <span className="relative z-10">{t('nav.contact')}</span>
              {location.pathname === '/contact' && (
                <div className="absolute inset-0 bg-emerald-50 rounded-xl border border-emerald-100/50 z-0"></div>
              )}
            </Link>

            <div className="h-6 w-px bg-slate-200 mx-4"></div>

            {/* Auth Buttons */}
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                {isAdmin ? (
                  <Link
                    to="/admin"
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 transition-all shadow-sm"
                  >
                    {i18n.language === 'ar' ? 'لوحة الإدارة' : 'Admin Portal'}
                  </Link>
                ) : (
                  <Link
                    to="/dashboard"
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 transition-all shadow-sm"
                  >
                    {i18n.language === 'ar' ? 'البوابة' : 'My Portal'}
                  </Link>
                )}
                {isStaff && (
                  <Link
                    to="/library-admin"
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100 transition-all shadow-sm"
                  >
                    {i18n.language === 'ar' ? 'إدارة المكتبة' : 'Library Admin'}
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all"
                >
                  {i18n.language === 'ar' ? 'خروج' : 'Logout'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 transition-all"
                >
                  {i18n.language === 'ar' ? 'دخول' : 'Sign In'}
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-600 transition-all shadow-sm border border-emerald-800/20"
                >
                  {i18n.language === 'ar' ? 'تسجيل' : 'Register'}
                </Link>
              </div>
            )}

            <button
              onClick={toggleLanguage}
              className="ml-4 px-3 py-1.5 rounded-lg bg-slate-100 text-emerald-800 font-bold text-xs border border-slate-200 hover:bg-slate-200 transition-all"
            >
              {i18n.language === 'en' ? 'عربي' : 'EN'}
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-emerald-800 font-bold text-xs border border-slate-200"
            >
              {i18n.language === 'en' ? 'عربي' : 'EN'}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-slate-600 hover:text-emerald-700 focus:outline-none p-2 rounded-lg bg-slate-50 border border-slate-200"
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
        <div className="lg:hidden bg-white border-t border-slate-100 absolute w-full left-0 top-full shadow-lg">
          <div className="px-4 py-4 space-y-2 max-h-[80vh] overflow-y-auto">
            <Link
              to="/"
              onClick={() => setIsOpen(false)}
              className={`block px-4 py-3 rounded-xl text-base font-bold transition-all ${
                location.pathname === '/' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t('nav.home')}
            </Link>

            <Link
              to="/about"
              onClick={() => setIsOpen(false)}
              className={`block px-4 py-3 rounded-xl text-base font-bold transition-all ${
                location.pathname === '/about' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t('nav.about')}
            </Link>

            {/* Mobile Academics Collapse */}
            <div>
              <button
                onClick={() => setMobileAcademicsOpen(!mobileAcademicsOpen)}
                className={`flex justify-between items-center w-full px-4 py-3 rounded-xl text-base font-bold transition-all ${
                  academicsActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{t('nav.academics')}</span>
                <svg className={`w-5 h-5 transition-transform ${mobileAcademicsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {mobileAcademicsOpen && (
                <div className="pl-6 pr-4 py-2 space-y-2 bg-slate-50 rounded-xl mt-1 border border-slate-100">
                  <Link
                    to="/courses"
                    onClick={() => setIsOpen(false)}
                    className="block py-2 text-sm font-semibold text-slate-600 hover:text-emerald-700"
                  >
                    {t('nav.courses')}
                  </Link>
                  <Link
                    to="/curriculum"
                    onClick={() => setIsOpen(false)}
                    className="block py-2 text-sm font-semibold text-slate-600 hover:text-emerald-700"
                  >
                    {t('nav.curriculum')}
                  </Link>
                  <Link
                    to="/faculty"
                    onClick={() => setIsOpen(false)}
                    className="block py-2 text-sm font-semibold text-slate-600 hover:text-emerald-700"
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
                location.pathname === '/admissions' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t('nav.admissions')}
            </Link>

            {/* Mobile Explore Collapse */}
            <div>
              <button
                onClick={() => setMobileExploreOpen(!mobileExploreOpen)}
                className={`flex justify-between items-center w-full px-4 py-3 rounded-xl text-base font-bold transition-all ${
                  exploreActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{t('nav.explore')}</span>
                <svg className={`w-5 h-5 transition-transform ${mobileExploreOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {mobileExploreOpen && (
                <div className="pl-6 pr-4 py-2 space-y-2 bg-slate-50 rounded-xl mt-1 border border-slate-100">
                  <Link
                    to="/library"
                    onClick={() => setIsOpen(false)}
                    className="block py-2 text-sm font-semibold text-slate-600 hover:text-emerald-700"
                  >
                    {t('nav.library')}
                  </Link>
                  <Link
                    to="/gallery"
                    onClick={() => setIsOpen(false)}
                    className="block py-2 text-sm font-semibold text-slate-600 hover:text-emerald-700"
                  >
                    {t('nav.gallery')}
                  </Link>
                  <Link
                    to="/news"
                    onClick={() => setIsOpen(false)}
                    className="block py-2 text-sm font-semibold text-slate-600 hover:text-emerald-700"
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
                location.pathname === '/contact' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700'
              }`}
            >
              {t('nav.contact')}
            </Link>

            <div className="h-px w-full bg-slate-200 my-4"></div>

            {isAuthenticated ? (
              <div className="space-y-2">
                <Link
                  to={isAdmin ? "/admin" : "/dashboard"}
                  onClick={() => setIsOpen(false)}
                  className="block w-full text-center px-4 py-3 rounded-xl text-base font-bold bg-emerald-50 text-emerald-700 border border-emerald-100"
                >
                  {i18n.language === 'ar' ? 'الذهاب للوحة التحكم' : 'Go to Portal'}
                </Link>
                {isStaff && (
                  <Link
                    to="/library-admin"
                    onClick={() => setIsOpen(false)}
                    className="block w-full text-center px-4 py-3 rounded-xl text-base font-bold bg-amber-50 text-amber-700 border border-amber-100"
                  >
                    {i18n.language === 'ar' ? 'إدارة المكتبة' : 'Library Admin'}
                  </Link>
                )}
                <button
                  onClick={() => { logout(); setIsOpen(false); }}
                  className="block w-full text-center px-4 py-3 rounded-xl text-base font-bold bg-slate-100 border border-slate-200 text-red-600"
                >
                  {i18n.language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="block w-full text-center px-4 py-3 rounded-xl text-base font-bold text-slate-700 border border-slate-200 bg-slate-50"
                >
                  {i18n.language === 'ar' ? 'دخول' : 'Sign In'}
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsOpen(false)}
                  className="block w-full text-center px-4 py-3 rounded-xl text-base font-bold bg-emerald-700 text-white"
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
