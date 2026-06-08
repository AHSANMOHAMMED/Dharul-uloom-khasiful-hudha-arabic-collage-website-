import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const { isAuthenticated, isAdmin, isStaff, logout } = useAuth()

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ar' : 'en'
    i18n.changeLanguage(newLang)
  }

  const navItems = [
    { path: '/', label: 'nav.home' },
    { path: '/about', label: 'nav.about' },
    { path: '/courses', label: 'nav.courses' },
    { path: '/admissions', label: 'nav.admissions' },
    { path: '/faculty', label: 'nav.faculty' },
    { path: '/curriculum', label: 'nav.curriculum' },
    { path: '/library', label: 'nav.library' },
    { path: '/gallery', label: 'nav.gallery' },
    { path: '/news', label: 'nav.news' },
    { path: '/contact', label: 'nav.contact' },
  ]

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
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`relative px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 group overflow-hidden ${
                  location.pathname === item.path
                    ? 'text-amber-400'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <span className="relative z-10">{t(item.label)}</span>
                {location.pathname === item.path && (
                  <div className="absolute inset-0 bg-amber-500/10 rounded-xl border border-amber-500/20 z-0"></div>
                )}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-emerald-500 group-hover:w-1/2 transition-all duration-300"></div>
              </Link>
            ))}
            
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
          <div className="px-4 py-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`block px-4 py-3 rounded-xl text-base font-bold transition-all ${
                  location.pathname === item.path
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'text-gray-300 hover:bg-gray-800/50 hover:text-white'
                }`}
              >
                {t(item.label)}
              </Link>
            ))}
            
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
