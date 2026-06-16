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
      color: 'from-emerald-50/50 to-white',
      borderColor: 'border-emerald-100'
    },
    {
      role: 'parent',
      title_en: 'Parent Portal',
      title_ar: 'بوابة ولي الأمر',
      desc_en: 'Monitor child progress, track attendance logs, and pay tuition fees.',
      desc_ar: 'متابعة أداء الأبناء، والاطلاع على سجلات الحضور وسداد المصروفات.',
      icon: '👥',
      color: 'from-amber-50/50 to-white',
      borderColor: 'border-amber-100'
    },
    {
      role: 'tutor',
      title_en: 'Tutor / Faculty Portal',
      title_ar: 'بوابة المدرسين',
      desc_en: 'Grade assignments, update student performance logs, and manage curriculum.',
      desc_ar: 'تسجيل الدرجات، تحديث سجلات الطلاب، وإدارة المناهج والشعب الدراسية.',
      icon: '👨‍🏫',
      color: 'from-teal-50/50 to-white',
      borderColor: 'border-teal-100'
    },
    {
      role: 'librarian',
      title_en: 'Library Management',
      title_ar: 'إدارة المكتبة',
      desc_en: 'Manage the digital Shamela library catalogs and view student reading logs.',
      desc_ar: 'إدارة المكتبة الرقمية الشاملة وتصنيف الكتب وتتبع المطالعة.',
      icon: '📚',
      color: 'from-purple-50/50 to-white',
      borderColor: 'border-purple-100'
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
    <div className="bg-slate-50 text-slate-800 min-h-screen overflow-x-hidden selection:bg-emerald-500/20 selection:text-emerald-900">
      
      {/* 1. Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center py-20 px-4 overflow-hidden bg-gradient-to-br from-emerald-50/30 via-white to-amber-50/20">
        <div className="max-w-7xl mx-auto text-center relative z-10 space-y-8">
          
          {/* Logo in Hero */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="flex justify-center"
          >
            <img 
              src="/images/logo.jpg" 
              alt="Dharul Uloom Kashiful Hudha" 
              className="w-24 h-24 sm:w-32 sm:h-32 object-contain rounded-3xl shadow-lg border border-white"
            />
          </motion.div>

          {/* Admissions announcement */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold tracking-wider uppercase shadow-sm"
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
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-4xl sm:text-6xl md:text-7xl font-extrabold font-arabic leading-[1.2] text-emerald-950"
            >
              {t('home.hero.title')}
            </motion.h1>
            
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-xl sm:text-2xl font-bold font-arabic text-emerald-800"
            >
              {t('home.hero.subtitle')}
            </motion.p>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-light leading-relaxed"
            >
              {t('home.hero.description')}
            </motion.p>
          </div>

          {/* Action buttons */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4"
          >
            <Link
              to="/admissions"
              className="px-8 py-4 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold rounded-2xl shadow-md transition-all hover:scale-105"
            >
              {ar ? 'تقديم طلب قبول إلكتروني' : 'Apply for Admission'}
            </Link>
            
            <Link
              to="/library"
              className="group px-8 py-4 bg-white border border-slate-200 text-emerald-800 font-bold rounded-2xl hover:bg-slate-50 transition-all hover:scale-105 flex items-center gap-2 shadow-sm"
            >
              <span>📖</span>
              {ar ? 'تصفح المكتبة الإسلامية' : 'Explore Digital Library'}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* 2. Portal Quick Gateways Section */}
      <section className="py-24 px-4 bg-white border-y border-slate-100 relative">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <span className="px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold tracking-widest uppercase">
              {ar ? 'بوابة الخدمات الإلكترونية' : 'College Management Portals'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-arabic text-emerald-950">
              {ar ? 'الوصول المباشر للبوابة التعليمية' : 'Unified Web Application Portals'}
            </h2>
            <div className="h-1 w-20 bg-gradient-to-r from-emerald-600 to-amber-500 mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {portalGateways.map((portal) => (
              <motion.div
                key={portal.role}
                whileHover={{ y: -6, scale: 1.01 }}
                className={`bg-white p-6 rounded-3xl border ${portal.borderColor} bg-gradient-to-br ${portal.color} flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300`}
              >
                <div className="space-y-4">
                  <div className="text-3xl">{portal.icon}</div>
                  <h3 className="text-xl font-bold font-arabic text-emerald-950">
                    {ar ? portal.title_ar : portal.title_en}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed font-sans">
                    {ar ? portal.desc_ar : portal.desc_en}
                  </p>
                </div>
                <div className="pt-6">
                  <Link
                    to="/login"
                    className="block w-full py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-bold text-center border border-slate-200 text-slate-700 transition-all"
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
      <section className="py-24 px-4 relative bg-slate-50">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <span className="px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold tracking-widest uppercase">
              {ar ? 'المناهج العلمية' : 'Academics'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-arabic text-emerald-950">
              {ar ? 'البرامج والدورات المقدمة' : 'Featured Programs'}
            </h2>
            <div className="h-1 w-20 bg-gradient-to-r from-emerald-600 to-amber-500 mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {programs.map((prog, index) => (
              <div
                key={index}
                className="bg-white p-6 rounded-3xl flex flex-col justify-between border border-slate-100 shadow-sm"
              >
                <div className="space-y-4">
                  <div className="text-3xl bg-amber-50 h-12 w-12 rounded-xl flex items-center justify-center border border-amber-100 text-amber-700">
                    {prog.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-arabic text-emerald-950">
                      {ar ? prog.title_ar : prog.title_en}
                    </h3>
                    <div className="mt-2 text-xs font-semibold text-emerald-700">
                      {ar ? prog.duration_ar : prog.duration_en}
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-sans">
                    {ar ? prog.desc_ar : prog.desc_en}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Statistics Widget */}
      <section className="py-20 px-4 bg-white border-t border-slate-100 shadow-inner">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="text-4xl font-black text-emerald-800 font-mono">2004</div>
              <div className="text-xs text-slate-500 mt-2 font-bold uppercase tracking-wider">
                {ar ? 'سنة التأسيس' : 'Year Established'}
              </div>
            </div>
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="text-4xl font-black text-emerald-800 font-mono">100+</div>
              <div className="text-xs text-slate-500 mt-2 font-bold uppercase tracking-wider">
                {ar ? 'طالب نشط' : 'Active Students'}
              </div>
            </div>
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="text-4xl font-black text-emerald-800 font-mono">8,000+</div>
              <div className="text-xs text-slate-500 mt-2 font-bold uppercase tracking-wider">
                {ar ? 'كتب إسلامية' : 'Digital Books'}
              </div>
            </div>
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="text-4xl font-black text-emerald-800 font-mono">5+</div>
              <div className="text-xs text-slate-500 mt-2 font-bold uppercase tracking-wider">
                {ar ? 'أعضاء هيئة التدريس' : 'Faculty Scholars'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Direct WhatsApp & Contact Gateway */}
      <section className="py-24 px-4 bg-slate-50 border-t border-slate-100">
        <div className="max-w-4xl mx-auto text-center space-y-8 bg-white p-8 sm:p-12 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="text-4xl">💬</div>
          <h3 className="text-2xl sm:text-3xl font-bold font-arabic text-emerald-950">
            {ar ? 'تواصل مباشرة مع إدارة الكلية' : 'Get in Touch with Administration'}
          </h3>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-sans max-w-2xl mx-auto">
            {ar
              ? 'هل لديك أي استفسار حول المناهج التعليمية أو شروط التسجيل والقبول؟ يمكنك التحدث مباشرة مع مكتب الإدارة والتحصيل عبر الشات السريع.'
              : 'Have any questions about the 7-year preliminary curriculum, registration fees, or admissions? Access direct chat with our office below.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <a
              href="https://wa.me/94705668463"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3.5 bg-[#25D366] hover:bg-[#20bd5a] font-bold rounded-xl text-sm text-white flex items-center justify-center gap-2 transition-all shadow-md shadow-[#25D366]/10"
            >
              <span>WhatsApp Chat</span>
            </a>
            <Link
              to="/contact"
              className="px-8 py-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all"
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
