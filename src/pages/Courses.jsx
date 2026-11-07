import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { listCoursePrograms } from '../lib/contentApi'
import KhatamPattern from '../components/KhatamPattern'

const FALLBACK_COURSES = [
  {
    id: 'prog-hifz',
    category: 'Hifz',
    title: { en: 'Hifz al-Quran & Tajweed', ar: 'تحفيظ القرآن الكريم وأحكام التجويد' },
    level: 'Foundation',
    level_ar: 'المرحلة التأسيسية',
    duration: { en: '3 Years · Full Boarding', ar: '٣ سنوات · إقامة داخلية' },
    intake: { en: 'Jan 2027 (Shawwal 1448)', ar: 'شوال ١٤٤٨ هـ' },
    description: {
      en: 'Structured memorization of all 30 Juz with rigorous vocal articulation, daily Sabaq cycles, and classical Tuhfat al-Atfal text mastery.',
      ar: 'حفظ كتاب الله كاملاً وضبط التلاوة بالأحكام النظرية والتطبيقية مع حلقات المراجعة اليومية المنتظمة.'
    },
    admissionCode: 'HIFZ-2027'
  },
  {
    id: 'prog-nahw',
    category: 'Alim',
    title: { en: 'Classical Arabic, Nahw & Sarf', ar: 'قواعد اللغة العربية والنحو والصرف' },
    level: 'Intermediate',
    level_ar: 'المرحلة المتوسطة',
    duration: { en: '4 Years · Intensive', ar: '٤ سنوات · مكثف' },
    intake: { en: 'Jan 2027 (Shawwal 1448)', ar: 'شوال ١٤٤٨ هـ' },
    description: {
      en: 'Foundational linguistic transmission encompassing Al-Ajrumiyyah, Qatr al-Nada, Alfiyyah Ibn Malik, Balaghah (rhetoric), and introductory logic.',
      ar: 'دراسة متونها المعتمدة من الآجرومية وقطر الندى وألفية ابن مالك مع التدريب على الإعراب وبلاغة اللسان.'
    },
    admissionCode: 'NAHW-2027'
  },
  {
    id: 'prog-hadith',
    category: 'Alim',
    title: { en: 'Dawrah al-Hadith & Sanad Specialization', ar: 'دورة الحديث الشريف ومنح الأسانيد' },
    level: 'Advanced',
    level_ar: 'المرحلة العالية',
    duration: { en: '7 Years · Sanad Grant', ar: '٧ سنوات · إجازة بالسند' },
    intake: { en: 'Jan 2027 (Shawwal 1448)', ar: 'شوال ١٤٤٨ هـ' },
    description: {
      en: 'Exhaustive textual reading and sanad verification across the Sahih Sitta, Usul al-Hadith, comparative jurisprudence, and contemporary fatwa analysis.',
      ar: 'قراءة الكتب الستة بأسانيد متصلة ودراسة علم الجرح والتعديل وأصول الفقه المقارن وقضايا المعاملات المعاصرة.'
    },
    admissionCode: 'ALIM-2027'
  },
  {
    id: 'prog-evening-fiqh',
    category: 'Evening',
    title: { en: 'Evening Shafi’i Fiqh for Professionals', ar: 'فقه المعاملات والعبادات للمحترفين (مسائي)' },
    level: 'Continuing',
    level_ar: 'تعليم مستمر',
    duration: { en: '6 Months · Part-Time', ar: '٦ أشهر · جزئي' },
    intake: { en: 'Rolling Enrollment', ar: 'تسجيل مستمر' },
    description: {
      en: 'Evening halaqah tailored for working adults covering daily worship laws, commercial transactions, waqf principles, and family law.',
      ar: 'دروس مسائية تركز على فقه العبادات وأحكام المعاملات المالية والوقف وفقه الأسرة للموظفين وأرباب الأعمال.'
    },
    admissionCode: 'EVE-FIQH'
  },
  {
    id: 'prog-short-tajweed',
    category: 'Short Courses',
    title: { en: 'Intensive Tajweed & Makhaarij Workshop', ar: 'دورة مكثفة في ضبط المخارج وصفات الحروف' },
    level: 'Short Courses',
    level_ar: 'دورة قصيرة',
    duration: { en: '8 Weeks · Weekend', ar: '٨ أسابيع · عطلة نهاية الأسبوع' },
    intake: { en: 'Monthly Intakes', ar: 'دفعات شهرية' },
    description: {
      en: 'Hands-on correction of articulation points, phonetic rules, and oral recitation testing under certified Quranic masters.',
      ar: 'تصحيح التلاوة وتدريب الصوت ومخارج الحروف مع تطبيق عملي مباشر بإشراف قراء مجازين.'
    },
    admissionCode: 'SHORT-TAJ'
  }
]

export default function Courses() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'ar'
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [selectedCourse, setSelectedCourse] = useState(null)

  useEffect(() => {
    listCoursePrograms()
      .then((data) => {
        if (data && data.length > 0) {
          setCourses(data)
        } else {
          setCourses(FALLBACK_COURSES)
        }
      })
      .catch(() => setCourses(FALLBACK_COURSES))
      .finally(() => setLoading(false))
  }, [])

  const categories = ['All', 'Hifz', 'Alim', 'Short Courses', 'Evening']

  const filteredCourses = activeCategory === 'All'
    ? courses
    : courses.filter((c) => c.category === activeCategory)

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen relative">
      
      {/* 1. Header & Breadcrumb */}
      <section className="relative w-full bg-ink-green-900 text-paper-white py-16 overflow-hidden border-b border-sand-border/20">
        <KhatamPattern className="opacity-[0.04]" strokeColor="#FBF8F0" id="courses-khatam" />
        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <nav className="flex items-center gap-2 text-xs text-dark-text-primary/70 mb-4" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-gold-wash-100 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-brass-gold-500 font-medium">Courses</span>
          </nav>

          <span className="text-xs font-semibold uppercase tracking-widest text-brass-gold-500 mb-2 block">
            {isRTL ? 'البرامج والدورات' : 'Academic Offerings'}
          </span>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-paper-white tracking-tight">
            {isRTL ? 'المسارات التعليمية والدورات الشرعية' : 'Courses & Scholarly Programs'}
          </h1>
          <p className="font-serif text-sm sm:text-base text-dark-text-primary/80 mt-3 max-w-2xl leading-relaxed">
            {isRTL
              ? 'مجموعة متكاملة من البرامج الأكاديمية المنتظمة والدورات المسائية لخدمة القرآن الكريم والعلوم الشرعية.'
              : 'Rigorous pathways spanning foundational Quranic memorization, advanced Alim sanad training, and continuing adult education.'}
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
                  {cat}
                </button>
              ))}
            </div>

            <span className="text-xs text-ink-text-muted">
              Showing <strong className="text-ink-text-primary tabular-nums">{filteredCourses.length}</strong> programs
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
                search_off
              </span>
              <h3 className="font-serif text-lg font-semibold text-ink-green-900 mb-1">
                No courses in this category
              </h3>
              <p className="text-xs text-ink-text-secondary mb-6">
                Try selecting another category or browse our full curriculum.
              </p>
              <button
                type="button"
                onClick={() => setActiveCategory('All')}
                className="px-4 py-2 bg-emerald-700 text-white rounded-[10px] text-xs font-semibold"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            /* 3-Column Modern Manuscript Course Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCourses.map((c) => {
                const title = c.title?.[isRTL ? 'ar' : 'en'] || c.title?.en || c.title || ''
                const desc = c.description?.[isRTL ? 'ar' : 'en'] || c.description?.en || c.description || ''
                const duration = c.duration?.[isRTL ? 'ar' : 'en'] || c.duration?.en || c.duration || ''
                const intake = c.intake?.[isRTL ? 'ar' : 'en'] || c.intake?.en || 'Upcoming Intake 2027'
                const level = isRTL ? (c.level_ar || c.level || 'معتمد') : (c.level || 'Accredited')

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
                          <span className="material-symbols-outlined text-[15px] text-brass-gold-500">calendar_month</span>
                          <span>Intake: {intake}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCourse(c)}
                        className="text-xs font-semibold text-ink-text-secondary hover:text-emerald-700 inline-flex items-center gap-1"
                      >
                        <span>View details</span>
                        <span className="material-symbols-outlined text-[15px]">info</span>
                      </button>

                      <Link
                        to="/admissions"
                        className="px-4 py-2 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors"
                      >
                        {isRTL ? 'تقديم طلب' : 'Apply'}
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
                {selectedCourse.level || 'Program Details'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedCourse(null)}
                className="w-8 h-8 rounded-full border border-sand-border flex items-center justify-center text-ink-text-secondary hover:bg-sand-border/30"
              >
                ✕
              </button>
            </div>

            <h3 className="font-serif text-2xl font-semibold text-ink-green-900">
              {selectedCourse.title?.[isRTL ? 'ar' : 'en'] || selectedCourse.title?.en}
            </h3>

            <p className="text-sm text-ink-text-secondary leading-relaxed">
              {selectedCourse.description?.[isRTL ? 'ar' : 'en'] || selectedCourse.description?.en}
            </p>

            <div className="p-4 rounded-xl bg-parchment-50 border border-sand-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-text-muted">Duration:</span>
                <span className="font-semibold text-ink-green-900">{selectedCourse.duration?.en || selectedCourse.duration}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-text-muted">Intake Cycle:</span>
                <span className="font-semibold text-ink-green-900">{selectedCourse.intake?.en || 'Annual'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-text-muted">Tuition Waqf:</span>
                <span className="font-semibold text-ink-green-900">Residential Scholarships Available</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setSelectedCourse(null)}
                className="px-4 py-2 border border-sand-border rounded-[10px] text-xs font-medium text-ink-text-secondary"
              >
                Close
              </button>
              <Link
                to="/admissions"
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-500 text-white rounded-[10px] text-xs font-semibold"
              >
                Apply for Program
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Floating Sticky Right-Aligned Apply Pill */}
      <div className="fixed bottom-6 right-6 z-40">
        <Link
          to="/admissions"
          className="inline-flex items-center gap-2 h-12 px-5 rounded-full bg-emerald-700 hover:bg-emerald-500 text-white shadow-manuscript-lg border border-white/20 text-xs font-semibold tracking-wide transition-transform hover:scale-105"
        >
          <span className="material-symbols-outlined text-[18px]">edit_document</span>
          <span>{isRTL ? 'قدّم للالتحاق الآن' : 'Apply for Admission'}</span>
        </Link>
      </div>

    </div>
  )
}
