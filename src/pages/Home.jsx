import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import KhatamPattern from '../components/KhatamPattern';

export default function Home() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRTL = i18n.language === 'ar';
  const [librarySearch, setLibrarySearch] = useState('');

  const handleLibrarySearch = (e) => {
    e.preventDefault();
    if (librarySearch.trim()) {
      navigate(`/library?q=${encodeURIComponent(librarySearch.trim())}`);
    } else {
      navigate('/library');
    }
  };

  const portalGateways = [
    {
      role: 'student',
      title_en: 'Student Portal',
      title_ar: 'بوابة الطالب',
      desc_en: "Access syllabi, class schedules, mutala'ah records, and memorization ledgers.",
      desc_ar: 'الولوج إلى المناهج التعليمية، الحضور والغياب، وسجلات الحفظ والدرجات.',
      action_en: 'Enter Desk',
      action_ar: 'دخول البوابة',
      link: '/dashboard',
      bgClass: 'bg-mint-wash-100 text-emerald-700 hover:bg-emerald-700 hover:text-white',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
          <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      role: 'parent',
      title_en: 'Parent Portal',
      title_ar: 'بوابة ولي الأمر',
      desc_en: 'Track residential attendance, tarbiyyah milestones, leave exeats, and tuition fees.',
      desc_ar: 'متابعة الحضور وسجلات التربية، وتقديم طلبات الإجازات، وسداد الرسوم.',
      action_en: 'View Ward',
      action_ar: 'متابعة الابن',
      link: '/dashboard',
      bgClass: 'bg-gold-wash-100 text-role-parent hover:bg-role-parent hover:text-white',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
          <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      role: 'tutor',
      title_en: 'Tutor & Faculty',
      title_ar: 'بوابة المدرسين',
      desc_en: 'Manage halaqah registers, exam gradings, fatwa archives, and LMS dockets.',
      desc_ar: 'تسجيل الحضور اليومي للحلقات، رصد درجات الاختبارات، وإدارة التكليفات.',
      action_en: 'Faculty Login',
      action_ar: 'دخول هيئة التدريس',
      link: '/dashboard',
      bgClass: 'bg-sand-border/40 text-role-tutor hover:bg-role-tutor hover:text-white',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
          <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      role: 'librarian',
      title_en: 'Maktabah Islamic Library',
      title_ar: 'المكتبة الإسلامية الرقمية',
      desc_en: 'Browse illuminated manuscripts, indexed hadith commentaries, and classical printings.',
      desc_ar: 'مطالعة المخطوطات النادرة وأمهات كتب الحديث والتفاسير وشروح الفقه المعتمدة.',
      action_en: 'Search Kitab',
      action_ar: 'تصفح الكتب',
      link: '/library',
      bgClass: 'bg-mint-wash-100 text-emerald-700 hover:bg-emerald-700 hover:text-white',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
          <path d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
  ];

  const academicPrograms = [
    {
      id: 'hifz',
      title_en: 'Hifz al-Quran',
      title_ar: 'تحفيظ القرآن الكريم',
      stage_en: 'Foundation Stage',
      stage_ar: 'المرحلة التأسيسية',
      duration_en: '3 Years · Full Residential',
      duration_ar: '٣ سنوات · إقامة داخلية',
      subtitle_en: 'Memorization & Tajweed Sciences',
      subtitle_ar: 'إتقان التلاوة وضبط مخارج الحروف',
      desc_en: "Complete memorization of the Holy Quran under authenticated Huffaz, with rigorous mastery of Tajweed rules, vocal articulation (Makharij), and daily mutala'ah circles.",
      desc_ar: 'حفظ كتاب الله كاملاً بإتقان على أيدي مشايخ مسندين مع دراسة متون التجويد ومخارج الحروف والمراجعة اليومية المنتظمة.',
      highlights: [
        'Individualized Sabaq and Sabqi review cycles',
        'Tuhfat al-Atfal & Al-Jazariyyah recitation texts',
        'Full boarding residential tarbiyyah & discipline'
      ]
    },
    {
      id: 'nahw',
      title_en: 'Nahw & Sarf',
      title_ar: 'النحو والصرف والبلاغة',
      stage_en: 'Intermediate Stage',
      stage_ar: 'المرحلة المتوسطة',
      duration_en: '4 Years · Intensive',
      duration_ar: '٤ سنوات · برنامج مكثف',
      subtitle_en: 'Classical Arabic Grammar & Syntax',
      subtitle_ar: 'قواعد اللغة والأدب والبيان',
      desc_en: 'Immersion into classical linguistics, parsing, morphology, and rhetorical eloquence (Balaghah) to unlock direct foundational access to early Islamic texts and exegesis.',
      desc_ar: 'دراسة معمقة في أصول الإعراب والتصريف والبلاغة والمنطق لتمكين الطالب من فهم كتب السلف واستنباط المعاني بدقة.',
      highlights: [
        'From Al-Ajrumiyyah to Alfiyyah Ibn Malik',
        'Active Arabic discourse and essay writing',
        'Foundational classical Mantiq (logic)'
      ]
    },
    {
      id: 'alim',
      title_en: 'Alim & Hadith Studies',
      title_ar: 'العالمية ودراسات الحديث الشريف',
      stage_en: 'Advanced Stage',
      stage_ar: 'المرحلة العالية',
      duration_en: '7 Years · Sanad Certification',
      duration_ar: '٧ سنوات · إجازة بالإسناد',
      subtitle_en: 'Jurisprudence & Sahih Sitta Compendiums',
      subtitle_ar: 'الفقه المقارن ودورة كتب الحديث الستة',
      desc_en: 'Exhaustive study of Usul al-Fiqh, Islamic legal codes, and culminating in the Dawrah al-Hadith reading of the six authentic hadith compendiums with formal scholarly certification.',
      desc_ar: 'دراسة أصول الفقه والفقه المقارن ودراسة كتب الحديث الستة كاملة بأسانيد متصلة إلى رسول الله ﷺ.',
      highlights: [
        'Exegesis of Sahih al-Bukhari and Sahih Muslim',
        'Comparative Fiqh jurisprudence & Fatwa methodology',
        'Authenticated Sanad chain grant upon completion'
      ]
    }
  ];

  const campusNews = [
    {
      id: 1,
      date_hijri: '15 Rajab 1448',
      category_en: 'Majlis Event',
      category_ar: 'مناسبة علمية',
      title_en: 'Annual Khatm al-Bukhari Gathering & Sanad Conferment',
      title_ar: 'المجلس السنوي لختم صحيح البخاري ومنح الإجازات المسندة',
      excerpt_en: 'Honoring 34 graduating scholars completing the final chapters of Sahih al-Bukhari with guest scholars from across the region.',
      excerpt_ar: 'تكريم كوكبة من طلاب العلم المتخرجين بعد استكمال قراءة صحيح الإمام البخاري بحضور نخبة من العلماء الأجلاء.'
    },
    {
      id: 2,
      date_hijri: '22 Rajab 1448',
      category_en: 'Admissions 2027',
      category_ar: 'القبول والتسجيل',
      title_en: 'Entrance Examination Schedule Announced for Academic Year 2027',
      title_ar: 'إعلان مواعيد اختبارات القبول والمقابلات الشخصية للعام الدراسي الجديد',
      excerpt_en: 'Applications are formally invited for Kulliyyah entrance interviews, Arabic oral assessment, and Quranic recitation testing.',
      excerpt_ar: 'بدء استقبال طلبات الالتحاق لبرامج الحفظ والعلوم الشرعية وإجراء اختبارات التلاوة والمقابلة الشخصية.'
    },
    {
      id: 3,
      date_hijri: '04 Sha’ban 1448',
      category_en: 'Digital Library',
      category_ar: 'المكتبة والمخطوطات',
      title_en: 'Restoration of Rare 18th Century Shafi’i Jurisprudence Codices',
      title_ar: 'رقمنة وإتاحة مخطوطات فقهية نادرة في الفقه الشافعي تعود للقرن الثامن عشر',
      excerpt_en: 'The Manuscript Preservation Wing has released digital high-resolution scans of three historically significant commentaries on Minhaj at-Talibin.',
      excerpt_ar: 'إتاحة نسخ رقمية عالية الدقة لثلاثة شروح تراثية نادرة على منهاج الطالبين للإمام النووي رحمه الله.'
    }
  ];

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen">
      
      {/* 1. Full-Bleed Modern Manuscript Hero */}
      <section className="relative w-full min-h-[85vh] flex flex-col justify-between overflow-hidden bg-ink-green-900 text-paper-white">
        
        {/* Background Image with Deep Ink-Green Tint & Khatam Pattern */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/images/gallery/campus-1.jpg" 
            alt="Collegiate Islamic Courtyard" 
            onError={(e) => {
              // Graceful fallback to serene architectural imagery if local campus image not found
              e.currentTarget.src = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=2000&q=80";
            }}
            className="w-full h-full object-cover object-center scale-105 opacity-30 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-ink-green-900/85"></div>
          <KhatamPattern className="opacity-[0.06]" strokeColor="#FBF8F0" id="hero-khatam" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 flex flex-col items-start justify-center flex-grow">
          
          {/* Admissions Open Live Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brass-gold-500/15 border border-brass-gold-500/30 mb-6">
            <span className="w-2 h-2 rounded-full bg-brass-gold-500 animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-brass-gold-500">
              {isRTL ? 'باب القبول والتسجيل مفتوح ٢٠٢٧' : 'Admissions Open 2027'}
            </span>
          </div>

          {/* Bilingual Title Headings */}
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-serif text-2xl sm:text-3xl text-paper-white tracking-tight font-semibold">
                Dharul Uloom Kashiful Hudha
              </span>
              <span className="font-arabic text-xl sm:text-2xl text-gold-wash-100/90" dir="rtl">
                دار العلوم كاشف الهدى
              </span>
            </div>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl text-paper-white tracking-tight max-w-4xl mb-6 font-semibold leading-tight">
            {isRTL ? (
              <span>علمٌ يُنير الطريق ويحفظ أصول الشريعة</span>
            ) : (
              <>
                Knowledge That Lights the Way{' '}
                <span className="font-arabic text-gold-wash-100/90 font-normal italic block sm:inline text-2xl sm:text-4xl" dir="rtl">
                  (علمٌ يُنير الطريق)
                </span>
              </>
            )}
          </h1>

          <p className="font-serif text-base sm:text-xl text-dark-text-primary/90 max-w-2xl leading-relaxed mb-10">
            {isRTL
              ? 'صرحٌ تعليمي مبارك يجمع بين أصالة التلقي بالسند المتصل ودقة التحصيل العلمي الرصين، لإعداد جيلٍ من العلماء الربانيين.'
              : 'Cultivating authentic Islamic scholarship, spiritual excellence, and contemporary leadership rooted in classical transmission and scholarly integrity.'}
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/admissions"
              className="inline-flex items-center justify-center h-12 px-7 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 active:bg-ink-green-900 text-white font-medium text-sm shadow-manuscript transition-all"
            >
              <span>{isRTL ? 'التقديم للالتحاق بالكلية' : 'Apply for Admission'}</span>
              <span className="material-symbols-outlined ml-2 text-[20px]">
                {isRTL ? 'arrow_back' : 'arrow_forward'}
              </span>
            </Link>

            <Link
              to="/library"
              className="inline-flex items-center justify-center h-12 px-7 rounded-[10px] bg-paper-white/10 hover:bg-paper-white/20 text-paper-white font-medium text-sm border border-sand-border/20 backdrop-blur-xs transition-all"
            >
              <span className="material-symbols-outlined mr-2 text-[20px]">auto_stories</span>
              <span>{isRTL ? 'تصفح المكتبة الإسلامية' : 'Explore the Library'}</span>
            </Link>
          </div>
        </div>

        {/* Slim KPI Ribbon Bar */}
        <div className="relative z-10 w-full bg-dark-canvas/80 border-t border-sand-border/15 backdrop-blur-sm">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
              <div className="flex flex-col">
                <span className="font-serif text-2xl sm:text-3xl font-bold text-brass-gold-500 tabular-nums">850+</span>
                <span className="text-xs text-dark-text-primary/75 uppercase tracking-wider font-medium mt-1">
                  {isRTL ? 'طالب منتظم' : 'Students Enrolled'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-serif text-2xl sm:text-3xl font-bold text-brass-gold-500 tabular-nums">42</span>
                <span className="text-xs text-dark-text-primary/75 uppercase tracking-wider font-medium mt-1">
                  {isRTL ? 'أستاذ وعالم مسند' : 'Ustaz & Faculty'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-serif text-2xl sm:text-3xl font-bold text-brass-gold-500 tabular-nums">38</span>
                <span className="text-xs text-dark-text-primary/75 uppercase tracking-wider font-medium mt-1">
                  {isRTL ? 'عاماً من العطاء' : 'Years of Service'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-serif text-2xl sm:text-3xl font-bold text-brass-gold-500 tabular-nums">12,500+</span>
                <span className="text-xs text-dark-text-primary/75 uppercase tracking-wider font-medium mt-1">
                  {isRTL ? 'كتاب في المكتبة الرقمية' : 'Kitab in Digital Vault'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Institutional Gateways (Portals) */}
      <section className="w-full py-20 bg-parchment-50 border-b border-sand-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-700 block mb-1">
                {isRTL ? 'بوابات الكلية' : 'Institutional Gateways'}
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900">
                {isRTL ? 'منظومة البوابات الأكاديمية' : 'Dedicated Academic Portals'}
              </h2>
            </div>
            <p className="text-sm text-ink-text-secondary max-w-md">
              {isRTL
                ? 'بيئة تعليمية متكاملة لربط الطالب وولي الأمر وهيئة التدريس والإدارة بأعلى معايير الانضباط والشفافية.'
                : 'Dedicated operational environments engineered for deliberate study, collaborative stewardship, and administrative clarity.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {portalGateways.map((gate) => (
              <Link
                key={gate.role}
                to={gate.link}
                className="group flex flex-col justify-between p-6 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript hover:border-emerald-700 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-6 transition-colors ${gate.bgClass}`}>
                    {gate.icon}
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-ink-green-900 mb-2">
                    {isRTL ? gate.title_ar : gate.title_en}
                  </h3>
                  <p className="text-xs text-ink-text-secondary leading-relaxed mb-6">
                    {isRTL ? gate.desc_ar : gate.desc_en}
                  </p>
                </div>
                <div className="flex items-center text-xs font-semibold text-emerald-700 group-hover:translate-x-1 transition-transform">
                  <span>{isRTL ? gate.action_ar : gate.action_en}</span>
                  <span className="material-symbols-outlined ml-1 text-[16px]">
                    {isRTL ? 'arrow_back' : 'arrow_forward'}
                  </span>
                </div>
              </Link>
            ))}
          </div>

        </div>
      </section>

      {/* 3. Classical Curricula & Academic Programs */}
      <section className="w-full py-20 bg-parchment-50/60 border-b border-sand-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col items-center text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-700 mb-2">
              {isRTL ? 'البرامج الأكاديمية' : 'Classical Curricula'}
            </span>
            <h2 className="font-serif text-2xl sm:text-4xl font-semibold text-ink-green-900 mb-3">
              {isRTL ? 'المسارات والعلوم الشرعية' : 'Academic Programs'}
            </h2>
            <p className="text-sm text-ink-text-secondary leading-relaxed">
              {isRTL
                ? 'مناهج متسلسلة مستمدة من تراث الأمة الإسلامية تجمع بين رسوخ الحفظ ودقة الفهم وتزكية النفس.'
                : 'Structured pathways grounded in centuries of traditional pedagogical transmission, pairing mental discipline with spiritual cultivation.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {academicPrograms.map((prog) => (
              <div 
                key={prog.id}
                className="flex flex-col justify-between p-8 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript hover:border-emerald-700 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="px-2.5 py-0.5 rounded-full bg-mint-wash-100 text-emerald-700 text-xs font-semibold">
                      {isRTL ? prog.stage_ar : prog.stage_en}
                    </span>
                    <span className="text-xs text-ink-text-muted">
                      {isRTL ? prog.duration_ar : prog.duration_en}
                    </span>
                  </div>

                  <h3 className="font-serif text-xl font-semibold text-ink-green-900 mb-1">
                    {isRTL ? prog.title_ar : prog.title_en}
                  </h3>
                  <p className="text-xs text-brass-gold-500 font-medium mb-4">
                    {isRTL ? prog.subtitle_ar : prog.subtitle_en}
                  </p>
                  <p className="text-xs text-ink-text-secondary leading-relaxed mb-6">
                    {isRTL ? prog.desc_ar : prog.desc_en}
                  </p>

                  <div className="space-y-2 mb-8 pt-4 border-t border-sand-border/60">
                    {prog.highlights.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-ink-text-secondary">
                        <span className="material-symbols-outlined text-emerald-700 text-[16px]">check_circle</span>
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link 
                  to="/curriculum"
                  className="inline-flex items-center text-xs font-semibold text-emerald-700 hover:text-ink-green-900 transition-colors"
                >
                  <span>{isRTL ? 'اطّلع على تفاصيل المنهج' : 'Learn curriculum details'}</span>
                  <span className="material-symbols-outlined ml-1 text-[16px]">
                    {isRTL ? 'arrow_back' : 'arrow_forward'}
                  </span>
                </Link>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 4. Maktabah Kashifiyyah — Digital Library Showcase */}
      <section className="w-full py-20 bg-parchment-50 border-b border-sand-border overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Description & Fast Search Bar */}
            <div className="lg:col-span-7 flex flex-col items-start">
              <span className="text-xs font-semibold uppercase tracking-widest text-brass-gold-500 mb-2">
                {isRTL ? 'المكتبة الكاشفية' : 'Maktabah Kashifiyyah'}
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900 mb-4">
                {isRTL ? 'المستودع الرقمي لأمهات الكتب والمخطوطات' : 'Digital Islamic Manuscript & Book Repository'}
              </h2>
              <p className="font-serif text-sm sm:text-base text-ink-text-secondary mb-8 leading-relaxed">
                {isRTL
                  ? 'حفظ التراث الإسلامي عبر رقمنة المخطوطات النادرة وتوفير فهرس رقمي متقدم يضم أكثر من ١٢,٥٠٠ كتاب في شتى الفنون الشرعية.'
                  : 'Preserving centuries of intellectual heritage through high-resolution manuscript scans, annotated commentaries, and a searchable ledger of classical works.'}
              </p>

              {/* Fast Search Input */}
              <form onSubmit={handleLibrarySearch} className="w-full bg-paper-white p-2 rounded-[14px] border border-sand-border shadow-manuscript mb-6 flex items-center">
                <span className="material-symbols-outlined text-ink-text-muted mx-3">search</span>
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder={isRTL ? 'ابحث عن عنوان، مؤلف، أو موضوع (مثل: صحيح البخاري، ابن حجر)...' : 'Search title, author, topic (e.g. Sahih al-Bukhari, Ibn Hajar)...'}
                  className="w-full bg-transparent text-sm text-ink-text-primary focus:outline-none placeholder:text-ink-text-muted"
                />
                <button
                  type="submit"
                  className="shrink-0 px-4 py-2 bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  {isRTL ? 'بحث' : 'Search'}
                </button>
              </form>

              {/* Discipline Quick Chips */}
              <div className="flex flex-wrap items-center gap-2 mb-8">
                <span className="text-xs uppercase font-semibold text-ink-text-muted mr-1">
                  {isRTL ? 'الفنون:' : 'Discipline:'}
                </span>
                {['Tafseer', 'Hadith', 'Fiqh', 'Aqeedah', 'Arabic Language', 'Seerah'].map((disc) => (
                  <Link
                    key={disc}
                    to={`/library?category=${encodeURIComponent(disc)}`}
                    className="px-3 py-1 bg-paper-white border border-sand-border hover:bg-mint-wash-100 hover:text-emerald-700 text-ink-text-secondary text-xs rounded-full transition-colors"
                  >
                    {disc}
                  </Link>
                ))}
              </div>

              <Link
                to="/library"
                className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-ink-green-900 transition-colors"
              >
                <span>{isRTL ? 'تصفح الفهرس الكامل للمكتبة (أكثر من ١٢,٠٠٠ كتاب)' : 'Browse 12,000+ Classical Texts in Full Catalog'}</span>
                <span className="material-symbols-outlined text-[18px]">
                  {isRTL ? 'arrow_back' : 'arrow_forward'}
                </span>
              </Link>
            </div>

            {/* Right Manuscript Cards Preview */}
            <div className="lg:col-span-5 relative">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl overflow-hidden border border-sand-border bg-paper-white shadow-manuscript">
                    <div className="p-4 bg-ink-green-900 text-paper-white flex flex-col justify-between h-44 relative">
                      <span className="text-[11px] font-semibold text-brass-gold-500 uppercase tracking-widest">
                        {isRTL ? 'سند معتمد' : 'Featured Sanad'}
                      </span>
                      <div>
                        <h4 className="font-serif text-base font-semibold leading-snug">Al-Muwatta Imam Malik</h4>
                        <p className="text-xs text-dark-text-primary/75 mt-1 font-arabic" dir="rtl">الموطأ — رواية يحيى بن يحيى الليثي</p>
                      </div>
                      <Link to="/library" className="text-brass-gold-500 text-xs font-semibold inline-flex items-center gap-1">
                        Open folio →
                      </Link>
                    </div>
                  </div>

                  <div className="rounded-xl overflow-hidden border border-sand-border bg-paper-white shadow-manuscript p-4">
                    <span className="px-2 py-0.5 rounded bg-mint-wash-100 text-emerald-700 text-[11px] font-semibold inline-block mb-2">
                      Restored Scan
                    </span>
                    <h4 className="font-serif text-base font-semibold text-ink-green-900 mb-1">Kitab al-Umm</h4>
                    <p className="text-xs text-ink-text-muted mb-3 font-arabic" dir="rtl">الإمام الشافعي رحمه الله</p>
                    <div className="w-full bg-sand-border/50 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-700 h-full w-4/5"></div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 pt-6">
                  <div className="rounded-xl overflow-hidden border border-sand-border bg-paper-white shadow-manuscript p-4">
                    <span className="px-2 py-0.5 rounded bg-gold-wash-100 text-brass-gold-500 text-[11px] font-semibold inline-block mb-2">
                      Hadith Codex
                    </span>
                    <h4 className="font-serif text-base font-semibold text-ink-green-900 mb-1">Sahih al-Bukhari</h4>
                    <p className="text-xs text-ink-text-muted mb-3">Ceylon Waqf Manuscript</p>
                    <Link to="/library" className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
                      Read in Codex Reader →
                    </Link>
                  </div>

                  <div className="rounded-xl overflow-hidden border border-sand-border bg-paper-white shadow-manuscript p-4">
                    <span className="text-[11px] text-ink-text-muted uppercase tracking-wider block mb-1">Shamela Linked</span>
                    <h4 className="font-serif text-sm font-semibold text-ink-green-900">Tafsir Ibn Kathir</h4>
                    <p className="text-xs text-ink-text-secondary mt-1">4 Volumes Indexed</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Campus Dispatch / Latest News & Events */}
      <section className="w-full py-20 bg-parchment-50/60 border-b border-sand-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-700 block mb-1">
                {isRTL ? 'الأخبار والفعاليات' : 'Campus Dispatch'}
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900">
                {isRTL ? 'أحدث أخبار الكلية والمجالس العلمية' : 'Latest News & Events'}
              </h2>
            </div>
            <Link
              to="/news"
              className="inline-flex items-center text-xs font-semibold text-emerald-700 hover:text-ink-green-900 transition-colors"
            >
              <span>{isRTL ? 'عرض كافة النشرات والإعلانات' : 'View all institutional bulletins'}</span>
              <span className="material-symbols-outlined ml-1 text-[16px]">
                {isRTL ? 'arrow_back' : 'arrow_forward'}
              </span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {campusNews.map((news) => (
              <article 
                key={news.id}
                className="flex flex-col rounded-[14px] bg-paper-white border border-sand-border overflow-hidden shadow-manuscript hover:border-emerald-700 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="p-6 flex flex-col flex-grow justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-gold-wash-100 text-brass-gold-500 text-xs font-semibold">
                        {news.date_hijri}
                      </span>
                      <span className="text-xs text-ink-text-muted">
                        · {isRTL ? news.category_ar : news.category_en}
                      </span>
                    </div>

                    <h3 className="font-serif text-lg font-semibold text-ink-green-900 mb-2 leading-snug">
                      {isRTL ? news.title_ar : news.title_en}
                    </h3>
                    <p className="text-xs text-ink-text-secondary leading-relaxed mb-6">
                      {isRTL ? news.excerpt_ar : news.excerpt_en}
                    </p>
                  </div>

                  <Link 
                    to="/news"
                    className="inline-flex items-center text-xs font-semibold text-emerald-700 hover:text-ink-green-900"
                  >
                    <span>{isRTL ? 'قراءة التفاصيل' : 'Read announcement'}</span>
                    <span className="material-symbols-outlined ml-1 text-[16px]">
                      {isRTL ? 'arrow_back' : 'arrow_forward'}
                    </span>
                  </Link>
                </div>
              </article>
            ))}
          </div>

        </div>
      </section>

      {/* 6. Scholastic Journey CTA Band */}
      <section className="w-full bg-ink-green-900 text-paper-white py-20 relative overflow-hidden">
        <KhatamPattern className="opacity-[0.04]" strokeColor="#FBF8F0" id="cta-khatam" />

        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto flex flex-col items-center text-center">
            
            <div className="w-12 h-12 rounded-full bg-brass-gold-500/15 border border-brass-gold-500/30 flex items-center justify-center text-brass-gold-500 mb-6">
              <span className="material-symbols-outlined text-[24px]">school</span>
            </div>

            <span className="text-xs font-semibold uppercase tracking-widest text-brass-gold-500 mb-3">
              {isRTL ? 'ابدأ رحلتك العلمية المباركة' : 'Begin Your Scholastic Journey'}
            </span>

            <h2 className="font-serif text-3xl sm:text-4xl text-paper-white tracking-tight font-semibold mb-4">
              {isRTL ? 'انضم إلى ركب طلاب العلم الشريف' : 'Begin Your Journey of Knowledge'}
            </h2>

            <p className="font-serif text-sm sm:text-base text-dark-text-primary/80 mb-10 leading-relaxed max-w-xl">
              {isRTL
                ? 'بيئة إيمانية علمية ترعى الطالب في مسيرته لحفظ كتاب الله وإتقان العلوم العربية والشرعية على أيدي علماء أجلاء.'
                : 'Join a dedicated brotherhood of students pursuing sound tradition, intellectual integrity, and deep reverence for Islamic scholarship under experienced mentorship.'}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/admissions"
                className="inline-flex items-center justify-center h-12 px-8 rounded-[10px] bg-emerald-700 hover:bg-emerald-500 active:bg-ink-green-900 text-white font-medium text-sm shadow-manuscript transition-all"
              >
                <span>{isRTL ? 'قدّم طلب الالتحاق' : 'Apply for Admission'}</span>
                <span className="material-symbols-outlined ml-2 text-[20px]">
                  {isRTL ? 'arrow_back' : 'arrow_forward'}
                </span>
              </Link>

              <Link
                to="/about"
                className="inline-flex items-center justify-center h-12 px-8 rounded-[10px] bg-paper-white/10 hover:bg-paper-white/20 text-paper-white font-medium text-sm border border-sand-border/20 transition-all"
              >
                <span className="material-symbols-outlined mr-2 text-[20px]">info</span>
                <span>{isRTL ? 'تعرف على رسالة الكلية' : 'About the College'}</span>
              </Link>
            </div>

            <div className="mt-12 flex items-center gap-6 text-xs text-dark-text-primary/60 uppercase tracking-widest font-medium">
              <span>Accredited Curriculum</span>
              <span>·</span>
              <span>Residential Boarding</span>
              <span>·</span>
              <span>Scholarly Isnad</span>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}
