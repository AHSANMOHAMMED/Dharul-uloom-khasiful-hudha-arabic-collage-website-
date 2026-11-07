import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import KhatamPattern from '../components/KhatamPattern'

export default function About() {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'ar'

  const coreValues = [
    {
      title_en: 'Authentic Transmission (Isnad)',
      title_ar: 'أصالة السند والتلقي',
      desc_en: 'Knowledge received generation-to-generation through unbroken scholarly chains grounded in the Quran and Sunnah.',
      desc_ar: 'تلقي العلم الشريف بالسند المتصل كابراً عن كابر وفق منهج أهل السنة والجماعة.',
      icon: 'verified'
    },
    {
      title_en: 'Spiritual Discipline (Tarbiyyah)',
      title_ar: 'التربية والتزكية الروحية',
      desc_en: 'Holistic refinement of character, prayerful devotion, humility, and adherence to Islamic etiquette in residential boarding.',
      desc_ar: 'تزكية النفوس والأخلاق الفاضلة وتطبيق السنن النبوية في المعاملة والعبادة والعيش المشترك.',
      icon: 'self_improvement'
    },
    {
      title_en: 'Scholarly Rigor (Itqan)',
      title_ar: 'الإتقان والرسوخ العلمي',
      desc_en: 'Deep mastery of Arabic syntax, morphology, legal precedents, and text validation without intellectual shortcuts.',
      desc_ar: 'التمكن الدقيق من علوم الآلة واللغة العربية وقواعد الفقه وأصول الاستنباط.',
      icon: 'menu_book'
    },
    {
      title_en: 'Community Service (Khidmah)',
      title_ar: 'خدمة المجتمع والأمة',
      desc_en: 'Graduates actively dedicated to pastoral care, religious guidance, and uplifting the coastal community and nation.',
      desc_ar: 'توجيه الطاقات لنفع المسلمين وعمارة المساجد وإرشاد المجتمع بروح التواضع والمسؤولية.',
      icon: 'volunteer_activism'
    }
  ]

  const milestones = [
    {
      year: '2004',
      title_en: 'Foundation in Mudalippalli',
      title_ar: 'التأسيس المبارك في قرية مدلايبلي',
      desc_en: 'Established as an intimate preliminary Arabic and Quranic madrasa serving the rural families of the Kalpitiya peninsula.',
      desc_ar: 'انطلاق مسيرة التعليم بحلقات قرآنية مباركة لتلبية حاجة أبناء الساحل في شبه جزيرة كالبيتيا.'
    },
    {
      year: '2008',
      title_en: 'Official Ministry Registration',
      title_ar: 'التسجيل الرسمي لدى وزارة الشؤون الدينية',
      desc_en: 'Formally recognized under the Department of Muslim Religious and Cultural Affairs (MRCA/13/1/PAS/187).',
      desc_ar: 'الحصول على الاعتماد الرسمي من إدارة الشؤون الدينية والثقافية الإسلامية بسريلانكا.'
    },
    {
      year: '2016',
      title_en: 'Residential Campus Expansion',
      title_ar: 'توسعة السكن الداخلي ومصلى الكلية',
      desc_en: 'Construction of student boarding halls, dedicated mutala’ah rooms, and expansion of the classical Arabic curriculum.',
      desc_ar: 'إنشاء الأجنحة السكنية وقاعات المطالعة وتوسيع دائرة استيعاب طلاب العلوم الشرعية.'
    },
    {
      year: '2024',
      title_en: 'Digital Maktabah & Sanad Launch',
      title_ar: 'تدشين المكتبة الرقمية وإجازات السند',
      desc_en: 'Inauguration of the 12,500+ volume Shamela-linked catalog and advanced Dawrah al-Hadith certification program.',
      desc_ar: 'افتتاح المكتبة التراثية الرقمية الشاملة وتخريج أوائل دفعات إجازة الكتب الستة بأسانيد متصلة.'
    }
  ]

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen">
      
      {/* 1. Slim Editorial Header & Breadcrumb */}
      <section className="relative w-full bg-ink-green-900 text-paper-white py-16 overflow-hidden border-b border-sand-border/20">
        <KhatamPattern className="opacity-[0.04]" strokeColor="#FBF8F0" id="about-khatam" />
        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <nav className="flex items-center gap-2 text-xs text-dark-text-primary/70 mb-4" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-gold-wash-100 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-brass-gold-500 font-medium">About</span>
          </nav>

          <span className="text-xs font-semibold uppercase tracking-widest text-brass-gold-500 mb-2 block">
            {isRTL ? 'عن دار العلوم' : 'Institutional Heritage'}
          </span>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-paper-white tracking-tight max-w-3xl">
            {isRTL ? 'أصالة التلقي ورسالة النور' : 'Rooted in Tradition, Illuminating the Future'}
          </h1>
          <p className="font-serif text-sm sm:text-base text-dark-text-primary/80 mt-3 max-w-2xl leading-relaxed">
            {isRTL
              ? 'نبذة عن مسيرة دار العلوم كاشف الهدى في خدمة القرآن الكريم والعلوم الإسلامية على امتداد عقدين من الزمن.'
              : 'Over two decades of dedicated pedagogical service, Quranic memorization, and classical Islamic scholarship in Kalpitiya, Sri Lanka.'}
          </p>
        </div>
      </section>

      {/* 2. Our Story (Editorial Two-Column Layout) */}
      <section className="w-full py-20 border-b border-sand-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-7 space-y-6">
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-700 block">
                {isRTL ? 'قصة التأسيس' : 'Our Story & Genesis'}
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900 leading-snug">
                {isRTL
                  ? 'من حلقة قرآنية متواضعة إلى صرحٍ تعليمي إسلامي معتمد'
                  : 'From a Humble Coastal Circle to an Authenticated College of Arabic Scholarship'}
              </h2>
              <p className="text-sm sm:text-base text-ink-text-secondary leading-relaxed font-sans">
                {isRTL
                  ? 'تأسست دار العلوم كاشف الهدى في عام ٢٠٠٤ م كمؤسسة تعليمية عربية أولية في قرية مُدلايبّلّي بريف شبه جزيرة كالبيتيا، مقاطعة بوتالام، سريلانكا. وقد انطلقت المسيرة برعاية نخبة من العلماء المخلصين الذين استشعروا الحاجة الماسة إلى بناء صرحٍ يجمع بين متانة الحفظ ونقاء العقيدة.'
                  : 'Dharul Uloom Kashiful Hudha was established in 2004 as a preliminary Arabic educational institute in the rural coastal village of Mudalippalli, Kalpitiya, Puttalam District, Sri Lanka. Officially registered in 2008 with the Ministry of Religious Affairs (Registration No: MRCA/13/1/PAS/187), the college provides full boarding education combining religious sciences with essential academic disciplines.'}
              </p>
              <p className="text-sm sm:text-base text-ink-text-secondary leading-relaxed font-sans">
                {isRTL
                  ? 'واليوم تحتضن الكلية أكثر من ٨٥٠ طالباً وتضم مكتبة تراثية غنية تتجاوز ١٢,٥٠٠ كتاب ومخطوطة، وتمنح خريجيها إجازات علمية مسندة إلى رسول الله ﷺ في كتب الحديث الشريف.'
                  : 'Today, the institution accommodates hundreds of residential students under senior scholars, with an expanding digital research repository and classical sanad chains transmitting knowledge with reverence and clarity.'}
              </p>

              <div className="pt-2 flex items-center gap-6 text-xs text-ink-text-muted">
                <div>
                  <span className="font-serif text-xl font-bold text-ink-green-900 block tabular-nums">MRCA/13/1/PAS/187</span>
                  <span>Ministry Registration</span>
                </div>
                <div className="h-8 w-px bg-sand-border"></div>
                <div>
                  <span className="font-serif text-xl font-bold text-ink-green-900 block tabular-nums">20+ Years</span>
                  <span>Continuous Academic Service</span>
                </div>
              </div>
            </div>

            {/* Campus Archival Card */}
            <div className="lg:col-span-5">
              <div className="p-4 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
                <div className="rounded-lg overflow-hidden bg-ink-green-900 h-64 relative">
                  <img 
                    src="/images/gallery/campus-1.jpg" 
                    alt="Campus Courtyard Colonnade"
                    onError={(e) => {
                      e.currentTarget.src = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80";
                    }}
                    className="w-full h-full object-cover opacity-80"
                  />
                  <div className="absolute inset-0 bg-ink-green-900/40"></div>
                  <div className="absolute bottom-3 left-3 right-3 text-paper-white text-xs bg-ink-green-900/80 backdrop-blur-sm p-2.5 rounded border border-sand-border/20">
                    <span className="font-serif font-semibold block">Campus Courtyard & Halaqah Colonnade</span>
                    <span className="text-[11px] text-dark-text-primary/75">Mudalippalli, Kalpitiya · Sri Lanka</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. Mission & Vision (Side-by-Side Panels with Brass Gold Top Border) */}
      <section className="w-full py-20 bg-parchment-50/60 border-b border-sand-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-xl mx-auto mb-14">
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-700 mb-1 block">
              {isRTL ? 'الغاية والمقصد' : 'Purpose & Horizon'}
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900">
              {isRTL ? 'رسالتنا ورؤيتنا' : 'Mission & Vision'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Mission Panel */}
            <div className="p-8 rounded-[14px] bg-paper-white border border-sand-border border-t-4 border-t-brass-gold-500 shadow-manuscript relative">
              <div className="w-10 h-10 rounded-lg bg-gold-wash-100 text-brass-gold-500 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-[22px]">flag</span>
              </div>
              <h3 className="font-serif text-xl font-semibold text-ink-green-900 mb-3">
                {isRTL ? 'رسالتنا المؤسسية' : 'Our Mission'}
              </h3>
              <p className="text-sm text-ink-text-secondary leading-relaxed font-sans">
                {isRTL
                  ? 'رعاية الإيمان والعلم النافع عبر توفير بيئة تعليمية إسلامية شاملة تدمج بين إتقان حفظ القرآن الكريم، ودراسة علوم الشريعة واللغة العربية، والتربية الروحية، لتخريج دعاة وعلماء يتصفون بحسن الخلق والأمانة وخدمة المجتمع.'
                  : 'To nurture authentic faith and rigorous knowledge through a comprehensive Islamic curriculum that combines Quranic memorization, linguistic mastery, and sound jurisprudence with disciplined residential tarbiyyah, preparing righteous and community-minded scholars.'}
              </p>
            </div>

            {/* Vision Panel */}
            <div className="p-8 rounded-[14px] bg-paper-white border border-sand-border border-t-4 border-t-emerald-700 shadow-manuscript relative">
              <div className="w-10 h-10 rounded-lg bg-mint-wash-100 text-emerald-700 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-[22px]">visibility</span>
              </div>
              <h3 className="font-serif text-xl font-semibold text-ink-green-900 mb-3">
                {isRTL ? 'رؤيتنا المستقبلية' : 'Our Vision'}
              </h3>
              <p className="text-sm text-ink-text-secondary leading-relaxed font-sans">
                {isRTL
                  ? 'أن نكون منارةً رائدة في سريلانكا وجنوب آسيا في التعليم الإسلامي الأصيل، معروفين بالرسوخ العلمي، والنزاهة الأخلاقية، والريادة في نشر سماحة الإسلام والاعتدال.'
                  : 'To stand as an exemplary citadel of traditional Islamic scholarship and moral leadership across Sri Lanka, acclaimed for pedagogical excellence, manuscript preservation, and graduates of enduring scholastic integrity.'}
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 4. Core Values (4 Items with Outline Icons) */}
      <section className="w-full py-20 border-b border-sand-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-700 block mb-1">
                {isRTL ? 'الثوابت والقيم' : 'Pillars of Virtue'}
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900">
                {isRTL ? 'القيم الأساسية التي نعتز بها' : 'Core Values & Academic Principles'}
              </h2>
            </div>
            <p className="text-sm text-ink-text-secondary max-w-md">
              {isRTL
                ? 'مبادئ راسخة تُشكل وجدان طالب العلم وتعكس أمانة حمل الشريعة الغراء.'
                : 'Guiding imperatives that frame every classroom halaqah, residential dormitory routine, and scholarly lecture.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {coreValues.map((val, idx) => (
              <div
                key={idx}
                className="p-6 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript hover:border-emerald-700 hover:-translate-y-0.5 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-mint-wash-100 text-emerald-700 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[20px]">{val.icon}</span>
                </div>
                <h3 className="font-serif text-base font-semibold text-ink-green-900 mb-2">
                  {isRTL ? val.title_ar : val.title_en}
                </h3>
                <p className="text-xs text-ink-text-secondary leading-relaxed">
                  {isRTL ? val.desc_ar : val.desc_en}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 5. Timeline of Milestones (Vertical Line with Year Markers) */}
      <section className="w-full py-20 bg-parchment-50/60 border-b border-sand-border">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-xl mx-auto mb-16">
            <span className="text-xs font-semibold uppercase tracking-widest text-brass-gold-500 mb-1 block">
              {isRTL ? 'المحطات التاريخية' : 'Chronicle'}
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900">
              {isRTL ? 'مسيرة عقدين من البناء والعطاء' : 'Milestones in Institutional Growth'}
            </h2>
          </div>

          <div className="relative border-l-2 border-sand-border ml-4 sm:ml-8 space-y-10 pl-6 sm:pl-8">
            {milestones.map((item, idx) => (
              <div key={idx} className="relative group">
                {/* Year Marker Pin */}
                <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-5 h-5 rounded-full bg-paper-white border-2 border-emerald-700 flex items-center justify-center group-hover:bg-emerald-700 transition-colors">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-700 group-hover:bg-white"></div>
                </div>

                <div className="p-6 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
                  <span className="px-2.5 py-0.5 rounded-full bg-gold-wash-100 text-brass-gold-500 text-xs font-semibold tabular-nums inline-block mb-2">
                    {item.year}
                  </span>
                  <h3 className="font-serif text-lg font-semibold text-ink-green-900 mb-1">
                    {isRTL ? item.title_ar : item.title_en}
                  </h3>
                  <p className="text-xs text-ink-text-secondary leading-relaxed">
                    {isRTL ? item.desc_ar : item.desc_en}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 6. Principal's Message & Final Admissions CTA */}
      <section className="w-full py-20 border-b border-sand-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-12 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript-md">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              <div className="lg:col-span-4 flex flex-col items-center text-center">
                <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-sand-border bg-ink-green-900 p-1 mb-4">
                  <img 
                    src="/images/logo.jpg" 
                    alt="Principal of Kashiful Hudha"
                    className="w-full h-full object-contain rounded-full bg-paper-white"
                  />
                </div>
                <h4 className="font-serif text-lg font-semibold text-ink-green-900">
                  Ustaz Abdul Hakeem Al-Kashifi
                </h4>
                <span className="text-xs text-brass-gold-500 font-medium">Principal & Head of Faculty</span>
                <span className="text-[11px] text-ink-text-muted mt-1">Dharul Uloom Kashiful Hudha</span>
              </div>

              <div className="lg:col-span-8 border-t lg:border-t-0 lg:border-l border-sand-border pt-6 lg:pt-0 lg:pl-8">
                <span className="material-symbols-outlined text-brass-gold-500 text-3xl mb-3 block">
                  format_quote
                </span>
                <blockquote className="font-serif italic text-base sm:text-lg text-ink-text-primary leading-relaxed mb-6">
                  {isRTL
                    ? '"إن العلم الشرعي ليس مجرد معلومات تُحفظ أو شهادات تُنال، بل هو نورٌ يقذفه الله في القلب يثمر خشيةً وأمانةً وعملاً صالحاً. وعهدنا لأبنائنا الطلاب وأولياء أمورهم أن نبذل غاية الجهد لتربيتهم على السمت النبوي الشريف وصيانة الدين بالحجة والبرهان."'
                    : '"True Islamic scholarship is never mere accumulation of texts, but an illuminated trust that cultivates God-consciousness, moral restraint, and compassionate leadership. Our solemn pledge to every family is that their sons will be nurtured with uncompromising scholastic rigor and fatherly tarbiyyah."'}
                </blockquote>
                
                <div className="flex flex-wrap items-center gap-4">
                  <Link
                    to="/admissions"
                    className="inline-flex items-center justify-center h-11 px-6 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-manuscript transition-colors"
                  >
                    <span>Apply for Next Intake</span>
                    <span className="material-symbols-outlined ml-1.5 text-[18px]">arrow_forward</span>
                  </Link>

                  <Link
                    to="/contact"
                    className="inline-flex items-center justify-center h-11 px-6 rounded-[10px] border border-sand-border hover:bg-sand-border/20 text-ink-text-primary text-xs font-medium transition-colors"
                  >
                    <span>Contact Administration</span>
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
