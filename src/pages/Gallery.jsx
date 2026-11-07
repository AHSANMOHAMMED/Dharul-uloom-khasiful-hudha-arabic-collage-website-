import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { listGalleryItems } from '../lib/contentApi'
import KhatamPattern from '../components/KhatamPattern'

const FALLBACK_GALLERY = [
  {
    id: 'g1',
    category: 'Campus',
    title: { en: 'Collegiate Courtyard & Arched Colonnades', ar: 'باحة الكلية والأروقة المعمارية' },
    caption: 'Serene morning atmosphere in the central courtyard where students gather between halaqat.',
    imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'g2',
    category: 'Classes',
    title: { en: 'Morning Hifz Recitation Circle', ar: 'حلقة الحفظ الصباحية' },
    caption: 'Students memorizing the Holy Quran under senior Qaris in the main prayer hall.',
    imageUrl: 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'g3',
    category: 'Graduation',
    title: { en: 'Annual Khatm al-Bukhari & Sanad Conferment', ar: 'المجلس السنوي لختم صحيح البخاري' },
    caption: 'Celebration of graduating Alim scholars receiving authenticated sanad chains.',
    imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'g4',
    category: 'Campus',
    title: { en: 'Maktabah Archival Reading Room', ar: 'قاعة المطالعة في المكتبة التراثية' },
    caption: 'Students consulting classical commentary folios and hadith references in quiet study.',
    imageUrl: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'g5',
    category: 'Events',
    title: { en: 'Community Iftar & Taraweeh Gathering', ar: 'إفطار رمضاني وصلاة التراويح' },
    caption: 'Annual Ramadan gathering bringing together faculty, students, and local community elders.',
    imageUrl: 'https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'g6',
    category: 'Classes',
    title: { en: 'Classical Arabic Grammar Debate Session', ar: 'مناظرة طلابية في علم النحو' },
    caption: 'Intermediate students parsing sentences and engaging in classical Nahw disputations.',
    imageUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80'
  }
]

export default function Gallery() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'ar'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [lightboxIndex, setLightboxIndex] = useState(null)

  useEffect(() => {
    listGalleryItems()
      .then((data) => {
        if (data && data.length > 0) {
          setItems(data)
        } else {
          setItems(FALLBACK_GALLERY)
        }
      })
      .catch(() => setItems(FALLBACK_GALLERY))
      .finally(() => setLoading(false))
  }, [])

  const categories = ['All', 'Campus', 'Classes', 'Graduation', 'Events']

  const filteredItems = activeCategory === 'All'
    ? items
    : items.filter((item) => (item.category || '').toLowerCase() === activeCategory.toLowerCase())

  const openLightbox = (index) => setLightboxIndex(index)
  const closeLightbox = () => setLightboxIndex(null)

  const showNext = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex + 1) % filteredItems.length)
    }
  }

  const showPrev = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex - 1 + filteredItems.length) % filteredItems.length)
    }
  }

  const currentItem = lightboxIndex !== null ? filteredItems[lightboxIndex] : null

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen relative">
      
      {/* 1. Header & Breadcrumb */}
      <section className="relative w-full bg-ink-green-900 text-paper-white py-16 overflow-hidden border-b border-sand-border/20">
        <KhatamPattern className="opacity-[0.04]" strokeColor="#FBF8F0" id="gallery-khatam" />
        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <nav className="flex items-center gap-2 text-xs text-dark-text-primary/70 mb-4" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-gold-wash-100 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-brass-gold-500 font-medium">Gallery</span>
          </nav>

          <span className="text-xs font-semibold uppercase tracking-widest text-brass-gold-500 mb-2 block">
            {isRTL ? 'معرض الصور التوثيقي' : 'Visual Chronicles'}
          </span>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-paper-white tracking-tight">
            {isRTL ? 'مشاهد من الحياة العلمية والروحية' : 'Campus Life & Scholarly Assemblies'}
          </h1>
          <p className="font-serif text-sm sm:text-base text-dark-text-primary/80 mt-3 max-w-2xl leading-relaxed">
            {isRTL
              ? 'توثيق مصور لأروقة الكلية وحلقات القرآن ومجالس ختم الحديث ومناسبات التخرج السنوية.'
              : 'A photographic journey into daily halaqat, graduation sanad ceremonies, library study, and community gatherings.'}
          </p>
        </div>
      </section>

      {/* 2. Album Filter Chips Bar */}
      <section className="w-full py-8 border-b border-sand-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                  activeCategory === cat
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-paper-white text-ink-text-secondary border-sand-border hover:bg-sand-border/30'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <span className="text-xs text-ink-text-muted">
            <strong className="text-ink-text-primary tabular-nums">{filteredItems.length}</strong> photographs
          </span>
        </div>
      </section>

      {/* 3. Photo Grid */}
      <section className="w-full py-16">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <div key={s} className="rounded-[14px] bg-paper-white border border-sand-border h-64 animate-pulse"></div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center rounded-[14px] bg-paper-white border border-sand-border max-w-md mx-auto">
              <span className="material-symbols-outlined text-4xl text-ink-text-muted mb-2 block">photo_library</span>
              <p className="text-sm font-semibold text-ink-green-900 mb-1">No photos in this album</p>
              <button
                type="button"
                onClick={() => setActiveCategory('All')}
                className="mt-3 px-4 py-2 bg-emerald-700 text-white rounded-[10px] text-xs font-semibold"
              >
                Show All Photos
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item, idx) => {
                const title = item.title?.[isRTL ? 'ar' : 'en'] || item.title?.en || item.title || 'Campus Moment'
                const img = item.imageUrl || FALLBACK_GALLERY[idx % FALLBACK_GALLERY.length].imageUrl

                return (
                  <div
                    key={item.id || idx}
                    onClick={() => openLightbox(idx)}
                    className="group relative rounded-[14px] overflow-hidden bg-paper-white border border-sand-border shadow-manuscript cursor-pointer hover:border-emerald-700 transition-all duration-200"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-ink-green-900/10">
                      <img
                        src={img}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>

                    <div className="p-4 bg-paper-white">
                      <div className="flex items-center justify-between text-[11px] text-ink-text-muted mb-1">
                        <span className="font-semibold uppercase tracking-wider text-emerald-700">
                          {item.category || 'Collegiate'}
                        </span>
                        <span className="material-symbols-outlined text-[16px] text-ink-text-muted group-hover:text-emerald-700">
                          zoom_in
                        </span>
                      </div>
                      <h3 className="font-serif text-sm font-semibold text-ink-green-900 leading-snug">
                        {title}
                      </h3>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </section>

      {/* 4. Lightbox Modal */}
      {currentItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-green-900/90 backdrop-blur-sm">
          <div className="relative max-w-4xl w-full bg-paper-white rounded-[14px] border border-sand-border overflow-hidden shadow-manuscript-lg">
            
            {/* Top Bar */}
            <div className="p-4 bg-parchment-50 border-b border-sand-border flex items-center justify-between text-xs text-ink-text-secondary">
              <span className="font-semibold text-ink-green-900">
                Photo {lightboxIndex + 1} of {filteredItems.length}
              </span>
              <button
                type="button"
                onClick={closeLightbox}
                className="w-8 h-8 rounded-full border border-sand-border flex items-center justify-center text-ink-text-primary hover:bg-sand-border/30 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Photo Canvas */}
            <div className="relative max-h-[65vh] bg-ink-green-900 flex items-center justify-center overflow-hidden">
              <img
                src={currentItem.imageUrl || FALLBACK_GALLERY[lightboxIndex % FALLBACK_GALLERY.length].imageUrl}
                alt="Enlarged view"
                className="max-h-[65vh] w-auto max-w-full object-contain"
              />

              {/* Prev / Next Controls */}
              <button
                type="button"
                onClick={isRTL ? showNext : showPrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-paper-white/80 hover:bg-paper-white text-ink-green-900 flex items-center justify-center shadow-md transition-all"
                aria-label="Previous image"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isRTL ? 'chevron_right' : 'chevron_left'}
                </span>
              </button>

              <button
                type="button"
                onClick={isRTL ? showPrev : showNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-paper-white/80 hover:bg-paper-white text-ink-green-900 flex items-center justify-center shadow-md transition-all"
                aria-label="Next image"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isRTL ? 'chevron_left' : 'chevron_right'}
                </span>
              </button>
            </div>

            {/* Caption & Metadata */}
            <div className="p-6 bg-paper-white space-y-1">
              <span className="text-[11px] uppercase font-semibold text-brass-gold-500 tracking-wider">
                {currentItem.category || 'Archive'}
              </span>
              <h3 className="font-serif text-lg font-semibold text-ink-green-900">
                {currentItem.title?.[isRTL ? 'ar' : 'en'] || currentItem.title?.en || currentItem.title}
              </h3>
              {currentItem.caption && (
                <p className="text-xs text-ink-text-secondary leading-relaxed pt-1">
                  {currentItem.caption}
                </p>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
