import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const { t, i18n } = useTranslation()
  const location = useLocation()

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
    { path: '/gallery', label: 'nav.gallery' },
    { path: '/news', label: 'nav.news' },
    { path: '/contact', label: 'nav.contact' },
  ]

  return (
    <nav className="bg-islamic-green shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <span className="text-2xl font-arabic text-islamic-gold">
                {i18n.language === 'ar' ? 'كشف الهدى' : 'Kashiful Hudha'}
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-islamic-dark text-islamic-gold'
                    : 'text-white hover:bg-islamic-dark hover:text-islamic-gold'
                }`}
              >
                {t(item.label)}
              </Link>
            ))}
            <button
              onClick={toggleLanguage}
              className="px-4 py-2 rounded-md bg-islamic-gold text-islamic-green font-medium hover:bg-yellow-500 transition-colors"
            >
              {i18n.language === 'en' ? 'العربية' : 'English'}
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-white hover:text-islamic-gold focus:outline-none"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden bg-islamic-dark">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  location.pathname === item.path
                    ? 'bg-islamic-green text-islamic-gold'
                    : 'text-white hover:bg-islamic-green hover:text-islamic-gold'
                }`}
              >
                {t(item.label)}
              </Link>
            ))}
            <button
              onClick={() => {
                toggleLanguage()
                setIsOpen(false)
              }}
              className="w-full text-left px-3 py-2 rounded-md text-base font-medium bg-islamic-gold text-islamic-green hover:bg-yellow-500"
            >
              {i18n.language === 'en' ? 'العربية' : 'English'}
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar
