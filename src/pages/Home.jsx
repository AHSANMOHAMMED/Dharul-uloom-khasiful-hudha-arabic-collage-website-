import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Home = () => {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';

  // Standard programs list
  const programs = [
    {
      title_en: 'Quran Memorization (Hifz)',
      title_ar: 'تحفيظ القرآن الكريم (الحفظ)',
      duration_en: '3-5 Years',
      duration_ar: '٣ - ٥ سنوات',
      desc_en: 'Complete memorization of the Holy Quran with correct Tajweed rules and vocal training.',
      desc_ar: 'حفظ كامل للقرآن الكريم مع تطبيق أحكام التجويد والترتيل وتدريب الصوت.',
      icon: '🕌'
    },
    {
      title_en: 'Arabic Grammar & Syntax',
      title_ar: 'قواعد اللغة العربية (النحو والصرف)',
      duration_en: '2 Years',
      duration_ar: 'سنتان',
      desc_en: 'In-depth study of Nahw, Sarf, and classical literature to read and speak Arabic fluently.',
      desc_ar: 'دراسة متعمقة في علم النحو والصرف والأدب العربي لفهم وقراءة النصوص الكلاسيكية بطلاقة.',
      icon: '📚'
    },
    {
      title_en: 'Hadith Studies',
      title_ar: 'دراسات الحديث الشريف',
      duration_en: '1-2 Years',
      duration_ar: 'سنة - سنتان',
      desc_en: 'Examination of Prophetic traditions, chains of narrators (Isnad), and authentication principles.',
      desc_ar: 'دراسة الأحاديث النبوية الشريفة وعلم مصطلح الحديث وفحص أسانيد الرواة.',
      icon: '📜'
    },
    {
      title_en: 'Islamic Jurisprudence (Fiqh)',
      title_ar: 'الفقه الإسلامي وأصوله',
      duration_en: '1-2 Years',
      duration_ar: 'سنة - سنتان',
      desc_en: 'Understanding of Shariah rulings, transactional Fiqh, and rules of deduction.',
      desc_ar: 'فهم الأحكام الشرعية العملية وفقه العبادات والمعاملات وقواعد الاستنباط الفقهي.',
      icon: '⚖️'
    },
    {
      title_en: 'Islamic Studies & Aqidah',
      title_ar: 'الدراسات الإسلامية والعقيدة',
      duration_en: '1 Year',
      duration_ar: 'سنة واحدة',
      desc_en: 'Comprehensive overview of Islamic history, ethics, creed (Aqidah), and general studies.',
      desc_ar: 'نظرة شاملة على التاريخ الإسلامي والأخلاق والعقيدة الإسلامية والعلوم العامة.',
      icon: '💡'
    }
  ];

  return (
    <div className="bg-gray-950 text-gray-100 min-h-screen overflow-x-hidden selection:bg-emerald-500/30 selection:text-white">
      
      {/* 1. Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center py-32 px-4 overflow-hidden bg-gray-950">
        
        {/* Dynamic Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-900/20 rounded-full blur-[120px] mix-blend-screen animate-float"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-teal-900/20 rounded-full blur-[150px] mix-blend-screen animate-float" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.05)_0%,transparent_50%)]"></div>
          
          {/* Subtle Grid */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAzOGMtMS4xIDAtMi0uOS0yLTJzLjktMiAyLTIgMiAuOSAyIDItLjkgMi0yIDJ6bS0xMiAwaC0ydi0yaDJ2MnoiIGZpbGw9IiMxMGI5ODEiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvZz48L3N2Zz4=')] opacity-50"></div>
        </div>

        <div className="max-w-7xl mx-auto text-center relative z-10 space-y-10">
          
          {/* Admissions blinking announcement */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-3 px-5 py-2 rounded-full glass-panel border-amber-500/30 text-amber-400 text-xs font-bold font-mono tracking-wider uppercase shadow-glow-amber"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            {ar ? 'باب التسجيل مفتوح للعام الدراسي ٢٠٢٦' : 'Admissions Open for Year 2026/2027'}
          </motion.div>

          <div className="space-y-6">
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="text-5xl sm:text-7xl md:text-8xl font-extrabold font-arabic leading-[1.1] tracking-wide text-transparent bg-clip-text bg-gradient-to-br from-white via-emerald-100 to-amber-200 drop-shadow-2xl"
            >
              {t('home.hero.title')}
            </motion.h1>
            
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-2xl sm:text-3xl font-bold font-arabic text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400"
            >
              {t('home.hero.subtitle')}
            </motion.p>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed font-light"
            >
              {t('home.hero.description')}
            </motion.p>
          </div>

          {/* Action buttons */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="flex flex-col sm:flex-row justify-center items-center gap-6 pt-4"
          >
            <Link
              to="/library"
              className="group relative px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-400 text-gray-950 font-extrabold rounded-2xl overflow-hidden shadow-glow-emerald transition-all hover:scale-105"
            >
              <span className="relative z-10 flex items-center gap-2">
                {ar ? 'ادخل المكتبة الرقمية' : 'Enter the Digital Library'}
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
            </Link>
            
            <Link
              to="/about"
              className="group px-8 py-4 glass-panel border-amber-500/30 text-amber-400 font-bold rounded-2xl hover:bg-amber-900/30 hover:border-amber-400/50 hover:shadow-glow-amber transition-all hover:scale-105 flex items-center gap-3"
            >
              <span className="text-xl">🏫</span>
              {ar ? 'تعرف على الكلية' : 'Learn About the College'}
            </Link>
          </motion.div>

        </div>
        
        {/* Scroll indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-500"
        >
          <span className="text-xs tracking-widest uppercase font-bold">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-emerald-500/50 to-transparent animate-pulse"></div>
        </motion.div>
      </section>

      {/* 2.5 Library Spotlight */}
      <section className="py-24 px-4 bg-gray-950 relative overflow-hidden border-b border-gray-800/60">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_40%)] pointer-events-none"></div>
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-center relative z-10">
          <div className="space-y-6">
            <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-widest uppercase shadow-glow-emerald">
              {ar ? 'المكتبة الإسلامية الرقمية' : 'Digital Islamic Library'}
            </span>
            <h2 className="text-4xl sm:text-5xl font-extrabold font-arabic text-white leading-tight">
              {ar ? 'المكتبة أصبحت قلب الموقع' : 'The library is now the heart of the site'}
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              {ar
                ? 'تصفح آلاف الكتب الإسلامية من المكتبة الشاملة داخل الموقع، مع بحث سريع، تصنيفات واضحة، وقراءة مباشرة عبر Google Drive على الهاتف أو الحاسوب.'
                : 'Browse thousands of Islamic books from Al-Maktaba al-Shamela directly inside the website, with fast search, clear categories, and Google Drive reading on mobile or desktop.'}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/library"
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-glow-emerald"
              >
                {ar ? 'ابدأ التصفح' : 'Start Browsing'}
              </Link>
              <Link
                to="/library-admin"
                className="px-6 py-3 rounded-xl border border-emerald-500/30 text-emerald-300 font-bold hover:bg-emerald-900/20"
              >
                {ar ? 'إدارة الكتب' : 'Manage Books'}
              </Link>
            </div>
          </div>

          <div className="glass-card rounded-[2rem] p-6 border border-emerald-500/20 shadow-2xl">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: ar ? 'كتب كلاسيكية' : 'Classic books', value: '8,000+' },
                { label: ar ? 'بحث سريع' : 'Fast search', value: '✓' },
                { label: ar ? 'قراءة مباشرة' : 'Direct reading', value: '✓' },
                { label: ar ? 'RTL ممتاز' : 'Excellent RTL', value: '✓' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-gray-950/70 border border-gray-800 p-5 text-center">
                  <div className="text-3xl font-black text-amber-400">{item.value}</div>
                  <div className="mt-2 text-xs uppercase tracking-widest text-gray-400 font-bold">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-gray-300">
              {ar
                ? 'كل بيانات الكتب محفوظة في Supabase فقط، بينما ملفات PDF تبقى في Google Drive المجاني.'
                : 'Book metadata stays in Supabase only, while the PDF files remain in free Google Drive storage.'}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Marquee Ticker */}
      <div className="glass-panel border-y border-gray-800/60 py-4 overflow-hidden select-none relative z-20">
        <div className="flex whitespace-nowrap animate-marquee">
          <div className="flex gap-16 text-sm text-amber-400 font-bold tracking-wide items-center">
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div> {ar ? 'سجل الكتب الرقمي: تم استيراد ٨٠٠٠+ كتاب كلاسيكي من المكتبة الشاملة بنجاح.' : 'Digital Library: Over 8,000 classic books successfully imported from Al-Maktaba al-Shamela.'}</span>
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> {ar ? 'البث: تبدأ اختبارات الفصل الدراسي الأول للعام ٢٠٢٦ في الأول من يوليو.' : 'Broadcast: First term examinations for Year 2026 begin on July 1st.'}</span>
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div> {ar ? 'أولياء الأمور: بوابة المتابعة الحية للأطفال والرسوم الشهرية نشطة الآن.' : 'Parents: Live portal monitoring child grades, attendance, and monthly fee logs is now active.'}</span>
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div> {ar ? 'إشعار: يمكن للطلاب استخدام ميزة الترجمة الفورية والذكاء الاصطناعي للمساعدة أثناء المطالعة.' : 'Feature Alert: Students can now utilize AI Explainer and inline text translation within the reader.'}</span>
          </div>
          {/* Double content for seamless looping */}
          <div className="flex gap-16 text-sm text-amber-400 font-bold tracking-wide items-center ml-16">
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div> {ar ? 'سجل الكتب الرقمي: تم استيراد ٨٠٠٠+ كتاب كلاسيكي من المكتبة الشاملة بنجاح.' : 'Digital Library: Over 8,000 classic books successfully imported from Al-Maktaba al-Shamela.'}</span>
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> {ar ? 'البث: تبدأ اختبارات الفصل الدراسي الأول للعام ٢٠٢٦ في الأول من يوليو.' : 'Broadcast: First term examinations for Year 2026 begin on July 1st.'}</span>
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div> {ar ? 'أولياء الأمور: بوابة المتابعة الحية للأطفال والرسوم الشهرية نشطة الآن.' : 'Parents: Live portal monitoring child grades, attendance, and monthly fee logs is now active.'}</span>
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div> {ar ? 'إشعار: يمكن للطلاب استخدام ميزة الترجمة الفورية والذكاء الاصطناعي للمساعدة أثناء المطالعة.' : 'Feature Alert: Students can now utilize AI Explainer and inline text translation within the reader.'}</span>
          </div>
        </div>
      </div>

      {/* 3. Core Academic Programs Showcase */}
      <section className="py-32 px-4 relative bg-gray-950">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-emerald-900/10 to-transparent pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto space-y-20 relative z-10">
          <div className="text-center space-y-6">
            <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-widest uppercase shadow-glow-emerald">
              {ar ? 'المناهج العلمية' : 'Our Curriculum'}
            </span>
            <h2 className="text-4xl sm:text-5xl font-extrabold font-arabic text-white">
              {ar ? 'البرامج والدورات المقدمة' : 'Islamic Educational Programs'}
            </h2>
            <div className="h-1 w-24 bg-gradient-to-r from-emerald-500 to-amber-500 mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {programs.map((prog, index) => (
              <motion.div
                key={index}
                whileHover={{ y: -10, scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="glass-card p-8 rounded-3xl flex flex-col justify-between group"
              >
                <div className="space-y-6">
                  <div className="text-4xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 h-16 w-16 rounded-2xl flex items-center justify-center border border-amber-500/30 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-glow-amber">
                    {prog.icon}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold font-arabic text-white group-hover:text-amber-400 transition-colors">
                      {ar ? prog.title_ar : prog.title_en}
                    </h3>
                    <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 px-3 py-1 rounded-lg text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      {ar ? prog.duration_ar : prog.duration_en}
                    </div>
                  </div>
                  <p className="text-gray-400 leading-relaxed font-sans text-sm group-hover:text-gray-300 transition-colors">
                    {ar ? prog.desc_ar : prog.desc_en}
                  </p>
                </div>
                <div className="pt-8">
                  <Link 
                    to="/admissions" 
                    className="text-sm text-amber-400 font-bold flex items-center gap-2 group/link"
                  >
                    {ar ? 'تقديم طلب الالتحاق' : 'Submit Admission Request'}
                    <span className="group-hover/link:translate-x-1 transition-transform">→</span>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Statistics Widget Dashboard */}
      <section className="py-24 px-4 bg-gray-950 border-y border-gray-800/50 relative overflow-hidden">
        {/* Hexagon pattern overlay */}
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            
            <div className="space-y-4 p-8 glass-panel rounded-3xl hover:bg-gray-800/50 transition-colors">
              <span className="text-5xl block drop-shadow-2xl">🕌</span>
              <div className="text-5xl font-black text-amber-400 font-mono tracking-tight">2004</div>
              <div className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                {ar ? 'سنة التأسيس' : 'Year Established'}
              </div>
            </div>

            <div className="space-y-4 p-8 glass-panel rounded-3xl hover:bg-gray-800/50 transition-colors">
              <span className="text-5xl block drop-shadow-2xl">👨‍🎓</span>
              <div className="text-5xl font-black text-emerald-400 font-mono tracking-tight">100+</div>
              <div className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                {ar ? 'طالب نشط' : 'Active Students'}
              </div>
            </div>

            <div className="space-y-4 p-8 glass-panel rounded-3xl hover:bg-gray-800/50 transition-colors">
              <span className="text-5xl block drop-shadow-2xl">📜</span>
              <div className="text-5xl font-black text-amber-400 font-mono tracking-tight">8,000+</div>
              <div className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                {ar ? 'كتاب في المكتبة الرقمية' : 'Shamela Digital Books'}
              </div>
            </div>

            <div className="space-y-4 p-8 glass-panel rounded-3xl hover:bg-gray-800/50 transition-colors">
              <span className="text-5xl block drop-shadow-2xl">👨‍🏫</span>
              <div className="text-5xl font-black text-emerald-400 font-mono tracking-tight">5+</div>
              <div className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                {ar ? 'شيوخ وأساتذة متخصصين' : 'Specialized Teachers'}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Features Grid: Digital Library & Parent Portal */}
      <section className="py-32 px-4 bg-gray-950">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <div className="space-y-8">
            <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-widest uppercase shadow-glow-emerald">
              {ar ? 'الخدمات الرقمية للمؤسسة' : 'Integrated E-Services'}
            </span>
            <h2 className="text-4xl sm:text-5xl font-extrabold font-arabic text-white leading-tight">
              {ar ? 'بيئة تعلم رقمية تفاعلية حديثة' : 'Interactive Digital Platform'}
            </h2>
            <p className="text-gray-400 leading-relaxed text-lg font-light">
              {ar 
                ? 'توفر الكلية للطلاب وأولياء الأمور منصة شاملة تضم مكتبة متكاملة للبحث وقراءة ألوف المجلدات الإسلامية الكلاسيكية، وتتبع حي للحضور والمستحقات المالي لأولياء الأمور.'
                : 'Dharul Uloom Kashiful Hudha offers parents, students, and teachers an integrated hub comprising full digital library catalogs, lesson commentaries, salary audits, and live progress dashboards.'}
            </p>

            <div className="space-y-6 pt-4 font-sans">
              <div className="flex gap-5 glass-panel p-6 rounded-2xl">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-2xl shrink-0">🤖</div>
                <div>
                  <h4 className="font-bold text-white text-lg">{ar ? 'شرح المفاهيم بالذكاء الاصطناعي' : 'AI Context Explainer'}</h4>
                  <p className="text-sm text-gray-400 mt-2 leading-relaxed">{ar ? 'يستطيع الطالب تحديد أي جملة غامضة لتفسير إعرابها نحوياً أو سياقها الفقهي فوراً.' : 'Highlight and explain syntax syntax rules (I\'rab) or Fiqh context on-the-fly directly within the library.'}</p>
                </div>
              </div>
              <div className="flex gap-5 glass-panel p-6 rounded-2xl">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-2xl shrink-0">💳</div>
                <div>
                  <h4 className="font-bold text-white text-lg">{ar ? 'إدارة رسوم مرنة وسهلة للأهالي' : 'Live Parent Monitoring'}</h4>
                  <p className="text-sm text-gray-400 mt-2 leading-relaxed">{ar ? 'يتيح لأولياء الأمور تتبع الفواتير الشهرية والدفعات الجزئية بشكل شفاف.' : 'Parents can review accumulated partial payments, arrears, attendance, and exam grades for their child in real-time.'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Graphical Mockup representation of the portal (glass card) */}
          <div className="relative p-8 glass-card rounded-[2rem] overflow-hidden min-h-[400px] flex flex-col justify-between group perspective-1000">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-amber-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>
            
            {/* Top row */}
            <div className="flex justify-between items-center z-10">
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/20 uppercase tracking-widest font-mono shadow-glow-amber">PORTAL VIEW</span>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
              </div>
            </div>

            {/* Middle body mockup */}
            <div className="z-10 py-10 space-y-5">
              <div className="bg-gray-950/80 p-5 rounded-2xl border border-gray-800 flex justify-between items-center shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 p-[2px]">
                    <div className="w-full h-full bg-gray-900 rounded-full flex items-center justify-center font-bold text-white text-lg">A</div>
                  </div>
                  <div>
                    <div className="font-bold text-white text-base">Ahmad Abdullah</div>
                    <span className="text-xs text-gray-400 font-mono">Index: KASHIF-26-001</span>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Approved
                </span>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="bg-gray-950/60 p-5 rounded-2xl border border-gray-800 text-center shadow-inner">
                  <div className="text-3xl font-black text-emerald-400 mb-1">96%</div>
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Attendance Rate</span>
                </div>
                <div className="bg-gray-950/60 p-5 rounded-2xl border border-gray-800 text-center shadow-inner">
                  <div className="text-3xl font-black text-amber-500 mb-1">LKR 0</div>
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Arrears Dues</span>
                </div>
              </div>
            </div>

            {/* CTA bottom */}
            <div className="z-10 flex gap-4 pt-6 border-t border-gray-800/60">
              <Link
                to="/login"
                className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-bold rounded-xl text-sm text-center text-white transition-all shadow-glow-emerald border border-emerald-400/20"
              >
                Sign In to Portal
              </Link>
              <Link
                to="/register"
                className="flex-1 py-3.5 bg-gray-900/80 hover:bg-gray-800 font-bold rounded-xl text-sm text-center text-gray-300 transition-all border border-gray-700 backdrop-blur-sm"
              >
                Create Account
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* 6. Location Map & Address Integration */}
      <section className="py-32 px-4 bg-gray-950 border-t border-gray-900 relative overflow-hidden">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-gradient-to-t from-emerald-950/30 to-transparent pointer-events-none"></div>

        <div className="max-w-7xl mx-auto space-y-16 relative z-10">
          
          <div className="text-center space-y-6">
            <span className="px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold tracking-widest uppercase">
              {ar ? 'مقرنا' : 'Our Campus'}
            </span>
            <h2 className="text-4xl sm:text-5xl font-extrabold font-arabic text-white">
              {ar ? 'موقع الكلية والاتصال المباشر' : 'Visit Dharul Uloom'}
            </h2>
            <p className="text-sm text-gray-400 max-w-2xl mx-auto">
              {ar ? 'دار العلوم كاشف الهدى، موداليبالي، كالبيتيا، سريلانكا' : 'Dharul Uloom Kashiful Hudha Arabic College, Mudalippalli, Kalpitiya, Sri Lanka. Our doors are always open for prospective students and visitors.'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            {/* Map Placeholder representation */}
            <div className="glass-panel p-2 rounded-3xl overflow-hidden min-h-[400px] relative">
              <div className="absolute inset-0 rounded-3xl overflow-hidden m-2">
                <iframe
                  title="Dharul Uloom Location Map"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3945.748721319207!2d79.7228113!3d8.236!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zOMKwMTQnMDkuNiJOIDc5wrA0MycyMi4xIkU!5e0!3m2!1sen!2slk!4v1700000000000!5m2!1sen!2slk"
                  className="w-full h-full border-0 filter invert-[0.9] hue-rotate-180 contrast-125 opacity-80"
                  allowFullScreen=""
                  loading="lazy"
                ></iframe>
              </div>
            </div>

            {/* Quick Contact Form link card */}
            <div className="glass-card rounded-3xl p-10 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/5 flex items-center justify-center text-3xl mb-4 border border-emerald-500/20 shadow-glow-emerald">💬</div>
                <h3 className="text-3xl font-bold text-white">{ar ? 'تواصل معنا مباشرة عبر واتساب' : 'Instantly Connect on WhatsApp'}</h3>
                <p className="text-base text-gray-400 leading-relaxed">
                  {ar
                    ? 'لديك أي استفسار حول شروط القبول والتسجيل، أو تريد التحدث مع إدارة الكلية؟ شات واتساب متوفر على مدار الساعة للرد على استفساراتكم.'
                    : 'Have any questions about the 7-year preliminary curriculum, student admissions, or general inquiries? Access direct chat with our administration below.'}
                </p>
              </div>
              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <a
                  href="https://wa.me/94705668463"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-4 bg-[#25D366] hover:bg-[#20bd5a] font-bold rounded-2xl text-sm text-center text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#25D366]/30 hover:-translate-y-1"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Message College
                </a>
                <Link
                  to="/contact"
                  className="flex-1 py-4 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 font-bold rounded-2xl text-sm text-center transition-all hover:-translate-y-1"
                >
                  {ar ? 'صفحة اتصل بنا' : 'Contact Forms Page'}
                </Link>
              </div>
            </div>

          </div>

        </div>
      </section>

    </div>
  );
};

export default Home;
