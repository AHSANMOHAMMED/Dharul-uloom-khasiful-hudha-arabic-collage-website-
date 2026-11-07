import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import KhatamPattern from '../components/KhatamPattern'

export default function NotFound() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const isRTL = i18n.language === 'ar'
  const [query, setQuery] = useState('')

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/library?q=${encodeURIComponent(query.trim())}`)
    } else {
      navigate('/library')
    }
  }

  return (
    <div className="min-h-screen bg-parchment-50 flex items-center justify-center p-6 relative overflow-hidden">
      <KhatamPattern className="opacity-[0.05]" strokeColor="#0B3B2E" id="notfound-khatam" />

      <div className="relative z-10 max-w-lg w-full bg-paper-white rounded-[14px] border border-sand-border p-8 sm:p-12 shadow-manuscript-md text-center space-y-6">
        
        {/* Khatam Motif Crest */}
        <div className="w-16 h-16 rounded-full bg-mint-wash-100 text-emerald-700 mx-auto flex items-center justify-center border border-emerald-700/20">
          <span className="material-symbols-outlined text-3xl">auto_stories</span>
        </div>

        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-brass-gold-500 font-bold block mb-1">
            Error 404 · Unresolved Folio
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900 leading-tight">
            {isRTL ? 'الصفحة المطلوبة غير موجودة' : 'This Page Could Not Be Found'}
          </h1>
          <p className="font-arabic text-sm text-ink-text-muted mt-1" dir="rtl">
            (عذراً، المخطوطة أو الصفحة المطلوبة غير متوفرة في السجل)
          </p>
          <p className="text-xs text-ink-text-secondary mt-3 leading-relaxed">
            The link you followed may have expired, or the destination address has shifted within the new manuscript repository.
          </p>
        </div>

        {/* Quick Search */}
        <form onSubmit={handleSearch} className="flex items-center bg-parchment-50 p-1.5 rounded-[10px] border border-sand-border">
          <span className="material-symbols-outlined text-ink-text-muted mx-2 text-[18px]">search</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search our Digital Library catalog..."
            className="w-full bg-transparent text-xs text-ink-text-primary focus:outline-none placeholder:text-ink-text-muted"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
          >
            Find
          </button>
        </form>

        {/* Dual Actions */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="px-5 py-2.5 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs"
          >
            Back to Home
          </Link>
          <Link
            to="/library"
            className="px-5 py-2.5 rounded-[10px] border border-sand-border hover:bg-sand-border/20 text-ink-text-primary text-xs font-medium"
          >
            Open Library
          </Link>
        </div>

      </div>
    </div>
  )
}
