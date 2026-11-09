import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { listCoursePrograms } from '../lib/contentApi'
import KhatamPattern from '../components/KhatamPattern'
import { localized } from '../lib/localized';
import { tx } from '../lib/tx';

/** The January intake: from July onwards applications are for next year. */
function intakeYears(now = new Date()) {
  const year = now.getFullYear() + (now.getMonth() >= 6 ? 1 : 0)
  let hijri = String(Math.floor((year - 622) * (33 / 32)))
  try {
    const y = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { year: 'numeric' })
      .formatToParts(new Date(year, 0, 15)).find((p) => p.type === 'year')?.value
    if (y && /^\d+$/.test(y)) hijri = y
  } catch {
    /* calendar not supported — arithmetic estimate */
  }
  return { year, hijri }
}

/** Sample programs shown until the CMS has course programs (built at render so text follows the UI language). */
function fallbackCourses() {
  const { year, hijri } = intakeYears()
  const annual = tx('شوال {hijri} هـ (يناير {year})', 'Jan {year} (Shawwal {hijri})').replace('{year}', year).replace('{hijri}', hijri)
  return [
    {
      id: 'prog-hifz',
      category: 'hifz',
      title: tx('تحفيظ القرآن الكريم وأحكام التجويد', 'Hifz al-Quran & Tajweed'),
      level: tx('المرحلة التأسيسية', 'Foundation'),
      duration: tx('٣ سنوات · إقامة داخلية', '3 Years · Full Boarding'),
      intake: annual,
      description: tx('حفظ كتاب الله كاملاً وضبط التلاوة بالأحكام النظرية والتطبيقية مع حلقات المراجعة اليومية المنتظمة.', 'Structured memorization of all 30 Juz with rigorous vocal articulation, daily Sabaq cycles, and classical Tuhfat al-Atfal text mastery.'),
      admissionCode: `HIFZ-${year}`,
    },
    {
      id: 'prog-nahw',
      category: 'alim',
      title: tx('قواعد اللغة العربية والنحو والصرف', 'Classical Arabic, Nahw & Sarf'),
      level: tx('المرحلة المتوسطة', 'Intermediate'),
      duration: tx('٤ سنوات · مكثف', '4 Years · Intensive'),
      intake: annual,
      description: tx('دراسة متونها المعتمدة من الآجرومية وقطر الندى وألفية ابن مالك مع التدريب على الإعراب وبلاغة اللسان.', 'Foundational linguistic transmission encompassing Al-Ajrumiyyah, Qatr al-Nada, Alfiyyah Ibn Malik, Balaghah (rhetoric), and introductory logic.'),
      admissionCode: `NAHW-${year}`,
    },
    {
      id: 'prog-hadith',
      category: 'alim',
      title: tx('دورة الحديث الشريف ومنح الأسانيد', 'Dawrah al-Hadith & Sanad Specialization'),
      level: tx('المرحلة العالية', 'Advanced'),
      duration: tx('٧ سنوات · إجازة بالسند', '7 Years · Sanad Grant'),
      intake: annual,
      description: tx('قراءة الكتب الستة بأسانيد متصلة ودراسة علم الجرح والتعديل وأصول الفقه المقارن وقضايا المعاملات المعاصرة.', 'Exhaustive textual reading and sanad verification across the Sahih Sitta, Usul al-Hadith, comparative jurisprudence, and contemporary fatwa analysis.'),
      admissionCode: `ALIM-${year}`,
    },
    {
      id: 'prog-evening-fiqh',
      category: 'evening',
      title: tx('فقه المعاملات والعبادات للمحترفين (مسائي)', 'Evening Shafi’i Fiqh for Professionals'),
      level: tx('تعليم مستمر', 'Continuing'),
      duration: tx('٦ أشهر · جزئي', '6 Months · Part-Time'),
      intake: tx('تسجيل مستمر', 'Rolling Enrollment'),
      description: tx('دروس مسائية تركز على فقه العبادات وأحكام المعاملات المالية والوقف وفقه الأسرة للموظفين وأرباب الأعمال.', 'Evening halaqah tailored for working adults covering daily worship laws, commercial transactions, waqf principles, and family law.'),
      admissionCode: 'EVE-FIQH',
    },
    {
      id: 'prog-short-tajweed',
      category: 'short',
      title: tx('دورة مكثفة في ضبط المخارج وصفات الحروف', 'Intensive Tajweed & Makhaarij Workshop'),
      level: tx('دورة قصيرة', 'Short Course'),
      duration: tx('٨ أسابيع · عطلة نهاية الأسبوع', '8 Weeks · Weekend'),
      intake: tx('دفعات شهرية', 'Monthly Intakes'),
      description: tx('تصحيح التلاوة وتدريب الصوت ومخارج الحروف مع تطبيق عملي مباشر بإشراف قراء مجازين.', 'Hands-on correction of articulation points, phonetic rules, and oral recitation testing under certified Quranic masters.'),
      admissionCode: 'SHORT-TAJ',
    },
  ]
}

export default function Courses() {
  useTranslation() // re-render on language change
  const [cmsCourses, setCmsCourses] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    listCoursePrograms()
      .then((data) => setCmsCourses(data && data.length > 0 ? data : null))
      .catch(() => setCmsCourses(null))
      .finally(() => setLoading(false))
  }, [])

  const courses = cmsCourses || fallbackCourses()
  const categoryLabels = {
    all: tx('الكل', 'All'),
    hifz: tx('الحفظ', 'Hifz'),
    alim: tx('العالمية', 'Alim'),
    short: tx('دورات قصيرة', 'Short Courses'),
    evening: tx('مسائي', 'Evening'),
  }
  // CMS programs carry no category, so the filter only applies to the sample programs
  const categories = courses.some((c) => c.category) ? Object.keys(categoryLabels) : []
  const selectedCourse = courses.find((c) => c.id === selectedId) || null
  const { year: intakeYear } = intakeYears()

  const filteredCourses = activeCategory === 'all'
    ? courses
    : courses.filter((c) => c.category === activeCategory)

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen relative">
      
      {/* 1. Header & Breadcrumb */}
      <section className="relative w-full bg-ink-green-900 text-paper-white py-16 overflow-hidden border-b border-sand-border/20">
        <img src="/images/campus/building.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-ink-green-900/85" aria-hidden="true" />
        <KhatamPattern className="opacity-[0.04]" strokeColor="#FBF8F0" id="courses-khatam" />
        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <nav className="flex items-center gap-2 text-xs text-dark-text-primary/70 mb-4" aria-label={tx('مسار التنقل', 'Breadcrumb')}>
            <Link to="/" className="hover:text-gold-wash-100 transition-colors">{tx('الرئيسية', 'Home')}</Link>
            <span>/</span>
            <span className="text-brass-gold-500 font-medium">{tx('الدورات', 'Courses')}</span>
          </nav>

          <span className="text-xs font-semibold uppercase tracking-widest text-brass-gold-500 mb-2 block">
            {tx('البرامج والدورات', 'Academic Offerings')}
          </span>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-paper-white tracking-tight">
            {tx('المسارات التعليمية والدورات الشرعية', 'Courses & Scholarly Programs')}
          </h1>
          <p className="font-serif text-sm sm:text-base text-dark-text-primary/80 mt-3 max-w-2xl leading-relaxed">
            {tx('مجموعة متكاملة من البرامج الأكاديمية المنتظمة والدورات المسائية لخدمة القرآن الكريم والعلوم الشرعية.', 'Rigorous pathways spanning foundational Quranic memorization, advanced Alim sanad training, and continuing adult education.')}
          </p>
        </div>
      </section>

      {/* 2. Filter Bar & Listing */}
      <section className="w-full py-12">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Filter Chips */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-10 pb-6 border-b border-sand-border">
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 text-xs font-semibold rounded-full border transition-colors ${
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
              {tx('عرض', 'Showing')} <strong className="text-ink-text-primary tabular-nums">{filteredCourses.length}</strong> {tx('برامج', 'programs')}
            </span>
          </div>

          {/* Skeletons Loading State */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((s) => (
                <div key={s} className="p-6 rounded-[14px] bg-paper-white border border-sand-border animate-pulse space-y-4">
                  <div className="h-6 bg-sand-border/40 rounded w-1/3"></div>
                  <div className="h-8 bg-sand-border/50 rounded w-3/4"></div>
                  <div className="h-20 bg-sand-border/30 rounded"></div>
                  <div className="h-10 bg-sand-border/40 rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredCourses.length === 0 ? (
            /* Empty State */
            <div className="p-12 text-center rounded-[14px] bg-paper-white border border-sand-border max-w-lg mx-auto my-8">
              <span className="material-symbols-outlined text-4xl text-ink-text-muted mb-3 block">
                {'search_off'}
              </span>
              <h3 className="font-serif text-lg font-semibold text-ink-green-900 mb-1">
                {tx('لا توجد دورات في هذه الفئة', 'No courses in this category')}
              </h3>
              <p className="text-xs text-ink-text-secondary mb-6">
                {tx('جرّب اختيار فئة أخرى أو تصفح المنهج الكامل.', 'Try selecting another category or browse our full curriculum.')}
              </p>
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className="px-4 py-2 bg-emerald-700 text-white rounded-[10px] text-xs font-semibold"
              >
                {tx('إعادة تعيين التصفية', 'Reset Filter')}
              </button>
            </div>
          ) : (
            /* 3-Column Modern Manuscript Course Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCourses.map((c) => {
                const title = localized(c.title)
                const desc = localized(c.description)
                const duration = localized(c.duration)
                const intake = localized(c.intake) || tx('الدفعة القادمة {year}', 'Upcoming Intake {year}').replace('{year}', intakeYear)
                const level = localized(c.level) || tx('معتمد', 'Accredited')

                return (
                  <div
                    key={c.id}
                    className="flex flex-col justify-between p-7 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript hover:border-emerald-700 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-mint-wash-100 text-emerald-700 text-xs font-semibold">
                          {level}
                        </span>
                        <span className="text-xs text-ink-text-muted font-medium">
                          {duration}
                        </span>
                      </div>

                      <h3 className="font-serif text-xl font-semibold text-ink-green-900 mb-2 leading-snug">
                        {title}
                      </h3>

                      <p className="text-xs text-ink-text-secondary leading-relaxed mb-6 font-sans">
                        {desc}
                      </p>

                      <div className="pt-4 border-t border-sand-border/60 text-xs text-ink-text-muted mb-6 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px] text-brass-gold-500">{'calendar_month'}</span>
                          <span>{tx('القبول:', 'Intake:')} {intake}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        className="text-xs font-semibold text-ink-text-secondary hover:text-emerald-700 inline-flex items-center gap-1"
                      >
                        <span>{tx('عرض التفاصيل', 'View details')}</span>
                        <span className="material-symbols-outlined text-[15px]">{'info'}</span>
                      </button>

                      <Link
                        to="/admissions"
                        className="px-4 py-2 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors"
                      >
                        {tx('تقديم طلب', 'Apply')}
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </section>

      {/* Course Detail Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-green-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-[14px] bg-paper-white border border-sand-border p-6 sm:p-8 shadow-manuscript-lg space-y-5">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-mint-wash-100 text-emerald-700 text-xs font-semibold">
                {localized(selectedCourse.level) || tx('تفاصيل البرنامج', 'Program Details')}
              </span>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label={tx('إغلاق', 'Close')}
                className="w-8 h-8 rounded-full border border-sand-border flex items-center justify-center text-ink-text-secondary hover:bg-sand-border/30"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <h3 className="font-serif text-2xl font-semibold text-ink-green-900">
              {localized(selectedCourse.title)}
            </h3>

            <p className="text-sm text-ink-text-secondary leading-relaxed">
              {localized(selectedCourse.description)}
            </p>

            <div className="p-4 rounded-xl bg-parchment-50 border border-sand-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-text-muted">{tx('المدة:', 'Duration:')}</span>
                <span className="font-semibold text-ink-green-900">{localized(selectedCourse.duration)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-text-muted">{tx('دورة القبول:', 'Intake Cycle:')}</span>
                <span className="font-semibold text-ink-green-900">{localized(selectedCourse.intake) || tx('سنوي', 'Annual')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-text-muted">{tx('وقف الرسوم الدراسية:', 'Tuition Waqf:')}</span>
                <span className="font-semibold text-ink-green-900">{tx('منح للسكن الداخلي متاحة', 'Residential Scholarships Available')}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="px-4 py-2 border border-sand-border rounded-[10px] text-xs font-medium text-ink-text-secondary"
              >
                {tx('إغلاق', 'Close')}
              </button>
              <Link
                to="/admissions"
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-500 text-white rounded-[10px] text-xs font-semibold"
              >
                {tx('التقديم على البرنامج', 'Apply for Program')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Floating Sticky Right-Aligned Apply Pill */}
      <div className="fixed bottom-6 end-6 z-40">
        <Link
          to="/admissions"
          className="inline-flex items-center gap-2 h-12 px-5 rounded-full bg-emerald-700 hover:bg-emerald-500 text-white shadow-manuscript-lg border border-white/20 text-xs font-semibold tracking-wide transition-transform hover:scale-105"
        >
          <span className="material-symbols-outlined text-[18px]">{'edit_document'}</span>
          <span>{tx('قدّم للالتحاق الآن', 'Apply for Admission')}</span>
        </Link>
      </div>

    </div>
  )
}
