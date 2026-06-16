import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Home = () => {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';

  const portalGateways = [
    {
      role: 'student',
      title_en: 'Student Portal',
      title_ar: 'بوابة الطالب',
      desc_en: 'Access courses, check your attendance, grades, and submit assignments.',
      desc_ar: 'الولوج إلى المناهج التعليمية، الحضور والغياب، والدرجات الأكاديمية.',
      icon: '👨‍🎓',
      color: 'from-emerald-500/20 to-emerald-500/5',
      borderColor: 'border-emerald-500/30'
    },
    {
      role: 'parent',
      title_en: 'Parent Portal',
      title_ar: 'بوابة ولي الأمر',
      desc_en: 'Monitor child progress, track attendance logs, and pay tuition fees.',
      desc_ar: 'متابعة أداء الأبناء، والاطلاع على سجلات الحضور وسداد المصروفات.',
      icon: '👨‍👩-أولياء الأمور', // standard family icon
      descIcon: '👥',
      color: 'from-amber-500/20 to-amber-500/5',
      borderColor: 'border-amber-500/30'
    },
    {
      role: 'tutor',
      title_en: 'Tutor / Faculty Portal',
      title_ar: 'بوابة المدرسين',
      desc_en: 'Grade assignments, update student performance logs, and manage curriculum.',
      desc_ar: 'تسجيل الدرجات، تحديث سجلات الطلاب، وإدارة المناهج والشعب الدراسية.',
      icon: '👨‍🏫',
      color: 'from-teal-500/20 to-teal-500/5',
      borderColor: 'border-teal-500/30'
    },
    {
      role: 'librarian',
      title_en: 'Library Management',
      title_ar: 'إدارة المكتبة',
      desc_en: 'Manage the digital Shamela library catalogs and view student reading logs.',
      desc_ar: 'إدارة المكتبة الرقمية الشاملة وتصنيف الكتب وتتبع المطالعة.',
      icon: '📚',
      color: 'from-purple-500/20 to-purple-500/5',
      borderColor: 'border-purple-500/30'
    }
  ];

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
      icon: '📝'
    },
    {
      title_en: 'Hadith Studies',
      title_ar: 'دراسات الحديث الشريف',
      duration_en: '1-2 Years',
      duration_ar: 'سنة - سنتان',
      desc_en: 'Examination of Prophetic traditions, chains of narrators (Isnad), and authentication principles.',
      desc_ar: 'دراسة الأحاديث النبوية الشريفة وعلم مصطلح الحديث وفحص أسانيد الرواة.',
      icon: '📜'
    }
  ];

  return (
    <div className="bg-gray-950 text-gray-100 min-h-screen overflow-x-hidden selection:bg-emerald-500/30 selection:text-white">
      
      {/* 1. Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center py-20 px-4 overflow-hidden">
        {/* Dynamic Background Circles */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-emerald-900/10 rounded-full blur-[120px] mix-blend-screen animate-float"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-teal-900/10 rounded-full blur-[150px] mix-blend-screen animate-float" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="max-w-7xl mx-auto text-center relative z-10 space-y-8">
          {/* Blink admissions indicator */}
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
              className="text-4xl sm:text-6xl md:text-7xl font-extrabold font-arabic leading-[1.1] text-transparent bg-clip-text bg-gradient-to-br from-white via-emerald-100 to-amber-200"
            >
              {t('home.hero.title')}
            </motion.h1>
            
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-xl sm:text-2xl font-bold font-arabic text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400"
            >
              {t('home.hero.subtitle')}
            </motion.p>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto font-light leading-relaxed"
            >
              {t('home.hero.description')}
            </motion.p>
          </div>

          {/* Action buttons */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4"
          >
            <Link
              to="/admissions"
              className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-extrabold rounded-2xl shadow-glow-emerald hover:from-emerald-500 hover:to-teal-600 transition-all hover:scale-105"
            >
              {ar ? 'تقديم طلب قبول إلكتروني' : 'Apply for Admission'}
            </Link>
            
            <Link
              to="/library"
              className="group px-8 py-4 glass-panel border-amber-500/30 text-amber-400 font-bold rounded-2xl hover:bg-amber-900/20 hover:border-amber-400/50 transition-all hover:scale-105 flex items-center gap-2"
            >
              <span>📖</span>
              {ar ? 'تصفح المكتبة الإسلامية' : 'Explore Digital Library'}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* 2. Portal Quick Gateways Section */}
      <section className="py-24 px-4 bg-gray-950/40 border-y border-gray-900 relative">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-widest uppercase shadow-glow-emerald">
              {ar ? 'بوابة الخدمات الإلكترونية' : 'College Management Portals'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-arabic text-white">
              {ar ? 'الوصول المباشر للبوابة التعليمية' : 'Unified Web Application Portals'}
            </h2>
            <div className="h-1 w-20 bg-gradient-to-r from-emerald-500 to-amber-500 mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {portalGateways.map((portal) => (
              <motion.div
                key={portal.role}
                whileHover={{ y: -8, scale: 1.02 }}
                className={`glass-card p-6 rounded-3xl border ${portal.borderColor} bg-gradient-to-br ${portal.color} flex flex-col justify-between`}
              >
                <div className="space-y-4">
                  <div className="text-3xl">{portal.role === 'parent' ? portal.descIcon : portal.icon}</div>
                  <h3 className="text-xl font-bold font-arabic text-white">
                    {ar ? portal.title_ar : portal.title_en}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed font-sans">
                    {ar ? portal.desc_ar : portal.desc_en}
                  </p>
                </div>
                <div className="pt-6">
                  <Link
                    to="/login"
                    className="block w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-xs font-bold text-center border border-gray-800 text-gray-300 transition-all"
                  >
                    {ar ? 'دخول للبوابة' : 'Log In to Portal'}
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Core Academic Programs Showcase */}
      <section className="py-24 px-4 relative bg-gray-950">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-widest uppercase">
              {ar ? 'المناهج العلمية' : 'Academics'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-arabic text-white">
              {ar ? 'البرامج والدورات المقدمة' : 'Featured Programs'}
            </h2>
            <div className="h-1 w-20 bg-gradient-to-r from-emerald-500 to-amber-500 mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {programs.map((prog, index) => (
              <div
                key={index}
                className="glass-card p-6 rounded-3xl flex flex-col justify-between border border-gray-800"
              >
                <div className="space-y-4">
                  <div className="text-3xl bg-amber-500/10 h-12 w-12 rounded-xl flex items-center justify-center border border-amber-500/20 text-amber-400">
                    {prog.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-arabic text-white">
                      {ar ? prog.title_ar : prog.title_en}
                    </h3>
                    <div className="mt-2 text-xs font-semibold text-emerald-400">
                      {ar ? prog.duration_ar : prog.duration_en}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed font-sans">
                    {ar ? prog.desc_ar : prog.desc_en}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Statistics Widget */}
      <section className="py-20 px-4 bg-gray-950/60 border-t border-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            <div className="p-6 glass-panel rounded-2xl">
              <div className="text-4xl font-black text-amber-400 font-mono">2004</div>
              <div className="text-xs text-gray-500 mt-2 font-bold uppercase tracking-wider">
                {ar ? 'سنة التأسيس' : 'Year Established'}
              </div>
            </div>
            <div className="p-6 glass-panel rounded-2xl">
              <div className="text-4xl font-black text-emerald-400 font-mono">100+</div>
              <div className="text-xs text-gray-500 mt-2 font-bold uppercase tracking-wider">
                {ar ? 'طالب نشط' : 'Active Students'}
              </div>
            </div>
            <div className="p-6 glass-panel rounded-2xl">
              <div className="text-4xl font-black text-amber-400 font-mono">8,000+</div>
              <div className="text-xs text-gray-500 mt-2 font-bold uppercase tracking-wider">
                {ar ? 'كتب إسلامية' : 'Digital Books'}
              </div>
            </div>
            <div className="p-6 glass-panel rounded-2xl">
              <div className="text-4xl font-black text-emerald-400 font-mono">5+</div>
              <div className="text-xs text-gray-500 mt-2 font-bold uppercase tracking-wider">
                {ar ? 'أعضاء هيئة التدريس' : 'Faculty Scholars'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Direct WhatsApp & Contact Gateway */}
      <section className="py-24 px-4 bg-gray-950 border-t border-gray-900">
        <div className="max-w-4xl mx-auto text-center space-y-8 glass-panel p-8 sm:p-12 rounded-[2rem] border border-gray-800">
          <div className="text-4xl">💬</div>
          <h3 className="text-2xl sm:text-3xl font-bold font-arabic text-white">
            {ar ? 'تواصل مباشرة مع إدارة الكلية' : 'Get in Touch with Administration'}
          </h3>
          <p className="text-sm sm:text-base text-gray-400 leading-relaxed font-sans max-w-2xl mx-auto">
            {ar
              ? 'هل لديك أي استفسار حول المناهج التعليمية أو شروط التسجيل والقبول؟ يمكنك التحدث مباشرة مع مكتب الإدارة والتحصيل عبر الشات السريع.'
              : 'Have any questions about the 7-year preliminary curriculum, registration fees, or admissions? Access direct chat with our office below.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <a
              href="https://wa.me/94705668463"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3.5 bg-[#25D366] hover:bg-[#20bd5a] font-bold rounded-xl text-sm text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#25D366]/20"
            >
              <span>WhatsApp Chat</span>
            </a>
            <Link
              to="/contact"
              className="px-8 py-3.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 font-bold rounded-xl text-sm transition-all"
            >
              {ar ? 'صفحة اتصل بنا' : 'Contact Administration'}
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
