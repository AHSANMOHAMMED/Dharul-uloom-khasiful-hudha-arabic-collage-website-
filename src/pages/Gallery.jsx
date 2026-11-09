import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { listGalleryItems } from '../lib/contentApi'
import KhatamPattern from '../components/KhatamPattern'
import { localized } from '../lib/localized';
import { tx } from '../lib/tx';

/** Real campus photos until the CMS has gallery items (drop more files in public/images/campus/). */
const fallbackGallery = () => [
  {
    id: 'g1',
    category: 'campus',
    title: tx('المبنى الرئيسي للكلية', 'Main college building'),
    caption: tx('واجهة دار العلوم كاشف الهدى في مدلايبلي، كالبيتيا، بأقواسها البيضاء وشعار الكلية.', 'The white arched façade of Dharul Uloom Kashiful Hudha in Mudalippalli, Kalpitiya.'),
    imageUrl: '/images/campus/building.jpg',
  },
  {
    id: 'g2',
    category: 'campus',
    title: tx('بوابة الحرم الجامعي', 'Campus entrance gate'),
    caption: tx('البوابة الرئيسية للكلية في مدلايبلي — مدخل يرحب بالطلاب والزوار.', 'The main gate welcoming students and visitors to the campus grounds.'),
    imageUrl: '/images/campus/gate.jpg',
  },
  {
    id: 'g3',
    category: 'events',
    title: tx('شعار دار العلوم كاشف الهدى', 'College emblem'),
    caption: tx('الشعار الرسمي للكلية — دار العلوم كاشف الهدى، كالبيتيا، سريلانكا (Regd. MRCA).', 'Official emblem of Dharul Uloom Kashiful Hudha, Kalpitiya, Sri Lanka (Regd. MRCA).'),
    imageUrl: '/images/campus/emblem.png',
  },
]

export default function Gallery() {
  const { i18n } = useTranslation()
  const [dbItems, setItems] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [lightboxIndex, setLightboxIndex] = useState(null)

  useEffect(() => {
    listGalleryItems()
      .then((data) => {
        setItems(data && data.length > 0 ? data : null)
      })
      .catch(() => setItems(null))
      .finally(() => setLoading(false))
  }, [])

  const fallback = fallbackGallery()
  const items = dbItems || fallback
  const rtl = i18n.dir() === 'rtl'
  const categoryLabels = {
    all: tx('الكل', 'All'),
    campus: tx('الحرم', 'Campus'),
    classes: tx('الدروس', 'Classes'),
    graduation: tx('التخرج', 'Graduation'),
    events: tx('المناسبات', 'Events'),
  }
  const categories = ['all', 'campus', 'classes', 'graduation', 'events']
  const categoryLabel = (cat, fallbackLabel) => (cat && categoryLabels[cat.toLowerCase()]) || cat || fallbackLabel

  const filteredItems = activeCategory === 'all'
    ? items
    : items.filter((item) => (item.category || '').toLowerCase() === activeCategory)

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
        <img src="/images/campus/building.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-ink-green-900/85" aria-hidden="true" />
        <KhatamPattern className="opacity-[0.04]" strokeColor="#FBF8F0" id="gallery-khatam" />
        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <nav className="flex items-center gap-2 text-xs text-dark-text-primary/70 mb-4" aria-label={tx('مسار التنقل', 'Breadcrumb')}>
            <Link to="/" className="hover:text-gold-wash-100 transition-colors">{tx('الرئيسية', 'Home')}</Link>
            <span>/</span>
            <span className="text-brass-gold-500 font-medium">{tx('معرض الصور', 'Gallery')}</span>
          </nav>

          <span className="text-xs font-semibold uppercase tracking-widest text-brass-gold-500 mb-2 block">
            {tx('معرض الصور التوثيقي', 'Visual Chronicles')}
          </span>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-paper-white tracking-tight">
            {tx('مشاهد من الحياة العلمية والروحية', 'Campus Life & Scholarly Assemblies')}
          </h1>
          <p className="font-serif text-sm sm:text-base text-dark-text-primary/80 mt-3 max-w-2xl leading-relaxed">
            {tx('توثيق مصور لأروقة الكلية وحلقات القرآن ومجالس ختم الحديث ومناسبات التخرج السنوية.', 'A photographic journey into daily halaqat, graduation sanad ceremonies, library study, and community gatherings.')}
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
                {categoryLabels[cat]}
              </button>
            ))}
          </div>

          <span className="text-xs text-ink-text-muted">
            <strong className="text-ink-text-primary tabular-nums">{filteredItems.length}</strong> {tx('صورة', 'photographs')}
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
              <span className="material-symbols-outlined text-4xl text-ink-text-muted mb-2 block">{'photo_library'}</span>
              <p className="text-sm font-semibold text-ink-green-900 mb-1">{tx('لا توجد صور في هذا الألبوم', 'No photos in this album')}</p>
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className="mt-3 px-4 py-2 bg-emerald-700 text-white rounded-[10px] text-xs font-semibold"
              >
                {tx('عرض جميع الصور', 'Show All Photos')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item, idx) => {
                const title = localized(item.title) || tx('لحظة من الحرم', 'Campus Moment')
                const img = item.imageUrl || fallback[idx % fallback.length].imageUrl

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
                          {categoryLabel(item.category, tx('الكلية', 'Collegiate'))}
                        </span>
                        <span className="material-symbols-outlined text-[16px] text-ink-text-muted group-hover:text-emerald-700">
                          {'zoom_in'}
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
                {tx('صورة {n} من {total}', 'Photo {n} of {total}').replace('{n}', lightboxIndex + 1).replace('{total}', filteredItems.length)}
              </span>
              <button
                type="button"
                onClick={closeLightbox}
                aria-label={tx('إغلاق', 'Close')}
                className="w-8 h-8 rounded-full border border-sand-border flex items-center justify-center text-ink-text-primary hover:bg-sand-border/30 text-sm"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {/* Photo Canvas */}
            <div className="relative max-h-[65vh] bg-ink-green-900 flex items-center justify-center overflow-hidden">
              <img
                src={currentItem.imageUrl || fallback[lightboxIndex % fallback.length].imageUrl}
                alt={localized(currentItem.title) || tx('عرض مكبّر', 'Enlarged view')}
                className="max-h-[65vh] w-auto max-w-full object-contain"
              />

              {/* Prev / Next Controls */}
              <button
                type="button"
                onClick={rtl ? showNext : showPrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-paper-white/80 hover:bg-paper-white text-ink-green-900 flex items-center justify-center shadow-md transition-all"
                aria-label={rtl ? tx('الصورة التالية', 'Next image') : tx('الصورة السابقة', 'Previous image')}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {'chevron_left'}
                </span>
              </button>

              <button
                type="button"
                onClick={rtl ? showPrev : showNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-paper-white/80 hover:bg-paper-white text-ink-green-900 flex items-center justify-center shadow-md transition-all"
                aria-label={rtl ? tx('الصورة السابقة', 'Previous image') : tx('الصورة التالية', 'Next image')}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {'chevron_right'}
                </span>
              </button>
            </div>

            {/* Caption & Metadata */}
            <div className="p-6 bg-paper-white space-y-1">
              <span className="text-[11px] uppercase font-semibold text-brass-gold-500 tracking-wider">
                {categoryLabel(currentItem.category, tx('الأرشيف', 'Archive'))}
              </span>
              <h3 className="font-serif text-lg font-semibold text-ink-green-900">
                {localized(currentItem.title)}
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
