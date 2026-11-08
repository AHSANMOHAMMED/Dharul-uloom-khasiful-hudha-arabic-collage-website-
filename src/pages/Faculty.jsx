import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { listFaculty, resolveContentUrl } from '../lib/contentApi'
import KhatamPattern from '../components/KhatamPattern'
import { localized } from '../lib/localized';
import { tx } from '../lib/tx';

/** Department keys → label in the UI language. */
const departmentLabels = () => ({
  all: tx('الكل', 'All'),
  quran: tx('قسم القرآن والتجويد', 'Quran & Tajweed'),
  hadith: tx('قسم الحديث والسند', 'Hadith & Isnad'),
  fiqh: tx('قسم الفقه وأصوله', 'Fiqh & Usul'),
  arabic: tx('قسم اللغة العربية والنحو', 'Arabic Grammar'),
  humanities: tx('قسم السيرة والدراسات العامة', 'Humanities & English'),
})

/** Sample faculty shown until the CMS has entries (built at render so text follows the UI language). */
const fallbackFaculty = () => [
  {
    id: 'f1',
    name: 'Ustaz Abdul Hakeem Al-Kashifi',
    name_ar: 'الشيخ عبد الحكيم الكاشفي',
    title: tx('مدير الكلية وأستاذ الحديث الشريف', 'Principal & Senior Hadith Lecturer'),
    department: 'hadith',
    qualifications: tx('العالمية (سند متصل)، ماجستير في الدراسات الإسلامية', 'Al-Alimiyyah (Sanad Muttasil), M.A. Islamic Studies'),
    email: 'hakeem@kashifulhudha.edu.lk',
    bio: tx('يخدم الكلية منذ عام 2006. يحمل أسانيد متصلة في الكتب الستة عن كبار شيوخ الحديث في جنوب آسيا والحجاز.', 'Serving the institution since 2006. Holds authenticated sanad chains in the Sahih Sitta compendiums transmitting directly from senior South Asian and Hejazi hadith masters.'),
    subjects: [tx('صحيح البخاري', 'Sahih al-Bukhari'), tx('مصطلح الحديث', 'Mustalah al-Hadith'), tx('الفقه المقارن', 'Comparative Jurisprudence')],
  },
  {
    id: 'f2',
    name: 'Qari Muhammad Rizwan Al-Qasimi',
    name_ar: 'القارئ محمد رضوان القاسمي',
    title: tx('رئيس قسم القرآن الكريم والتجويد', 'Head of Quran & Tajweed Faculty'),
    department: 'quran',
    qualifications: tx('إجازة في روايتي حفص وشعبة، أكثر من 20 عاماً في تحفيظ القرآن', 'Ijazah in Hafs & Shu’bah, 20+ Years Hifz Mentorship'),
    email: 'rizwan@kashifulhudha.edu.lk',
    bio: tx('المدرس الأول لبرنامج الحفظ الداخلي. تخرج على يديه أكثر من 120 حافظاً يعملون أئمة في سريلانكا ودول الخليج.', 'Lead instructor for the residential Hifz program. Has produced over 120 completed Huffaz serving as imams across Sri Lanka and the Gulf region.'),
    subjects: [tx('حفظ القرآن', 'Hifz al-Quran'), tx('تحفة الأطفال', 'Tuhfat al-Atfal'), tx('متن الجزرية', 'Al-Jazariyyah Text'), tx('مخارج الحروف', 'Makharij Articulation')],
  },
  {
    id: 'f3',
    name: 'Ustaz Mohamed Aslam',
    name_ar: 'الأستاذ محمد أسلم',
    title: tx('أستاذ النحو والصرف والبلاغة', 'Senior Lecturer — Classical Arabic & Syntax'),
    department: 'arabic',
    qualifications: tx('بكالوريوس في اللسانيات العربية، سند العالمية', 'B.A. Arabic Linguistics, Al-Alimiyyah Sanad'),
    email: 'aslam@kashifulhudha.edu.lk',
    bio: tx('متخصص في المسائل النحوية الخلافية وبحور الشعر. يشرف على حلقة المناظرة العربية ومنشورات المقالات في الكلية.', 'Specialist in classical Arabic grammatical disputations and poetic meters. Directs the college Arabic rhetorical debate circle and essay publications.'),
    subjects: [tx('ألفية ابن مالك', 'Alfiyyah Ibn Malik'), tx('قطر الندى', 'Qatr al-Nada'), tx('البلاغة', 'Balaghah (Rhetoric)'), tx('علم الصرف', 'Classical Sarf')],
  },
  {
    id: 'f4',
    name: 'Ustaz Nabeel Al-Azhari',
    name_ar: 'الشيخ نبيل الأزهري',
    title: tx('مدرس الفقه الشافعي وأصول الفقه', 'Lecturer in Shafi’i Fiqh & Usul'),
    department: 'fiqh',
    qualifications: tx('خريج جامعة الأزهر، الشريعة والقانون', 'Al-Azhar University Graduate, Sharia & Law'),
    email: 'nabeel@kashifulhudha.edu.lk',
    bio: tx('يدرّس متون الفقه الشافعي وأحكام المعاملات والوقف وعلم الفرائض.', 'Teaches classical Shafi’i legal texts, commercial transaction waqf codes, and Islamic inheritance distribution (Fara’id).'),
    subjects: [tx('متن أبي شجاع', 'Matn Abi Shuja'), tx('منهاج الطالبين', 'Minhaj at-Talibin'), tx('الورقات', 'Al-Waraqat'), tx('علم المواريث', 'Islamic Inheritance (Mawarith)')],
  },
  {
    id: 'f5',
    name: 'Ustaz Tariq Mansoor',
    name_ar: 'الأستاذ طارق منصور',
    title: tx('مدرس السيرة والتاريخ الإسلامي', 'Instructor in Seerah & Islamic History'),
    department: 'humanities',
    qualifications: tx('بكالوريوس في التربية، شهادة في السيرة النبوية', 'B.Ed, Certificate in Prophetic Epistemology'),
    email: 'tariq@kashifulhudha.edu.lk',
    bio: tx('يشرف على السياق التاريخي للمخطوطات، ومهارات التواصل بالإنجليزية لطلاب العلم، ورعاية الطلاب.', 'Oversees historical manuscript context, English communication skills for religious scholars, and student pastoral welfare.'),
    subjects: [tx('السيرة النبوية', 'Al-Seerah al-Nabawiyyah'), tx('الحضارات الإسلامية', 'Islamic Civilizations'), tx('اللغة الإنجليزية لطلاب العلم', 'English for Scholars')],
  },
  {
    id: 'f6',
    name: 'Qari Zameer Ahmed',
    name_ar: 'القارئ ضمير أحمد',
    title: tx('مشرف حلقات الحفظ والمراجعة', 'Hifz Sabaq Supervisor'),
    department: 'quran',
    qualifications: tx('حافظ للقرآن، سند في التجويد', 'Hafiz al-Quran, Tajweed Sanad'),
    email: 'zameer@kashifulhudha.edu.lk',
    bio: tx('يدير حلقات السبق الصباحية والتسميع الفردي اليومي لطلاب المرحلة التأسيسية الداخليين.', 'Conducts morning Sabaq circles and daily individual verification for residential foundation students.'),
    subjects: [tx('مراجعة السبق الفردية', 'Individual Sabaq Review'), tx('دورات المراجعة (السبقي)', 'Sabqi Retention Cycles'), tx('كتابة القرآن', 'Quranic Transcription')],
  },
]

/** CMS row (contentApi.listFaculty) → card fields in the UI language. */
function fromCms(f, i, lang) {
  const quals = Array.isArray(f.qualifications) ? f.qualifications : [f.qualifications].filter(Boolean)
  return {
    id: f._id || f.id || `fac-${i}`,
    name: localized(f.name),
    // Arabic name as a secondary line (not repeated when the UI is already Arabic)
    name_ar: lang !== 'ar' && f.name?.ar && f.name.ar !== f.name.en ? f.name.ar : '',
    title: localized(f.role) || tx('عضو هيئة التدريس', 'Faculty Member'),
    department: '',
    qualifications: quals.join(' · '),
    email: f.email || '',
    bio: localized(f.bio),
    subjects: Array.isArray(f.subjects) ? f.subjects : [],
    image: f.image ? resolveContentUrl(f.image) : null,
  }
}

export default function Faculty() {
  const { i18n } = useTranslation()
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDept, setSelectedDept] = useState('all')
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    listFaculty()
      .then((data) => setRows(data && data.length > 0 ? data : null))
      .catch(() => setRows(null))
      .finally(() => setLoading(false))
  }, [])

  // built at render so names/roles follow the current UI language
  const faculty = rows ? rows.map((f, i) => fromCms(f, i, i18n.language)) : fallbackFaculty()
  const deptLabels = departmentLabels()
  // department filter only applies to entries that carry a department
  const departments = rows ? [] : Object.keys(deptLabels)
  const selectedFaculty = faculty.find((f) => f.id === selectedId) || null

  const filteredFaculty = faculty.filter((f) => {
    const matchesDept = selectedDept === 'all' || f.department === selectedDept
    const query = searchQuery.toLowerCase().trim()
    const matchesSearch = !query ||
      (f.name && f.name.toLowerCase().includes(query)) ||
      (f.name_ar && f.name_ar.includes(query)) ||
      (f.title && f.title.toLowerCase().includes(query)) ||
      (f.qualifications && f.qualifications.toLowerCase().includes(query))
    return matchesDept && matchesSearch
  })

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen relative">
      
      {/* 1. Header & Breadcrumb */}
      <section className="relative w-full bg-ink-green-900 text-paper-white py-16 overflow-hidden border-b border-sand-border/20">
        <KhatamPattern className="opacity-[0.04]" strokeColor="#FBF8F0" id="faculty-khatam" />
        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <nav className="flex items-center gap-2 text-xs text-dark-text-primary/70 mb-4" aria-label={tx('مسار التنقل', 'Breadcrumb')}>
            <Link to="/" className="hover:text-gold-wash-100 transition-colors">{tx('الرئيسية', 'Home')}</Link>
            <span>/</span>
            <span className="text-brass-gold-500 font-medium">{tx('هيئة التدريس', 'Faculty')}</span>
          </nav>

          <span className="text-xs font-semibold uppercase tracking-widest text-brass-gold-500 mb-2 block">
            {tx('هيئة التدريس والمشايخ', 'Scholarly Assembly')}
          </span>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-paper-white tracking-tight">
            {tx('العلماء والأساتذة الأجلاء', 'Distinguished Faculty & Mentors')}
          </h1>
          <p className="font-serif text-sm sm:text-base text-dark-text-primary/80 mt-3 max-w-2xl leading-relaxed">
            {tx('نخبة من العلماء المسندين والقراء المجازين المكرسين لبناء عقول الأجيال وتزكية نفوسهم.', 'Scholars, huffaz, and linguists dedicated to classical transmission, textual precision, and fatherly mentorship.')}
          </p>
        </div>
      </section>

      {/* 2. Search & Department Filter Bar */}
      <section className="w-full py-10 border-b border-sand-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          
          {/* Search Box */}
          <div className="max-w-md w-full bg-paper-white p-2 rounded-[14px] border border-sand-border shadow-xs flex items-center">
            <span className="material-symbols-outlined text-ink-text-muted mx-3">{'search'}</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tx('ابحث باسم الأستاذ، التخصص، أو المؤهل...', 'Search by name, department, or qualification...')}
              className="w-full bg-transparent text-xs sm:text-sm text-ink-text-primary focus:outline-none placeholder:text-ink-text-muted"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs text-ink-text-muted hover:text-ink-text-primary px-2"
              >
                {tx('مسح', 'Clear')}
              </button>
            )}
          </div>

          {/* Department Filter Chips */}
          {departments.length > 0 && <div className="flex flex-wrap items-center gap-2">
            {departments.map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => setSelectedDept(dept)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                  selectedDept === dept
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-paper-white text-ink-text-secondary border-sand-border hover:bg-sand-border/30'
                }`}
              >
                {deptLabels[dept]}
              </button>
            ))}
          </div>}

        </div>
      </section>

      {/* 3. 4-Column Modern Manuscript Faculty Grid */}
      <section className="w-full py-16">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="p-6 rounded-[14px] bg-paper-white border border-sand-border animate-pulse space-y-4">
                  <div className="w-24 h-24 bg-sand-border/40 rounded-full mx-auto"></div>
                  <div className="h-5 bg-sand-border/50 rounded w-3/4 mx-auto"></div>
                  <div className="h-4 bg-sand-border/30 rounded w-1/2 mx-auto"></div>
                </div>
              ))}
            </div>
          ) : filteredFaculty.length === 0 ? (
            <div className="p-12 text-center rounded-[14px] bg-paper-white border border-sand-border max-w-md mx-auto">
              <span className="material-symbols-outlined text-4xl text-ink-text-muted mb-2 block">{'person_search'}</span>
              <p className="text-sm font-semibold text-ink-green-900 mb-1">{tx('لم يتم العثور على أساتذة', 'No faculty found')}</p>
              <p className="text-xs text-ink-text-secondary">{tx('جرّب البحث بكلمة أخرى أو إعادة تعيين القسم.', 'Try searching with a different term or resetting the department.')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredFaculty.map((member) => (
                <div
                  key={member.id}
                  onClick={() => setSelectedId(member.id)}
                  className="group flex flex-col justify-between p-6 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript hover:border-emerald-700 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                >
                  <div className="flex flex-col items-center text-center">
                    
                    {/* Square Portrait with Subtle Border */}
                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-sand-border/30 border border-sand-border mb-4 group-hover:border-emerald-700 transition-colors flex items-center justify-center">
                      {member.image ? (
                        <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-4xl text-emerald-700/70">
                          {'account_circle'}
                        </span>
                      )}
                    </div>

                    <h3 className="font-serif text-base font-semibold text-ink-green-900 group-hover:text-emerald-700 transition-colors leading-snug">
                      {member.name}
                    </h3>

                    {member.name_ar && (
                      <span className="font-arabic text-xs text-brass-gold-500 mt-1" dir="rtl">
                        {member.name_ar}
                      </span>
                    )}

                    <span className="text-xs text-ink-text-secondary font-medium mt-2 leading-tight">
                      {member.title}
                    </span>

                    <span className="text-[11px] text-ink-text-muted mt-2 pt-2 border-t border-sand-border/50 w-full line-clamp-1">
                      {member.qualifications}
                    </span>
                  </div>

                  <div className="pt-4 mt-4 border-t border-sand-border/50 flex items-center justify-between text-xs text-ink-text-muted">
                    <span className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold">
                      {tx('عرض الملف', 'View profile')}
                    </span>
                    {member.email && <a
                      href={`mailto:${member.email}`}
                      onClick={(e) => e.stopPropagation()}
                      title={`${tx('مراسلة', 'Email')} ${member.name}`}
                      className="w-7 h-7 rounded-full border border-sand-border flex items-center justify-center hover:bg-emerald-700 hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-[15px]">{'mail'}</span>
                    </a>}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </section>

      {/* 4. Side Drawer Modal for Faculty Biography */}
      {selectedFaculty && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-ink-green-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md h-full bg-paper-white border-l border-sand-border shadow-manuscript-lg p-6 sm:p-8 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              
              <div className="flex items-center justify-between pb-4 border-b border-sand-border">
                <span className="px-2.5 py-0.5 rounded-full bg-mint-wash-100 text-emerald-700 text-xs font-semibold">
                  {deptLabels[selectedFaculty.department] || tx('هيئة التدريس', 'Faculty')}
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

              <div>
                <h3 className="font-serif text-2xl font-semibold text-ink-green-900">
                  {selectedFaculty.name}
                </h3>
                {selectedFaculty.name_ar && (
                  <p className="font-arabic text-base text-brass-gold-500 mt-1" dir="rtl">
                    {selectedFaculty.name_ar}
                  </p>
                )}
                <p className="text-xs text-ink-text-secondary font-medium mt-2">
                  {selectedFaculty.title}
                </p>
              </div>

              {(selectedFaculty.qualifications || selectedFaculty.email) && <div className="p-4 rounded-xl bg-parchment-50 border border-sand-border text-xs space-y-2">
                {selectedFaculty.qualifications && <div>
                  <span className="text-ink-text-muted block font-medium">{tx('السند العلمي / المؤهلات:', 'Scholastic Sanad / Credentials:')}</span>
                  <span className="font-semibold text-ink-green-900">{selectedFaculty.qualifications}</span>
                </div>}
                {selectedFaculty.email && <div>
                  <span className="text-ink-text-muted block font-medium">{tx('التواصل المباشر:', 'Direct Contact:')}</span>
                  <a href={`mailto:${selectedFaculty.email}`} className="text-emerald-700 hover:underline">
                    {selectedFaculty.email}
                  </a>
                </div>}
              </div>}

              {selectedFaculty.bio && <div>
                <h4 className="font-serif text-sm font-semibold text-ink-green-900 mb-2">
                  {tx('السيرة الذاتية والسند العلمي', 'Biography & Scholastic Transmission')}
                </h4>
                <p className="text-xs text-ink-text-secondary leading-relaxed font-sans">
                  {selectedFaculty.bio}
                </p>
              </div>}

              {selectedFaculty.subjects.length > 0 && <div>
                <h4 className="font-serif text-sm font-semibold text-ink-green-900 mb-2">
                  {tx('المواد والحلقات التي يدرّسها', 'Subjects & Halaqat Taught')}
                </h4>
                <ul className="space-y-1.5 text-xs text-ink-text-secondary">
                  {selectedFaculty.subjects.map((sub, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-brass-gold-500"></span>
                      <span>{sub}</span>
                    </li>
                  ))}
                </ul>
              </div>}

            </div>

            <div className="pt-6 border-t border-sand-border">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="w-full h-10 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
              >
                {tx('إغلاق السيرة', 'Close Biography')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
