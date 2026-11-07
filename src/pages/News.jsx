import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { listNews } from '../lib/contentApi'
import KhatamPattern from '../components/KhatamPattern'

const FALLBACK_NEWS = [
  {
    id: 'n1',
    category: 'Majlis Event',
    category_ar: 'مناسبة علمية',
    date: '2026-10-25',
    date_hijri: '15 Rajab 1448',
    title: {
      en: 'Annual Khatm al-Bukhari Gathering & Sanad Conferment 1448',
      ar: 'المجلس السنوي المبارك لختم صحيح البخاري وتخريج العلماء'
    },
    excerpt: {
      en: 'Conferring authentic sanad chains upon 34 graduating scholars completing the final chapters of Sahih al-Bukhari with guest scholars from across the region.',
      ar: 'احتفلت دار العلوم بتخريج دفعة جديدة من طلاب العلم بعد إتمام قراءة وشرح أواخر كتاب التوحيد من صحيح الإمام البخاري.'
    },
    imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'n2',
    category: 'Admissions',
    category_ar: 'القبول والتسجيل',
    date: '2026-10-18',
    date_hijri: '22 Rajab 1448',
    title: {
      en: 'Entrance Examination Schedule Announced for Academic Year 2027',
      ar: 'إعلان جدول مواعيد اختبارات القبول والمقابلات لعام ٢٠٢٧'
    },
    excerpt: {
      en: 'Registrations are formally open for Kulliyyah entrance interviews, Arabic oral assessment, and Quranic recitation testing across Kalpitiya.',
      ar: 'تعلن إدارة القبول والتسجيل عن بدء استقبال طلبات الالتحاق لبرامج حفظ القرآن الكريم ودراسة العلوم الشرعية والعربية.'
    },
    imageUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'n3',
    category: 'Digital Library',
    category_ar: 'المكتبة الرقمية',
    date: '2026-10-10',
    date_hijri: '04 Sha’ban 1448',
    title: {
      en: 'Restoration of Rare 18th Century Shafi’i Jurisprudence Codices',
      ar: 'رقمنة وإتاحة ثلاثة مخطوطات فقهية نادرة في الفقه الشافعي'
    },
    excerpt: {
      en: 'The Manuscript Preservation Wing has released digital high-resolution scans of three historically significant commentaries on Minhaj at-Talibin.',
      ar: 'أتاح مركز المخطوطات والتراث بالكلية نسخاً عالية الدقة لشروح فقهية نادرة تيسيراً للباحثين وطلاب العلم.'
    },
    imageUrl: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'n4',
    category: 'Academic',
    category_ar: 'الشؤون التعليمية',
    date: '2026-09-28',
    date_hijri: '12 Jumada al-Akhirah 1448',
    title: {
      en: 'Inter-Collegiate Classical Arabic Declamation & Balaghah Competition',
      ar: 'المسابقة الخطابية السنوية في البلاغة والأدب العربي'
    },
    excerpt: {
      en: 'Students exhibited classical rhetorical prowess in extemporaneous declamation, classical poetry recitation, and syntax analysis.',
      ar: 'أقامت الكلية مسابقتها السنوية في الخطابة والشعر العربي الفصيح لإبراز كفاءات الطلاب اللغوية.'
    },
    imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80'
  }
]

export default function News() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'ar'
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listNews()
      .then((data) => {
        if (data && data.length > 0) {
          setNews(data)
        } else {
          setNews(FALLBACK_NEWS)
        }
      })
      .catch(() => setNews(FALLBACK_NEWS))
      .finally(() => setLoading(false))
  }, [])

  const featured = news[0] || FALLBACK_NEWS[0]
  const otherNews = news.slice(1)

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen relative">
      
      {/* 1. Header & Breadcrumb */}
      <section className="relative w-full bg-ink-green-900 text-paper-white py-16 overflow-hidden border-b border-sand-border/20">
        <KhatamPattern className="opacity-[0.04]" strokeColor="#FBF8F0" id="news-khatam" />
        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <nav className="flex items-center gap-2 text-xs text-dark-text-primary/70 mb-4" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-gold-wash-100 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-brass-gold-500 font-medium">News</span>
          </nav>

          <span className="text-xs font-semibold uppercase tracking-widest text-brass-gold-500 mb-2 block">
            {isRTL ? 'النشرات والأنباء' : 'Campus Dispatch'}
          </span>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-paper-white tracking-tight">
            {isRTL ? 'أخبار الكلية والإعلانات الرسمية' : 'Institutional News & Academic Bulletins'}
          </h1>
          <p className="font-serif text-sm sm:text-base text-dark-text-primary/80 mt-3 max-w-2xl leading-relaxed">
            {isRTL
              ? 'متابعة حية للفعاليات الأكاديمية والمجالس العلمية وجداول الامتحانات والندوات التراثية.'
              : 'Official announcements, academic calendars, symposium reports, and collegiate life updates.'}
          </p>
        </div>
      </section>

      {/* 2. Content Container */}
      <section className="w-full py-16">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          {/* Featured Large Article Card */}
          {featured && (
            <div className="p-6 sm:p-8 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript-md hover:border-emerald-700 transition-all">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-gold-wash-100 text-brass-gold-500 text-xs font-semibold">
                      {isRTL ? (featured.category_ar || 'مميز') : (featured.category || 'Featured Article')}
                    </span>
                    <span className="text-xs text-ink-text-muted">
                      {featured.date_hijri || featured.date}
                    </span>
                  </div>

                  <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900 leading-snug">
                    <Link to={`/news/${featured.id}`} className="hover:text-emerald-700 transition-colors">
                      {featured.title?.[isRTL ? 'ar' : 'en'] || featured.title?.en || featured.title}
                    </Link>
                  </h2>

                  <p className="text-xs sm:text-sm text-ink-text-secondary leading-relaxed font-sans">
                    {featured.excerpt?.[isRTL ? 'ar' : 'en'] || featured.excerpt?.en || featured.excerpt || featured.content}
                  </p>

                  <div className="pt-2">
                    <Link
                      to={`/news/${featured.id}`}
                      className="inline-flex items-center text-xs font-semibold text-emerald-700 hover:text-ink-green-900 gap-1"
                    >
                      <span>Read full dispatch</span>
                      <span className="material-symbols-outlined text-[16px]">
                        {isRTL ? 'arrow_back' : 'arrow_forward'}
                      </span>
                    </Link>
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-xl overflow-hidden bg-sand-border/30 h-64 border border-sand-border">
                  <img
                    src={featured.imageUrl || FALLBACK_NEWS[0].imageUrl}
                    alt="Featured article"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3-Column Grid for Subsequent Articles */}
          <div className="pt-6">
            <h3 className="font-serif text-xl font-semibold text-ink-green-900 mb-6">
              {isRTL ? 'سائر الأخبار والتقارير' : 'Earlier Bulletins & Dispatches'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {(otherNews.length > 0 ? otherNews : FALLBACK_NEWS.slice(1)).map((item) => {
                const title = item.title?.[isRTL ? 'ar' : 'en'] || item.title?.en || item.title
                const excerpt = item.excerpt?.[isRTL ? 'ar' : 'en'] || item.excerpt?.en || item.excerpt || item.content || ''
                const date = item.date_hijri || item.date

                return (
                  <article
                    key={item.id}
                    className="flex flex-col justify-between p-6 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript hover:border-emerald-700 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-mint-wash-100 text-emerald-700 text-xs font-semibold">
                          {isRTL ? (item.category_ar || item.category || 'تقرير') : (item.category || 'Dispatch')}
                        </span>
                        <span className="text-xs text-ink-text-muted">
                          {date}
                        </span>
                      </div>

                      <h4 className="font-serif text-base font-semibold text-ink-green-900 mb-2 leading-snug">
                        <Link to={`/news/${item.id}`} className="hover:text-emerald-700 transition-colors">
                          {title}
                        </Link>
                      </h4>

                      <p className="text-xs text-ink-text-secondary leading-relaxed line-clamp-3 mb-6 font-sans">
                        {excerpt}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-sand-border/50">
                      <Link
                        to={`/news/${item.id}`}
                        className="inline-flex items-center text-xs font-semibold text-emerald-700 hover:text-ink-green-900 gap-1"
                      >
                        <span>{isRTL ? 'قراءة الخبر' : 'Read announcement'}</span>
                        <span className="material-symbols-outlined text-[16px]">
                          {isRTL ? 'arrow_back' : 'arrow_forward'}
                        </span>
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>

        </div>
      </section>

    </div>
  )
}
