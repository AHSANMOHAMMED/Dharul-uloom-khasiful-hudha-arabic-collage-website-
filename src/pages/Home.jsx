import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import KhatamPattern from '../components/KhatamPattern';
import { tx } from '../lib/tx';

export default function Home() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const arrowIcon = i18n.dir() === 'rtl' ? 'arrow_back' : 'arrow_forward';

  // Academic intake year calculation
  const now = new Date();
  const intakeYear = now.getFullYear() + (now.getMonth() >= 6 ? 1 : 0);
  const withYear = (s) => s.replace('{year}', String(intakeYear));

  // State for interactive program finder (Dribbble University UI pattern)
  const [selectedProgram, setSelectedProgram] = useState('alim');
  const [librarySearch, setLibrarySearch] = useState('');

  const handleLibrarySearch = (e) => {
    e.preventDefault();
    if (librarySearch.trim()) {
      navigate(`/library?q=${encodeURIComponent(librarySearch.trim())}`);
    } else {
      navigate('/library');
    }
  };

  // Program details for interactive program finder
  const finderPrograms = {
    alim: {
      id: 'alim',
      badge: tx('المسار الأكاديمي العالي', 'Premier Scholarly Sanad'),
      level: tx('المرحلة العالية (العالمية)', 'Advanced (Al-Alimiyyah)'),
      title: tx('العالمية ودراسات الحديث الشريف والفقه', 'Al-Alimiyyah & Dawrah al-Hadith'),
      arabicTitle: 'العالمية ودراسة الصحاح الستة والفقه المقارن',
      duration: tx('٧ سنوات · إقامة داخلية كاملة', '7 Years · Full Boarding'),
      credential: tx('شهادة العالمية وإجازة بالسند المتصل', 'Musnad Sanad & Al-Alimiyyah Diploma'),
      intake: withYear(tx('شوال {year} هـ (دفعة يناير)', 'Shawwal {year} (Jan Intake)')),
      mode: tx('إقامة داخلية مجانية شاملة الإعاشة', 'Full Scholarship Residential'),
      desc: tx(
        'دراسة متعمقة في أصول الفقه والفقه المقارن وقراءة الكتب الستة بأسانيد متصلة إلى رسول الله ﷺ، لتخريج علماء راسخين في العلم وقادة للمجتمع.',
        'Comprehensive textual mastery of Usul al-Fiqh, comparative law, and complete reading of the Six Canonical Hadith Compendiums with authentic unbroken Isnad.'
      ),
      specs: [
        { label: tx('الدرجة العلمية', 'Degree Awarded'), val: tx('العالمية بالسند المتصل', 'Al-Alimiyyah Sanad') },
        { label: tx('نظام الدراسة', 'Study Mode'), val: tx('إقامة داخلية كاملة', 'Full Residential') },
        { label: tx('شرط القبول', 'Prerequisite'), val: tx('إتمام الإعدادي أو حفظ القرآن', 'Preparatory or Hifz') },
        { label: tx('المنحة الدراسية', 'Tuition & Boarding'), val: tx('منحة كاملة ١٠٠٪', '100% Scholarship') }
      ]
    },
    hifz: {
      id: 'hifz',
      badge: tx('المسار القرآني التأسيسي', 'Quranic Foundation'),
      level: tx('المرحلة التأسيسية', 'Foundation Stage'),
      title: tx('تحفيظ القرآن الكريم وتجويده وضبط مخارجه', 'Tahfeezul Quran & Tajweed Sciences'),
      arabicTitle: 'حفظ كتاب الله مع الإتقان والتجويد',
      duration: tx('٣ سنوات · إقامة داخلية', '3 Years · Full Boarding'),
      credential: tx('شهادة إتمام حفظ القرآن الكريم مع الإجازة', 'Hifz Completion Certificate & Ijazah'),
      intake: withYear(tx('مفتوح طوال العام للدفعة {year}', 'Continuous Intake {year}')),
      mode: tx('إقامة داخلية ورعاية تربوية', 'Residential Tarbiyyah'),
      desc: tx(
        'حفظ كتاب الله كاملاً بإتقان وضبط مخارج الحروف وأحكام التلاوة على أيدي قراء مسندين، مع نظام يومي محكم للسبق والسبقي والمراجعة.',
        'Complete memorization of all 30 Juz under certified Huffaz, focusing on vocal articulation (Makharij), classical Tajweed rules, and daily mutala’ah circles.'
      ),
      specs: [
        { label: tx('الدرجة العلمية', 'Credential'), val: tx('إجازة حفظ القرآن الكريم', 'Hifz al-Quran Ijazah') },
        { label: tx('نظام الدراسة', 'Study Mode'), val: tx('حلقات فردية وإقامة', 'Daily Sabaq Circles') },
        { label: tx('الفئة العمرية', 'Age Group'), val: tx('من ١٠ إلى ١٤ سنة', '10 - 14 Years') },
        { label: tx('المنحة الدراسية', 'Scholarship'), val: tx('مجاني شامل السكن والطعام', 'Full Boarding Included') }
      ]
    },
    nahw: {
      id: 'nahw',
      badge: tx('مسار علوم الآلة واللسان', 'Linguistic Sciences'),
      level: tx('المرحلة المتوسطة', 'Intermediate Stage'),
      title: tx('علوم النحو والصرف والبلاغة والأدب', 'Classical Arabic Syntax, Sarf & Balaghah'),
      arabicTitle: 'النحو والصرف وبلاغة لسان العرب',
      duration: tx('٤ سنوات · دراسة مكثفة', '4 Years · Intensive'),
      credential: tx('إجازة في علوم اللغة العربية والبيان', 'Classical Arabic Proficiency Diploma'),
      intake: withYear(tx('دفعة العام الدراسي {year}', 'Academic Year {year}')),
      mode: tx('نظام تعليمي متسلسل', 'Sequential Classical Pedagogy'),
      desc: tx(
        'التأسيس المتين في علوم العربية من الآجرومية وقطر الندى إلى ألفية ابن مالك، لتمكين الطالب من صيانة لسانه عن الخطأ وفهم كلام الله وحديث رسوله.',
        'Foundational immersion in Arabic syntax, morphology, and rhetoric from Al-Ajrumiyyah to Alfiyyah Ibn Malik, equipping scholars to directly parse classical Islamic texts.'
      ),
      specs: [
        { label: tx('الدرجة العلمية', 'Credential'), val: tx('شهادة دبلوم اللغة العربية', 'Arabic Linguistics Diploma') },
        { label: tx('المتون المعتمدة', 'Key Texts'), val: tx('الآجرومية، القطر، الألفية', 'Ajrumiyyah, Alfiyyah') },
        { label: tx('التطبيق العملي', 'Practicum'), val: tx('الإعراب والمحادثة الفصيحة', 'Classical Parsing & Eloquence') },
        { label: tx('السكن', 'Boarding'), val: tx('سكن جامعي كامل', 'On-Campus Boarding') }
      ]
    },
    preparatory: {
      id: 'preparatory',
      badge: tx('المسار الإعدادي والتمهيدي', 'Preparatory Track'),
      level: tx('المرحلة التمهيدية (الإعدادية)', 'Preparatory (I\'dadiyyah)'),
      title: tx('القسم الإعدادي لتأهيل الطلاب الجدد', 'Preparatory Arabic & Islamic Studies'),
      arabicTitle: 'التمهيد الشرعي واللغوي لطلاب المرحلة الأولى',
      duration: tx('سنة واحدة · تمهيدي مكثف', '1 Year · Preparatory'),
      credential: tx('شهادة التأهيل للمرحلة المتوسطة', 'Preparatory Completion Docket'),
      intake: withYear(tx('التسجيل مستمر للعام {year}', 'Enrollment Open {year}')),
      mode: tx('دراسة نهارية وإقامة داخلية', 'Residential Induction'),
      desc: tx(
        'برنامج تمهيدي يؤهل الطالب المستجد للانتقال السلس إلى برامج الشريعة وحلقات التحفيظ مع دروس في القراءة العربية السليمة ومبادئ الفقه والآداب.',
        'An intensive bridge curriculum preparing young learners in correct Quranic reading, foundational Arabic conversational skills, and essential Islamic etiquette.'
      ),
      specs: [
        { label: tx('الدرجة العلمية', 'Target Stage'), val: tx('التأهيل للبرامج العالية', 'Direct Progression to Alim') },
        { label: tx('التركيز', 'Core Focus'), val: tx('القراءة، الإملاء، الآداب', 'Reading, Penmanship, Adab') },
        { label: tx('الفئة المستهدفة', 'Audience'), val: tx('الطلاب الجدد من المدارس', 'New Primary Graduates') },
        { label: tx('الرعاية', 'Supervision'), val: tx('رعاية تربوية أسرية كاملة', 'Full Pastoral Mentorship') }
      ]
    }
  };

  const activeFinder = finderPrograms[selectedProgram] || finderPrograms.alim;

  // Key institutional metrics
  const impactMetrics = [
    { num: '850+', label: tx('طالب منتظم في السكن', 'Residential Scholars'), sub: tx('إقامة داخلية ورعاية متكاملة', 'Full-time campus scholars'), icon: 'groups' },
    { num: '100%', label: tx('أسانيد علمية متصلة', 'Unbroken Isnad'), sub: tx('بالسند إلى أصحاب المصنفات', 'Verified classical chains'), icon: 'verified' },
    { num: '42+', label: tx('أستاذ وعالم مسند', 'Distinguished Faculty'), sub: tx('هيئة تدريسية متفرغة', 'Resident faculty & scholars'), icon: 'school' },
    { num: '28+', label: tx('عاماً من العطاء (١٩٩٦)', 'Years of Service (Est. 1996)'), sub: tx('في خدمة العلم الشريف', 'Serving the coastal community'), icon: 'calendar_month' },
    { num: '12,500+', label: tx('مخطوط وكتاب رقمي', 'Digital Texts & Manuscripts'), sub: tx('في مكتبة الكلية الرقمية', 'Cataloged in Maktabah'), icon: 'auto_stories' },
  ];

  // Modern University Bento Grid — The 4 Core Pillars
  const corePillars = [
    {
      title: tx('أصالة السند والتلقي المبارك', 'Authentic Sanad & Transmission'),
      titleAr: 'أصالة السند والتلقي المبارك كابراً عن كابر',
      desc: tx(
        'تلقي العلم الشريف بالسند المتصل كابراً عن كابر عن نخبة من العلماء المجازين، صيانةً للأمانة ورسوخاً في فهم أصول الشريعة الغراء.',
        'Knowledge transmitted through authenticated scholarly chains connecting directly to early classical authorities and the Holy Prophet ﷺ.'
      ),
      icon: 'verified',
      tag: tx('السند المتصل', 'Unbroken Lineage'),
      bgClass: 'bg-emerald-700/5 border-emerald-700/20'
    },
    {
      title: tx('التربية النبوية والإقامة الكاملة', 'Prophetic Tarbiyyah & Boarding'),
      titleAr: 'تربية النفوس وصقل الأخلاق في بيئة إيمانية',
      desc: tx(
        'سكن داخلي متكامل يوفر بيئة إيمانية ترعى الطالب على مدار الساعة، ترسيخاً للسنن النبوية وآداب طالب العلم وصلاة الفجر وقيام الليل.',
        'Round-the-clock immersion cultivating Islamic character, Tahajjud, mutual brotherhood, and disciplined scholarly etiquette in residential dormitories.'
      ),
      icon: 'self_improvement',
      tag: tx('التربية والأخلاق', 'Character & Adab'),
      bgClass: 'bg-brass-gold-500/5 border-brass-gold-500/20'
    },
    {
      title: tx('الجمع بين الأصالة والمعاصرة', 'Classical Depth Meets Digital Tools'),
      titleAr: 'التمكن من أمهات المتون وتوظيف التقنية الحديثة',
      desc: tx(
        'التمكن الرصين من متون النحو والفقه والحديث إلى جانب الاستفادة من المكتبة الرقمية والرقمنة والمناهج الحديثة في البحث والتنظيم.',
        'Mastery of core classical compendiums (Alfiyyah, Muwatta, Sahih al-Bukhari) enriched by digital library search, text preservation, and linguistics.'
      ),
      icon: 'menu_book',
      tag: tx('المكتبة والرقمنة', 'Digital Maktabah'),
      bgClass: 'bg-mint-wash-100/50 border-sand-border'
    },
    {
      title: tx('خدمة المجتمع والريادة الدعوية', 'Community Leadership & Khidmah'),
      titleAr: 'تأهيل أئمة وخطباء ودعاة يخدمون المجتمع بالحكمة',
      desc: tx(
        'إعداد خريجين مؤهلين لإمامة المساجد وإرشاد المجتمع والإفتاء بالحكمة والاعتدال، إعماراً لبيوت الله ونشراً لروح التسامح والفضيلة.',
        'Graduating scholars actively prepared for pastoral care, pulpit eloquence (Khutbah), community counseling, and uplifting coastal Sri Lanka.'
      ),
      icon: 'volunteer_activism',
      tag: tx('الريادة والدعوة', 'Community Khidmah'),
      bgClass: 'bg-paper-white border-sand-border'
    }
  ];

  // 4-Step Admissions Journey (Dribbble University UX pattern)
  const admissionSteps = [
    {
      step: '01',
      title: tx('تقديم الطلب الإلكتروني', 'Submit Application'),
      desc: tx('تعبئة استمارة الطالب ورفع الوثائق الأساسية وموافقة ولي الأمر عبر البوابة.', 'Fill the prospective candidate docket with basic identification and parental consent.')
    },
    {
      step: '02',
      title: tx('اختبار التلاوة والكفاءة', 'Recitation Assessment'),
      desc: tx('إجراء تقييم شفهي لضبط مخارج الحروف وقواعد التجويد ومبادئ القراءة العربية.', 'Oral evaluation of Quranic articulation (Makharij) and foundational Arabic literacy.')
    },
    {
      step: '03',
      title: tx('المقابلة الشخصية للجنة', 'Admissions Interview'),
      desc: tx('جلسة حوارية مع هيئة المشايخ وإدارة الكلية بحضور ولي الأمر لمراجعة الاستعداد.', 'Formal interview with the collegiate admissions board assessing dedication and tarbiyyah.')
    },
    {
      step: '04',
      title: tx('القبول والتسكين الداخلي', 'Boarding & Induction'),
      desc: tx('إصدار رقم القيد الأكاديمي، وتخصيص الجناح بالسكن الداخلي، وبدء الحلقات.', 'Docket issuance, dormitory room allocation, and formal induction into academic halaqahs.')
    }
  ];

  // Public Campus News items
  const campusNews = [
    {
      id: 1,
      date_hijri: '15 Rajab 1448',
      category: tx('مجلس الحديث', 'Hadith Gathering'),
      title: tx('المجلس السنوي لختم صحيح البخاري ومنح الإجازات المسندة', 'Annual Khatm al-Bukhari Gathering & Sanad Conferment'),
      excerpt: tx('تكريم كوكبة من طلاب العلم المتخرجين بعد استكمال قراءة صحيح الإمام البخاري كاملاً بحضور نخبة من العلماء الأجلاء.', 'Honoring graduating scholars completing the final chapters of Sahih al-Bukhari with guest scholars from across Sri Lanka and abroad.')
    },
    {
      id: 2,
      date_hijri: '22 Rajab 1448',
      category: withYear(tx('القبول والتسجيل {year}', 'Admissions {year}')),
      title: withYear(tx('إعلان مواعيد اختبارات القبول والمقابلات الشخصية للعام الدراسي {year}', 'Entrance Examination Schedule Announced for Academic Year {year}')),
      excerpt: tx('بدء استقبال طلبات الالتحاق لبرامج الحفظ والعلوم الشرعية وإجراء اختبارات التلاوة والمقابلة الشخصية.', 'Applications are formally invited for Kulliyyah entrance interviews, Arabic oral assessment, and Quranic recitation testing.')
    },
    {
      id: 3,
      date_hijri: '04 Sha’ban 1448',
      category: tx('المكتبة والمخطوطات', 'Digital Library'),
      title: tx('رقمنة وإتاحة مخطوطات فقهية نادرة في الفقه الشافعي تعود للقرن الثامن عشر', 'Restoration of Rare 18th Century Shafi’i Jurisprudence Codices'),
      excerpt: tx('إتاحة نسخ رقمية عالية الدقة لثلاثة شروح تراثية نادرة على منهاج الطالبين للإمام النووي رحمه الله.', 'The Manuscript Preservation Wing has released digital high-resolution scans of three historically significant commentaries on Minhaj at-Talibin.')
    }
  ];

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen">

      {/* ──────────────────────────────────────────────────────────────────────────
          1. ACADEMIC HERO SECTION — Modern University UI/UX Design
      ────────────────────────────────────────────────────────────────────────── */}
      <section className="relative w-full min-h-[92vh] flex flex-col justify-between overflow-hidden bg-ink-green-900 text-paper-white">

        {/* Layered Background with Campus Imagery, Tint & Khatam Sacred Geometry */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/gallery/campus-1.jpg"
            alt={tx('ساحة كلية كاشف الهدى العربية', 'Collegiate Islamic Courtyard')}
            onError={(e) => {
              e.currentTarget.src = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=2000&q=80";
            }}
            className="w-full h-full object-cover object-center scale-105 opacity-25 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink-green-900/95 via-ink-green-900/90 to-ink-green-900"></div>
          <KhatamPattern className="opacity-[0.05]" strokeColor="#FBF8F0" id="hero-khatam" />
        </div>

        {/* Hero Grid Container */}
        <div className="relative z-10 max-w-[1240px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-12 flex-grow flex items-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center w-full">

            {/* Left Hero Column: Institutional Statement & Mission */}
            <div className="lg:col-span-7 flex flex-col items-start">

              {/* Institutional Status Ribbon Pill */}
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-brass-gold-500/15 border border-brass-gold-500/30 mb-6 backdrop-blur-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-brass-gold-500 animate-pulse"></span>
                <span className="text-xs font-semibold uppercase tracking-wider text-brass-gold-500">
                  {withYear(tx('دار العلوم كاشف الهدى العربية · تأسست عام ١٩٩٦ م · القبول مفتوح {year}', 'D.U. Kashiful Hudha Arabic College · Est. 1996 · Admissions Open {year}'))}
                </span>
              </div>

              {/* Master Headline with Bilingual Harmony */}
              <div className="space-y-3 mb-6">
                <div className="flex flex-wrap items-baseline gap-3 text-gold-wash-100 font-serif text-lg sm:text-xl font-medium">
                  <span>{tx('دار العلوم كاشف الهدى العربية — مدلايبلي', 'D.U. Kashiful Hudha Arabic College — Mudalaippali')}</span>
                </div>

                <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl text-paper-white font-bold tracking-tight leading-[1.15]">
                  {tx('علمٌ يُنير الطريق ويحفظ أصول الشريعة الغراء', 'Knowledge That Lights the Way, Grounded in Classical Tradition')}
                </h1>

                <p className="font-arabic text-xl sm:text-2xl text-gold-wash-100/90 font-normal leading-relaxed pt-1" dir="rtl">
                  صرحٌ علمي مبارك يجمع بين رسوخ السند المتصل، وجودة التربية النبوية، ونقاء المنهج الأزهري الأصيل.
                </p>
              </div>

              <p className="font-sans text-sm sm:text-base text-dark-text-primary/85 max-w-2xl leading-relaxed mb-8">
                {tx(
                  'تلتزم الكلية بإعداد نخبة من العلماء الربانيين وحفاظ كتاب الله وقادة المجتمع عبر مناهج متسلسلة تمتد لسبع سنوات مع السكن الداخلي والرعاية التربوية الكاملة في شبه جزيرة كالبيتيا، سريلانكا.',
                  'Sri Lanka\'s premier residential Islamic Arabic college dedicated to unbroken scholarly Sanad transmission, comprehensive Hifz al-Quran, and classical Al-Alimiyyah jurisprudence since 1996.'
                )}
              </p>

              {/* Action Buttons Cluster */}
              <div className="flex flex-wrap items-center gap-3.5 mb-8">
                <Link
                  to="/admissions"
                  className="inline-flex items-center justify-center h-12 px-7 rounded-btn bg-emerald-700 hover:bg-emerald-500 active:bg-ink-green-900 text-white font-semibold text-xs sm:text-sm shadow-manuscript transition-all"
                >
                  <span>{tx('التقديم للدفعة القادمة', 'Apply for Next Intake')}</span>
                  <span className="material-symbols-outlined ml-2 text-[18px]">
                    {arrowIcon}
                  </span>
                </Link>

                <Link
                  to="/courses"
                  className="inline-flex items-center justify-center h-12 px-6 rounded-btn bg-paper-white/10 hover:bg-paper-white/20 text-paper-white font-medium text-xs sm:text-sm border border-sand-border/25 backdrop-blur-xs transition-all"
                >
                  <span className="material-symbols-outlined mr-2 text-[18px]">menu_book</span>
                  <span>{tx('استكشف المساقات والمنهج', 'Explore Programs')}</span>
                </Link>

                <Link
                  to="/library"
                  className="inline-flex items-center justify-center h-12 px-5 rounded-btn hover:bg-paper-white/10 text-gold-wash-100 text-xs sm:text-sm transition-all"
                >
                  <span className="material-symbols-outlined mr-1.5 text-[18px]">auto_stories</span>
                  <span>{tx('المكتبة الرقمية', 'Digital Library')}</span>
                </Link>
              </div>

              {/* Quick Accreditation Badges */}
              <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-sand-border/15 text-xs text-dark-text-primary/70">
                <span className="inline-flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-brass-gold-500 text-[16px]">verified</span>
                  <span>{tx('تسجيل رسمي: CA/96', 'Govt. Registered CA/96')}</span>
                </span>
                <span className="text-sand-border/30">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-brass-gold-500 text-[16px]">school</span>
                  <span>{tx('إجازة بالسند المتصل', 'Musnad Sanad')}</span>
                </span>
                <span className="text-sand-border/30">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-brass-gold-500 text-[16px]">home</span>
                  <span>{tx('إقامة داخلية ورعاية متكاملة', 'Full Residential Campus')}</span>
                </span>
              </div>

            </div>

            {/* Right Hero Column: Interactive Academic Program Finder (Dribbble Signature) */}
            <div className="lg:col-span-5">
              <div className="rounded-card bg-paper-white/95 text-ink-text-primary p-6 sm:p-7 shadow-manuscript-lg border border-sand-border relative overflow-hidden backdrop-blur-md">

                {/* Card Header */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-sand-border">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-emerald-700/10 text-emerald-700 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">explore</span>
                    </span>
                    <div>
                      <h3 className="font-serif text-base font-semibold text-ink-green-900 leading-tight">
                        {tx('مستكشف المسارات العلمية', 'Academic Program Finder')}
                      </h3>
                      <p className="text-[11px] text-ink-text-muted">
                        {tx('اختر المسار للاطلاع على الشروط والمنهج', 'Select a track to review credentials & syllabus')}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-mint-wash-100 text-emerald-700 text-[11px] font-semibold">
                    {withYear(tx('دفعة {year}', 'Intake {year}'))}
                  </span>
                </div>

                {/* Interactive Track Selector Pills */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { id: 'alim', label: tx('العالمية والحديث', 'Al-Alimiyyah'), icon: 'school' },
                    { id: 'hifz', label: tx('تحفيظ القرآن', 'Hifz al-Quran'), icon: 'menu_book' },
                    { id: 'nahw', label: tx('النحو واللغة', 'Arabic Syntax'), icon: 'translate' },
                    { id: 'preparatory', label: tx('المسار الإعدادي', 'Preparatory'), icon: 'flag' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedProgram(tab.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-semibold transition-all text-start ${selectedProgram === tab.id
                          ? 'bg-ink-green-900 text-white shadow-xs'
                          : 'bg-parchment-50 text-ink-text-secondary hover:bg-sand-border/30 border border-sand-border/40'
                        }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                      <span className="truncate">{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Dynamic Program Preview Panel */}
                <div className="p-4 rounded-xl bg-parchment-50 border border-sand-border mb-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-0.5">
                        {activeFinder.badge}
                      </span>
                      <h4 className="font-serif text-sm sm:text-base font-bold text-ink-green-900 leading-snug">
                        {activeFinder.title}
                      </h4>
                    </div>
                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-paper-white border border-sand-border text-[11px] font-semibold text-brass-gold-500">
                      {activeFinder.duration}
                    </span>
                  </div>

                  <p className="text-xs text-ink-text-secondary leading-relaxed">
                    {activeFinder.desc}
                  </p>

                  {/* 2x2 Specs Grid */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-sand-border/70 text-[11px]">
                    {activeFinder.specs.map((sp, idx) => (
                      <div key={idx} className="flex flex-col">
                        <span className="text-ink-text-muted font-medium">{sp.label}</span>
                        <span className="font-semibold text-ink-text-primary truncate">{sp.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Direct Action Footer */}
                <div className="flex items-center gap-2">
                  <Link
                    to="/admissions"
                    className="flex-1 inline-flex items-center justify-center h-10 px-4 rounded-btn bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <span>{tx('قدّم طلب الالتحاق بالمسار', 'Apply for this Track')}</span>
                    <span className="material-symbols-outlined ml-1.5 text-[16px]">{arrowIcon}</span>
                  </Link>

                  <Link
                    to="/curriculum"
                    className="inline-flex items-center justify-center h-10 px-4 rounded-btn border border-sand-border hover:bg-sand-border/20 text-ink-text-primary text-xs font-medium transition-colors"
                  >
                    <span>{tx('المقررات', 'Syllabus')}</span>
                  </Link>
                </div>

              </div>
            </div>

          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────────────────────
            2. ACADEMIC KPI & BENCHMARK RIBBON BAR
        ────────────────────────────────────────────────────────────────────────── */}
        <div className="relative z-10 w-full bg-dark-canvas/90 border-t border-sand-border/15 backdrop-blur-md">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 lg:gap-8">
              {impactMetrics.map((met, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-lg bg-paper-white/5 border border-sand-border/15 text-brass-gold-500 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">{met.icon}</span>
                  </span>
                  <div className="flex flex-col">
                    <span className="font-serif text-2xl sm:text-3xl font-bold text-brass-gold-500 tabular-nums leading-tight">
                      {met.num}
                    </span>
                    <span className="text-xs font-semibold text-paper-white mt-0.5 leading-snug">
                      {met.label}
                    </span>
                    <span className="text-[11px] text-dark-text-primary/60 leading-none mt-1">
                      {met.sub}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. INSTITUTIONAL GATEWAYS (Student-First Portals Architecture)
      ────────────────────────────────────────────────────────────────────────── */}
      <section className="w-full py-20 bg-parchment-50 border-b border-sand-border">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 block mb-1">
                {tx('منظومة البوابات الأكاديمية والخدمية', 'Institutional Gateways')}
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl font-semibold text-ink-green-900">
                {tx('مكاتب الخدمات الرقمية لكل دور', 'Dedicated Role-Based Desks')}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-ink-text-secondary max-w-md">
              {tx(
                'بيئة إدارية وأكاديمية متكاملة لربط الطالب وولي الأمر والشيخ المدرس والإدارة بأعلى درجات الانضباط والشفافية.',
                'Deliberate operational desks engineered for uninterrupted study, guardian oversight, and administrative clarity.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                role: 'student',
                title: tx('بوابة الطالب الأكاديمية', 'Student Desk'),
                desc: tx('الولوج إلى المناهج التعليمية، الحضور والغياب، وسجلات الحفظ والدرجات.', 'Access syllabi, class schedules, mutala\'ah records, and memorization ledgers.'),
                action: tx('دخول البوابة', 'Enter Desk'),
                link: '/login',
                icon: 'school',
                tag: tx('المناهج والحلقات', 'Syllabi & Classes')
              },
              {
                role: 'parent',
                title: tx('بوابة ولي الأمر', 'Parent Desk'),
                desc: tx('متابعة الحضور وسجلات التربية، وتقديم طلبات الإجازات، وسداد الرسوم.', 'Track residential attendance, tarbiyyah milestones, leave exeats, and tuition fees.'),
                action: tx('متابعة الأبناء', 'View Ward'),
                link: '/login',
                icon: 'family_restroom',
                tag: tx('المتابعة التربوية', 'Tarbiyyah Tracking')
              },
              {
                role: 'tutor',
                title: tx('بوابة المشايخ والمدرسين', 'Faculty & Tutor Desk'),
                desc: tx('تسجيل الحضور اليومي للحلقات، رصد درجات الاختبارات، وإدارة التكليفات.', 'Manage halaqah registers, exam gradings, fatwa archives, and LMS dockets.'),
                action: tx('دخول هيئة التدريس', 'Faculty Login'),
                link: '/login',
                icon: 'cast_for_education',
                tag: tx('رصد الدرجات والحضور', 'Grading & Attendance')
              },
              {
                role: 'librarian',
                title: tx('المكتبة الإسلامية الرقمية', 'Maktabah Islamic Library'),
                desc: tx('مطالعة المخطوطات النادرة وأمهات كتب الحديث والتفاسير وشروح الفقه المعتمدة.', 'Browse illuminated manuscripts, indexed hadith commentaries, and classical printings.'),
                action: tx('تصفح المستودع', 'Open Repository'),
                link: '/library',
                icon: 'local_library',
                tag: tx('أكثر من ١٢,٠٠٠ كتاب', '12,000+ Classical Texts')
              }
            ].map((gate) => (
              <Link
                key={gate.role}
                to={gate.link}
                className="group flex flex-col justify-between p-6 sm:p-7 rounded-card bg-paper-white border border-sand-border shadow-manuscript hover:border-emerald-700 hover:-translate-y-1 transition-all duration-200"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-mint-wash-100 text-emerald-700 flex items-center justify-center transition-colors group-hover:bg-emerald-700 group-hover:text-white">
                      <span className="material-symbols-outlined text-[24px]">{gate.icon}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-sand-border/30 text-[10px] font-semibold text-ink-text-muted">
                      {gate.tag}
                    </span>
                  </div>

                  <h3 className="font-serif text-lg font-semibold text-ink-green-900 mb-2">
                    {gate.title}
                  </h3>
                  <p className="text-xs text-ink-text-secondary leading-relaxed mb-6">
                    {gate.desc}
                  </p>
                </div>

                <div className="flex items-center text-xs font-semibold text-emerald-700 group-hover:translate-x-1 transition-transform">
                  <span>{gate.action}</span>
                  <span className="material-symbols-outlined ml-1.5 text-[16px]">{arrowIcon}</span>
                </div>
              </Link>
            ))}
          </div>

        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          4. "WHY KASHIFUL HUDHA" — Modern University Bento Grid (4 Pillars)
      ────────────────────────────────────────────────────────────────────────── */}
      <section className="w-full py-20 bg-parchment-50/60 border-b border-sand-border">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex flex-col items-center text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">
              {tx('مميزات الكلية ورسالتها', 'Why Choose Kashiful Hudha')}
            </span>
            <h2 className="font-serif text-2xl sm:text-4xl font-semibold text-ink-green-900 mb-3">
              {tx('أركان التميز في الصرح العلمي الأصيل', 'Four Pillars of Scholarly Excellence')}
            </h2>
            <p className="text-xs sm:text-sm text-ink-text-secondary leading-relaxed">
              {tx(
                'بيئة تعليمية رصينة ترتكز على أربعة أركان تجمع بين أصالة السند النبوي الشريف ودقة التحصيل الأكاديمي والتربية السلوكية الراقية.',
                'Rooted in classical pedagogy, residential discipline, and unbroken chains of authentic Islamic scholarship.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {corePillars.map((pillar, i) => (
              <div
                key={i}
                className={`p-8 rounded-card border shadow-manuscript bg-paper-white hover:border-emerald-700 hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-mint-wash-100 text-emerald-700 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[24px]">{pillar.icon}</span>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-sand-border/30 text-xs font-semibold text-brass-gold-500">
                      {pillar.tag}
                    </span>
                  </div>

                  <h3 className="font-serif text-xl font-bold text-ink-green-900 mb-3">
                    {pillar.title}
                  </h3>

                  <p className="font-arabic text-sm text-gold-wash-100 bg-ink-green-900/95 p-3 rounded-lg mb-4 text-paper-white leading-relaxed" dir="rtl">
                    {pillar.titleAr}
                  </p>

                  <p className="text-xs sm:text-sm text-ink-text-secondary leading-relaxed">
                    {pillar.desc}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-sand-border/60 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>{tx('معتمد وموثق في لائحة الكلية', 'Accredited in College Statutes')}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          5. THE 4-STEP ADMISSIONS JOURNEY (Interactive Pipeline)
      ────────────────────────────────────────────────────────────────────────── */}
      <section className="w-full py-20 bg-parchment-50 border-b border-sand-border">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 block mb-1">
                {tx('خطوات الالتحاق والتسجيل', 'Admissions Pathway')}
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl font-semibold text-ink-green-900">
                {withYear(tx('رحلة القبول للعام الدراسي {year}', 'Four-Step Admissions Journey {year}'))}
              </h2>
            </div>
            <Link
              to="/admissions"
              className="inline-flex items-center text-xs font-semibold text-emerald-700 hover:text-ink-green-900 transition-colors"
            >
              <span>{tx('دليل القبول والشروط الكاملة', 'Full admissions prospectus & criteria')}</span>
              <span className="material-symbols-outlined ml-1.5 text-[16px]">{arrowIcon}</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {admissionSteps.map((st, idx) => (
              <div
                key={idx}
                className="p-6 rounded-card bg-paper-white border border-sand-border shadow-manuscript relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-2xl font-bold text-brass-gold-500">
                      {st.step}
                    </span>
                    <span className="w-8 h-8 rounded-full bg-mint-wash-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                  </div>

                  <h3 className="font-serif text-base font-bold text-ink-green-900 mb-2">
                    {st.title}
                  </h3>

                  <p className="text-xs text-ink-text-secondary leading-relaxed">
                    {st.desc}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-sand-border/50 text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                  <span>{tx('خطوة معتمدة', 'Mandatory Step')}</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_right_alt</span>
                </div>
              </div>
            ))}
          </div>

          {/* Admissions Action Banner */}
          <div className="mt-12 p-6 sm:p-8 rounded-card bg-ink-green-900 text-paper-white flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-start">
              <span className="text-xs font-bold uppercase tracking-wider text-brass-gold-500">
                {withYear(tx('استقبال الطلبات مستمر للعام {year}', 'Intake {year} Applications Under Review'))}
              </span>
              <h4 className="font-serif text-lg sm:text-xl font-bold text-paper-white">
                {tx('هل ترغب في تسجيل ابنك في حلقات التحفيظ أو كلية الشريعة؟', 'Ready to begin your admission application for the next term?')}
              </h4>
              <p className="text-xs text-dark-text-primary/70">
                {tx('يمكنك التقديم عبر الموقع مباشرة أو زيارة مكتب القبول بمقر الكلية في مدلايبلي.', 'Apply online through our secure portal or visit our admissions office in Mudalaippali.')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                to="/admissions"
                className="inline-flex items-center justify-center h-11 px-6 rounded-btn bg-emerald-700 hover:bg-emerald-500 text-white font-semibold text-xs shadow-manuscript transition-colors"
              >
                <span>{tx('ابدأ التقديم الآن', 'Start Application Online')}</span>
                <span className="material-symbols-outlined ml-1.5 text-[16px]">{arrowIcon}</span>
              </Link>
              <a
                href="tel:0325612355"
                className="inline-flex items-center justify-center h-11 px-5 rounded-btn bg-paper-white/10 hover:bg-paper-white/20 text-paper-white font-medium text-xs border border-sand-border/20 transition-colors"
              >
                <span className="material-symbols-outlined mr-1.5 text-[16px]">call</span>
                <span>032-5612355</span>
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          6. MAKTABAH KASHIFIYYAH — Digital Islamic Library Showcase
      ────────────────────────────────────────────────────────────────────────── */}
      <section className="w-full py-20 bg-parchment-50/60 border-b border-sand-border overflow-hidden">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            {/* Left Column: Description & Fast Search Bar */}
            <div className="lg:col-span-7 flex flex-col items-start">
              <span className="text-xs font-bold uppercase tracking-widest text-brass-gold-500 mb-2">
                {tx('المكتبة الكاشفية الرقمية', 'Maktabah Kashifiyyah')}
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl font-semibold text-ink-green-900 mb-4">
                {tx('مستودع المخطوطات وأمهات الكتب الإسلامية', 'Digital Repository of Classical Codices')}
              </h2>
              <p className="font-serif text-sm sm:text-base text-ink-text-secondary mb-8 leading-relaxed">
                {tx(
                  'حفظ التراث الإسلامي الأصيل عبر رقمنة المخطوطات النادرة وتوفير فهرس رقمي ذكي يضم أكثر من ١٢,٥٠٠ مجلد في التفسير والحديث والفقه الشافعي واللغة العربية.',
                  'Preserving centuries of intellectual heritage through high-resolution manuscript scans, annotated commentaries, and a searchable index of classical works.'
                )}
              </p>

              {/* Fast Search Input */}
              <form onSubmit={handleLibrarySearch} className="w-full bg-paper-white p-2 rounded-card border border-sand-border shadow-manuscript mb-6 flex items-center">
                <span className="material-symbols-outlined text-ink-text-muted mx-3">search</span>
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder={tx('ابحث عن عنوان، مؤلف، أو موضوع (مثل: صحيح البخاري، الإمام النووي)...', 'Search title, author, topic (e.g. Sahih al-Bukhari, Imam al-Nawawi)...')}
                  className="w-full bg-transparent text-xs sm:text-sm text-ink-text-primary focus:outline-none placeholder:text-ink-text-muted"
                />
                <button
                  type="submit"
                  className="shrink-0 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold rounded-btn transition-colors"
                >
                  {tx('بحث فوري', 'Fast Search')}
                </button>
              </form>

              {/* Discipline Quick Chips */}
              <div className="flex flex-wrap items-center gap-2 mb-8">
                <span className="text-xs uppercase font-semibold text-ink-text-muted mr-1">
                  {tx('العلوم:', 'Disciplines:')}
                </span>
                {[
                  ['Tafseer', tx('التفسير', 'Tafseer')],
                  ['Hadith', tx('الحديث', 'Hadith')],
                  ['Fiqh', tx('الفقه', 'Fiqh')],
                  ['Aqeedah', tx('العقيدة', 'Aqeedah')],
                  ['Arabic Language', tx('اللغة العربية', 'Arabic Language')],
                  ['Seerah', tx('السيرة النبوية', 'Seerah')],
                ].map(([disc, label]) => (
                  <Link
                    key={disc}
                    to={`/library?category=${encodeURIComponent(disc)}`}
                    className="px-3 py-1 bg-paper-white border border-sand-border hover:bg-mint-wash-100 hover:text-emerald-700 text-ink-text-secondary text-xs rounded-full transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </div>

              <Link
                to="/library"
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-700 hover:text-ink-green-900 transition-colors"
              >
                <span>{tx('تصفح الفهرس الكامل للمكتبة (أكثر من ١٢,٠٠٠ كتاب)', 'Browse 12,000+ Classical Texts in Full Catalog')}</span>
                <span className="material-symbols-outlined text-[18px]">{arrowIcon}</span>
              </Link>
            </div>

            {/* Right Column: Classical Manuscripts Display */}
            <div className="lg:col-span-5 relative">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-4">
                  <div className="rounded-card overflow-hidden border border-sand-border bg-paper-white shadow-manuscript">
                    <div className="p-4 bg-ink-green-900 text-paper-white flex flex-col justify-between h-44 relative">
                      <span className="text-[10px] font-bold text-brass-gold-500 uppercase tracking-widest">
                        {tx('سند معتمد', 'Featured Sanad')}
                      </span>
                      <div>
                        <h4 className="font-serif text-base font-semibold leading-snug">{tx('موطأ الإمام مالك', 'Al-Muwatta Imam Malik')}</h4>
                        <p className="text-xs text-dark-text-primary/75 mt-1 font-arabic" dir="rtl">الموطأ — رواية يحيى بن يحيى الليثي</p>
                      </div>
                      <Link to="/library" className="text-brass-gold-500 text-xs font-semibold inline-flex items-center gap-1">
                        <span>{tx('افتح الورقة', 'Open folio')}</span>
                        <span className="material-symbols-outlined text-[14px]">{arrowIcon}</span>
                      </Link>
                    </div>
                  </div>

                  <div className="rounded-card overflow-hidden border border-sand-border bg-paper-white shadow-manuscript p-4">
                    <span className="px-2 py-0.5 rounded bg-mint-wash-100 text-emerald-700 text-[10px] font-semibold inline-block mb-2">
                      {tx('نسخة مرممة', 'Restored Scan')}
                    </span>
                    <h4 className="font-serif text-base font-semibold text-ink-green-900 mb-1">{tx('كتاب الأم', 'Kitab al-Umm')}</h4>
                    <p className="text-xs text-ink-text-muted mb-3 font-arabic" dir="rtl">الإمام الشافعي رحمه الله</p>
                    <div className="w-full bg-sand-border/50 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-700 h-full w-4/5"></div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 pt-6">
                  <div className="rounded-card overflow-hidden border border-sand-border bg-paper-white shadow-manuscript p-4">
                    <span className="px-2 py-0.5 rounded bg-gold-wash-100 text-brass-gold-500 text-[10px] font-semibold inline-block mb-2">
                      {tx('مخطوطة حديثية', 'Hadith Codex')}
                    </span>
                    <h4 className="font-serif text-base font-semibold text-ink-green-900 mb-1">{tx('صحيح البخاري', 'Sahih al-Bukhari')}</h4>
                    <p className="text-xs text-ink-text-muted mb-3">{tx('مخطوطة وقف سيلان', 'Ceylon Waqf Manuscript')}</p>
                    <Link to="/library" className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
                      <span>{tx('اقرأ في قارئ المخطوطات', 'Read in Codex Reader')}</span>
                      <span className="material-symbols-outlined text-[14px]">{arrowIcon}</span>
                    </Link>
                  </div>

                  <div className="rounded-card overflow-hidden border border-sand-border bg-paper-white shadow-manuscript p-4">
                    <span className="text-[10px] text-ink-text-muted uppercase tracking-wider block mb-1">{tx('مرتبط بالشاملة', 'Shamela Linked')}</span>
                    <h4 className="font-serif text-sm font-semibold text-ink-green-900">{tx('تفسير ابن كثير', 'Tafsir Ibn Kathir')}</h4>
                    <p className="text-xs text-ink-text-secondary mt-1">{tx('٤ مجلدات مفهرسة', '4 Volumes Indexed')}</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          7. CAMPUS LIFE, MOSQUE & FACILITIES SPOTLIGHT
      ────────────────────────────────────────────────────────────────────────── */}
      <section className="w-full py-20 bg-parchment-50 border-b border-sand-border">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 block mb-1">
                {tx('الحياة الجامعية والمرافق', 'Campus Life & Facilities')}
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl font-semibold text-ink-green-900">
                {tx('بيئة إيمانية في رحاب الساحل الهادئ', 'A Serene Sanctuary for Classical Scholarship')}
              </h2>
            </div>
            <Link
              to="/gallery"
              className="inline-flex items-center text-xs font-semibold text-emerald-700 hover:text-ink-green-900 transition-colors"
            >
              <span>{tx('جولة في معرض الصور الكامل', 'Explore full campus photo gallery')}</span>
              <span className="material-symbols-outlined ml-1.5 text-[16px]">{arrowIcon}</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: tx('جامع الكلية وحلقات العلم', 'Grand Mosque & Halaqah Courtyard'),
                subtitle: tx('قلب الكلية النابض بالصلاة والذكر والدروس اليومية', 'Daily prayers, tahajjud, and scholar-led recitation circles'),
                img: '/images/gallery/mosque.jpg',
                fallback: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
                badge: tx('الجامع والمصلى', 'Masjid & Halaqahs')
              },
              {
                title: tx('المكتبة الكاشفية وصالة المطالعة', 'Maktabah Reading Sanctuary'),
                subtitle: tx('أكثر من ١٢,٠٠٠ مجلد وفهارس رقمية لأمهات المصادر', 'Silent reading halls, rare manuscripts, and research desks'),
                img: '/images/gallery/library.jpg',
                fallback: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80',
                badge: tx('المكتبة التراثية', 'Manuscript Vault')
              },
              {
                title: tx('السكن الداخلي والعيش المشترك', 'Residential Hostels & Dining'),
                subtitle: tx('رعاية تربوية أسرية وبيئة مريحة تعزز روح الأخوة', 'Disciplined dormitories, dietary care, and pastoral guidance'),
                img: '/images/gallery/campus-2.jpg',
                fallback: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80',
                badge: tx('السكن الطلابي', 'Residential Quarters')
              }
            ].map((fac, idx) => (
              <div
                key={idx}
                className="rounded-card overflow-hidden bg-paper-white border border-sand-border shadow-manuscript group hover:border-emerald-700 transition-all flex flex-col justify-between"
              >
                <div className="h-48 overflow-hidden relative">
                  <img
                    src={fac.img}
                    alt={fac.title}
                    onError={(e) => { e.currentTarget.src = fac.fallback; }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  <span className="absolute bottom-3 start-3 px-2.5 py-1 rounded bg-black/60 backdrop-blur-xs text-white text-[11px] font-semibold">
                    {fac.badge}
                  </span>
                </div>

                <div className="p-5 flex flex-col flex-grow justify-between">
                  <div>
                    <h3 className="font-serif text-base font-bold text-ink-green-900 mb-1.5 leading-snug">
                      {fac.title}
                    </h3>
                    <p className="text-xs text-ink-text-secondary leading-relaxed mb-4">
                      {fac.subtitle}
                    </p>
                  </div>

                  <Link
                    to="/about"
                    className="inline-flex items-center text-xs font-semibold text-emerald-700 hover:text-ink-green-900"
                  >
                    <span>{tx('المزيد عن مرافق الكلية', 'Learn about facilities')}</span>
                    <span className="material-symbols-outlined ml-1 text-[16px]">{arrowIcon}</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          8. DEAN / PRINCIPAL'S FORMAL ADDRESS
      ────────────────────────────────────────────────────────────────────────── */}
      <section className="w-full py-20 bg-parchment-50/60 border-b border-sand-border">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-card bg-paper-white border border-sand-border p-8 sm:p-12 shadow-manuscript relative overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

              <div className="lg:col-span-4 flex flex-col items-center text-center">
                <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-brass-gold-500/50 bg-ink-green-900 p-1 mb-4 shadow-manuscript">
                  <img
                    src="/images/logo.svg"
                    alt={tx('مدير كلية كاشف الهدى العربية', 'Principal of D.U. Kashiful Hudha Arabic College')}
                    className="w-full h-full object-contain rounded-full bg-paper-white"
                  />
                </div>
                <h4 className="font-serif text-lg font-bold text-ink-green-900">
                  {tx('الشيخ عبد الحكيم الكاشفي', 'Ustaz Abdul Hakeem Al-Kashifi')}
                </h4>
                <span className="text-xs text-brass-gold-500 font-semibold mt-0.5">
                  {tx('مدير الكلية ورئيس هيئة التدريس', 'Principal & Head of Collegiate Faculty')}
                </span>
                <span className="text-[11px] text-ink-text-muted mt-1">
                  {tx('دار العلوم كاشف الهدى العربية', 'D.U. Kashiful Hudha Arabic College')}
                </span>
              </div>

              <div className="lg:col-span-8 border-t lg:border-t-0 lg:border-l border-sand-border pt-6 lg:pt-0 lg:pl-8">
                <span className="material-symbols-outlined text-brass-gold-500 text-3xl mb-3 block">
                  format_quote
                </span>
                <blockquote className="font-serif italic text-base sm:text-lg text-ink-text-primary leading-relaxed mb-6">
                  {tx(
                    '"إن العلم الشرعي ليس مجرد معلومات تُحفظ أو شهادات تُنال، بل هو نورٌ يقذفه الله في القلب يثمر خشيةً وأمانةً وعملاً صالحاً. وعهدنا لأبنائنا الطلاب وأولياء أمورهم أن نبذل غاية الجهد لتربيتهم على السمت النبوي الشريف وصيانة الدين بالحجة والبرهان."',
                    '"True Islamic scholarship is never mere accumulation of texts, but an illuminated trust that cultivates God-consciousness, moral restraint, and compassionate leadership. Our solemn pledge to every family is that their sons will be nurtured with uncompromising scholastic rigor and fatherly tarbiyyah."'
                  )}
                </blockquote>

                <div className="flex flex-wrap items-center gap-4">
                  <Link
                    to="/admissions"
                    className="inline-flex items-center justify-center h-10 px-5 rounded-btn bg-emerald-700 hover:bg-emerald-500 text-white text-xs font-semibold shadow-manuscript transition-colors"
                  >
                    <span>{tx('التقديم للدفعة القادمة', 'Apply for Next Intake')}</span>
                    <span className="material-symbols-outlined ml-1.5 text-[16px]">{arrowIcon}</span>
                  </Link>

                  <Link
                    to="/contact"
                    className="inline-flex items-center justify-center h-10 px-5 rounded-btn border border-sand-border hover:bg-sand-border/20 text-ink-text-primary text-xs font-medium transition-colors"
                  >
                    <span>{tx('التواصل مع الإدارة', 'Contact Administration')}</span>
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          9. CAMPUS DISPATCH / LATEST NEWS & BULLETINS
      ────────────────────────────────────────────────────────────────────────── */}
      <section className="w-full py-20 bg-parchment-50 border-b border-sand-border">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-700 block mb-1">
                {tx('نشرات ومجالس الكلية', 'Campus Dispatch')}
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl font-semibold text-ink-green-900">
                {tx('أحدث أخبار الكلية والمجالس العلمية', 'Latest News & Scholarly Bulletins')}
              </h2>
            </div>
            <Link
              to="/news"
              className="inline-flex items-center text-xs font-semibold text-emerald-700 hover:text-ink-green-900 transition-colors"
            >
              <span>{tx('عرض كافة النشرات والإعلانات', 'View all institutional bulletins')}</span>
              <span className="material-symbols-outlined ml-1.5 text-[16px]">{arrowIcon}</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {campusNews.map((news) => (
              <article
                key={news.id}
                className="flex flex-col rounded-card bg-paper-white border border-sand-border overflow-hidden shadow-manuscript hover:border-emerald-700 hover:-translate-y-1 transition-all duration-200"
              >
                <div className="p-6 flex flex-col flex-grow justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-gold-wash-100 text-brass-gold-500 text-xs font-semibold">
                        {news.date_hijri}
                      </span>
                      <span className="text-xs text-ink-text-muted">
                        · {news.category}
                      </span>
                    </div>

                    <h3 className="font-serif text-lg font-semibold text-ink-green-900 mb-2 leading-snug">
                      {news.title}
                    </h3>
                    <p className="text-xs text-ink-text-secondary leading-relaxed mb-6">
                      {news.excerpt}
                    </p>
                  </div>

                  <Link
                    to="/news"
                    className="inline-flex items-center text-xs font-semibold text-emerald-700 hover:text-ink-green-900"
                  >
                    <span>{tx('قراءة التفاصيل', 'Read announcement')}</span>
                    <span className="material-symbols-outlined ml-1.5 text-[16px]">{arrowIcon}</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>

        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          10. GRAND ADMISSIONS CALL-TO-ACTION BAND
      ────────────────────────────────────────────────────────────────────────── */}
      <section className="w-full bg-ink-green-900 text-paper-white py-20 relative overflow-hidden">
        <KhatamPattern className="opacity-[0.04]" strokeColor="#FBF8F0" id="cta-khatam" />

        <div className="relative z-10 max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto flex flex-col items-center text-center">

            <div className="w-14 h-14 rounded-full bg-brass-gold-500/15 border border-brass-gold-500/30 flex items-center justify-center text-brass-gold-500 mb-6 shadow-manuscript">
              <span className="material-symbols-outlined text-[28px]">school</span>
            </div>

            <span className="text-xs font-bold uppercase tracking-widest text-brass-gold-500 mb-3">
              {tx('ابدأ رحلتك العلمية المباركة', 'Begin Your Scholastic Journey')}
            </span>

            <h2 className="font-serif text-3xl sm:text-5xl text-paper-white tracking-tight font-bold mb-4">
              {tx('انضم إلى ركب طلاب العلم الشريف', 'Begin Your Journey of Sacred Knowledge')}
            </h2>

            <p className="font-serif text-sm sm:text-base text-dark-text-primary/80 mb-10 leading-relaxed max-w-xl">
              {tx(
                'بيئة إيمانية علمية ترعى الطالب في مسيرته لحفظ كتاب الله وإتقان العلوم العربية والشرعية على أيدي مشايخ أجلاء بالسند المتصل.',
                'Join a dedicated brotherhood of students pursuing sound tradition, intellectual integrity, and deep reverence for Islamic scholarship under experienced mentorship.'
              )}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/admissions"
                className="inline-flex items-center justify-center h-12 px-8 rounded-btn bg-emerald-700 hover:bg-emerald-500 active:bg-ink-green-900 text-white font-semibold text-sm shadow-manuscript transition-all"
              >
                <span>{tx('قدّم طلب الالتحاق الآن', 'Apply for Admission')}</span>
                <span className="material-symbols-outlined ml-2 text-[18px]">
                  {arrowIcon}
                </span>
              </Link>

              <Link
                to="/about"
                className="inline-flex items-center justify-center h-12 px-8 rounded-btn bg-paper-white/10 hover:bg-paper-white/20 text-paper-white font-medium text-sm border border-sand-border/20 transition-all"
              >
                <span className="material-symbols-outlined mr-2 text-[18px]">info</span>
                <span>{tx('تعرف على تاريخ ورسالة الكلية', 'About the College')}</span>
              </Link>
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-dark-text-primary/60 uppercase tracking-widest font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-brass-gold-500 text-[16px]">verified</span>
                <span>{tx('منهج معتمد ومسند', 'Accredited Curriculum')}</span>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-brass-gold-500 text-[16px]">home</span>
                <span>{tx('إقامة داخلية ورعاية كاملة', 'Full Boarding Campus')}</span>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-brass-gold-500 text-[16px]">payments</span>
                <span>{tx('منح دراسية مجانية', 'Scholarship Model')}</span>
              </span>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}
