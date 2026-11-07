import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { listFaculty } from '../lib/contentApi'
import KhatamPattern from '../components/KhatamPattern'

const FALLBACK_FACULTY = [
  {
    id: 'f1',
    name: 'Ustaz Abdul Hakeem Al-Kashifi',
    name_ar: 'الشيخ عبد الحكيم الكاشفي',
    title: 'Principal & Senior Hadith Lecturer',
    title_ar: 'مدير الكلية وأستاذ الحديث الشريف',
    department: 'Hadith & Isnad',
    department_ar: 'قسم الحديث والسند',
    qualifications: 'Al-Alimiyyah (Sanad Muttasil), M.A. Islamic Studies',
    email: 'hakeem@kashifulhudha.edu.lk',
    bio: 'Serving the institution since 2006. Holds authenticated sanad chains in the Sahih Sitta compendiums transmitting directly from senior South Asian and Hejazi hadith masters.',
    subjects: ['Sahih al-Bukhari', 'Mustalah al-Hadith', 'Comparative Jurisprudence']
  },
  {
    id: 'f2',
    name: 'Qari Muhammad Rizwan Al-Qasimi',
    name_ar: 'القارئ محمد رضوان القاسمي',
    title: 'Head of Quran & Tajweed Faculty',
    title_ar: 'رئيس قسم القرآن الكريم والتجويد',
    department: 'Quran & Tajweed',
    department_ar: 'قسم القرآن والتجويد',
    qualifications: 'Ijazah in Hafs & Shu’bah, 20+ Years Hifz Mentorship',
    email: 'rizwan@kashifulhudha.edu.lk',
    bio: 'Lead instructor for the residential Hifz program. Has produced over 120 completed Huffaz serving as imams across Sri Lanka and the Gulf region.',
    subjects: ['Hifz al-Quran', 'Tuhfat al-Atfal', 'Al-Jazariyyah Text', 'Makharij Articulation']
  },
  {
    id: 'f3',
    name: 'Ustaz Mohamed Aslam',
    name_ar: 'الأستاذ محمد أسلم',
    title: 'Senior Lecturer — Classical Arabic & Syntax',
    title_ar: 'أستاذ النحو والصرف والبلاغة',
    department: 'Arabic Grammar',
    department_ar: 'قسم اللغة العربية والنحو',
    qualifications: 'B.A. Arabic Linguistics, Al-Alimiyyah Sanad',
    email: 'aslam@kashifulhudha.edu.lk',
    bio: 'Specialist in classical Arabic grammatical disputations and poetic meters. Directs the college Arabic rhetorical debate circle and essay publications.',
    subjects: ['Alfiyyah Ibn Malik', 'Qatr al-Nada', 'Balaghah (Rhetoric)', 'Classical Sarf']
  },
  {
    id: 'f4',
    name: 'Ustaz Fathima Nabeel Al-Azhari',
    name_ar: 'الشيخ نبيل الأزهري',
    title: 'Lecturer in Shafi’i Fiqh & Usul',
    title_ar: 'مدرس الفقه الشافعي وأصول الفقه',
    department: 'Fiqh & Usul',
    department_ar: 'قسم الفقه وأصوله',
    qualifications: 'Al-Azhar University Graduate, Sharia & Law',
    email: 'nabeel@kashifulhudha.edu.lk',
    bio: 'Teaches classical Shafi’i legal texts, commercial transaction waqf codes, and Islamic inheritance distribution (Fara’id).',
    subjects: ['Matn Abi Shuja', 'Minhaj at-Talibin', 'Al-Waraqat', 'Islamic Inheritance (Mawarith)']
  },
  {
    id: 'f5',
    name: 'Ustaz Tariq Mansoor',
    name_ar: 'الأستاذ طارق منصور',
    title: 'Instructor in Seerah & Islamic History',
    title_ar: 'مدرس السيرة والتاريخ الإسلامي',
    department: 'Humanities & English',
    department_ar: 'قسم السيرة والدراسات العامة',
    qualifications: 'B.Ed, Certificate in Prophetic Epistemology',
    email: 'tariq@kashifulhudha.edu.lk',
    bio: 'Oversees historical manuscript context, English communication skills for religious scholars, and student pastoral welfare.',
    subjects: ['Al-Seerah al-Nabawiyyah', 'Islamic Civilizations', 'English for Scholars']
  },
  {
    id: 'f6',
    name: 'Qari Zameer Ahmed',
    name_ar: 'القارئ ضمير أحمد',
    title: 'Hifz Sabaq Supervisor',
    title_ar: 'مشرف حلقات الحفظ والمراجعة',
    department: 'Quran & Tajweed',
    department_ar: 'قسم القرآن والتجويد',
    qualifications: 'Hafiz al-Quran, Tajweed Sanad',
    email: 'zameer@kashifulhudha.edu.lk',
    bio: 'Conducts morning Sabaq circles and daily individual verification for residential foundation students.',
    subjects: ['Individual Sabaq Review', 'Sabqi Retention Cycles', 'Quranic Transcription']
  }
]

export default function Faculty() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'ar'
  const [faculty, setFaculty] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDept, setSelectedDept] = useState('All')
  const [selectedFaculty, setSelectedFaculty] = useState(null)

  useEffect(() => {
    listFaculty()
      .then((data) => {
        if (data && data.length > 0) {
          // Normalize API data to include full card fields
          const mapped = data.map((f, i) => ({
            id: f.id || `fac-${i}`,
            name: f.name?.[isRTL ? 'ar' : 'en'] || f.name?.en || f.name || 'Ustaz',
            name_ar: f.name?.ar || f.name_ar || 'أستاذ فاضل',
            title: f.title?.[isRTL ? 'ar' : 'en'] || f.title?.en || f.title || 'Faculty Member',
            department: f.department || 'General',
            qualifications: f.qualifications || 'Al-Alimiyyah Sanad',
            email: f.email || 'info@kashifulhudha.edu.lk',
            bio: f.bio || 'Dedicated scholar and instructor at Dharul Uloom Kashiful Hudha.',
            subjects: f.subjects || ['Islamic Studies', 'Quran', 'Hadith']
          }))
          setFaculty(mapped)
        } else {
          setFaculty(FALLBACK_FACULTY)
        }
      })
      .catch(() => setFaculty(FALLBACK_FACULTY))
      .finally(() => setLoading(false))
  }, [isRTL])

  const departments = ['All', 'Quran & Tajweed', 'Hadith & Isnad', 'Fiqh & Usul', 'Arabic Grammar', 'Humanities & English']

  const filteredFaculty = faculty.filter((f) => {
    const matchesDept = selectedDept === 'All' || f.department === selectedDept
    const query = searchQuery.toLowerCase().trim()
    const matchesSearch = !query || 
      (f.name && f.name.toLowerCase().includes(query)) ||
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
          
          <nav className="flex items-center gap-2 text-xs text-dark-text-primary/70 mb-4" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-gold-wash-100 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-brass-gold-500 font-medium">Faculty</span>
          </nav>

          <span className="text-xs font-semibold uppercase tracking-widest text-brass-gold-500 mb-2 block">
            {isRTL ? 'هيئة التدريس والمشايخ' : 'Scholarly Assembly'}
          </span>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-paper-white tracking-tight">
            {isRTL ? 'العلماء والأساتذة الأجلاء' : 'Distinguished Faculty & Mentors'}
          </h1>
          <p className="font-serif text-sm sm:text-base text-dark-text-primary/80 mt-3 max-w-2xl leading-relaxed">
            {isRTL
              ? 'نخبة من العلماء المسندين والقراء المجازين المكرسين لبناء عقول الأجيال وتزكية نفوسهم.'
              : 'Scholars, huffaz, and linguists dedicated to classical transmission, textual precision, and fatherly mentorship.'}
          </p>
        </div>
      </section>

      {/* 2. Search & Department Filter Bar */}
      <section className="w-full py-10 border-b border-sand-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          
          {/* Search Box */}
          <div className="max-w-md w-full bg-paper-white p-2 rounded-[14px] border border-sand-border shadow-xs flex items-center">
            <span className="material-symbols-outlined text-ink-text-muted mx-3">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? 'ابحث باسم الأستاذ، التخصص، أو المؤهل...' : 'Search by name, department, or qualification...'}
              className="w-full bg-transparent text-xs sm:text-sm text-ink-text-primary focus:outline-none placeholder:text-ink-text-muted"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs text-ink-text-muted hover:text-ink-text-primary px-2"
              >
                Clear
              </button>
            )}
          </div>

          {/* Department Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
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
                {dept}
              </button>
            ))}
          </div>

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
              <span className="material-symbols-outlined text-4xl text-ink-text-muted mb-2 block">person_search</span>
              <p className="text-sm font-semibold text-ink-green-900 mb-1">No faculty found</p>
              <p className="text-xs text-ink-text-secondary">Try searching with a different term or resetting the department.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredFaculty.map((member) => (
                <div
                  key={member.id}
                  onClick={() => setSelectedFaculty(member)}
                  className="group flex flex-col justify-between p-6 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript hover:border-emerald-700 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                >
                  <div className="flex flex-col items-center text-center">
                    
                    {/* Square Portrait with Subtle Border */}
                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-sand-border/30 border border-sand-border mb-4 group-hover:border-emerald-700 transition-colors flex items-center justify-center">
                      <span className="material-symbols-outlined text-4xl text-emerald-700/70">
                        account_circle
                      </span>
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
                      View profile
                    </span>
                    <a
                      href={`mailto:${member.email}`}
                      onClick={(e) => e.stopPropagation()}
                      title={`Email ${member.name}`}
                      className="w-7 h-7 rounded-full border border-sand-border flex items-center justify-center hover:bg-emerald-700 hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-[15px]">mail</span>
                    </a>
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
                  {selectedFaculty.department}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedFaculty(null)}
                  className="w-8 h-8 rounded-full border border-sand-border flex items-center justify-center text-ink-text-secondary hover:bg-sand-border/30"
                >
                  ✕
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

              <div className="p-4 rounded-xl bg-parchment-50 border border-sand-border text-xs space-y-2">
                <div>
                  <span className="text-ink-text-muted block font-medium">Scholastic Sanad / Credentials:</span>
                  <span className="font-semibold text-ink-green-900">{selectedFaculty.qualifications}</span>
                </div>
                <div>
                  <span className="text-ink-text-muted block font-medium">Direct Contact:</span>
                  <a href={`mailto:${selectedFaculty.email}`} className="text-emerald-700 hover:underline">
                    {selectedFaculty.email}
                  </a>
                </div>
              </div>

              <div>
                <h4 className="font-serif text-sm font-semibold text-ink-green-900 mb-2">
                  Biography & Scholastic Transmission
                </h4>
                <p className="text-xs text-ink-text-secondary leading-relaxed font-sans">
                  {selectedFaculty.bio}
                </p>
              </div>

              <div>
                <h4 className="font-serif text-sm font-semibold text-ink-green-900 mb-2">
                  Subjects & Halaqat Taught
                </h4>
                <ul className="space-y-1.5 text-xs text-ink-text-secondary">
                  {selectedFaculty.subjects.map((sub, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-brass-gold-500"></span>
                      <span>{sub}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            <div className="pt-6 border-t border-sand-border">
              <button
                type="button"
                onClick={() => setSelectedFaculty(null)}
                className="w-full h-10 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
              >
                Close Biography
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
