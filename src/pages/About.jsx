import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import KhatamPattern from '../components/KhatamPattern'
import { tx } from '../lib/tx';

export default function About() {
  useTranslation() // re-render on language change
  const yearsOfService = new Date().getFullYear() - 2004

  const coreValues = [
    {
      title: tx('أصالة السند والتلقي', 'Authentic Transmission (Isnad)'),
      desc: tx('تلقي العلم الشريف بالسند المتصل كابراً عن كابر وفق منهج أهل السنة والجماعة.', 'Knowledge received generation-to-generation through unbroken scholarly chains grounded in the Quran and Sunnah.'),
      icon: 'verified'
    },
    {
      title: tx('التربية والتزكية الروحية', 'Spiritual Discipline (Tarbiyyah)'),
      desc: tx('تزكية النفوس والأخلاق الفاضلة وتطبيق السنن النبوية في المعاملة والعبادة والعيش المشترك.', 'Holistic refinement of character, prayerful devotion, humility, and adherence to Islamic etiquette in residential boarding.'),
      icon: 'self_improvement'
    },
    {
      title: tx('الإتقان والرسوخ العلمي', 'Scholarly Rigor (Itqan)'),
      desc: tx('التمكن الدقيق من علوم الآلة واللغة العربية وقواعد الفقه وأصول الاستنباط.', 'Deep mastery of Arabic syntax, morphology, legal precedents, and text validation without intellectual shortcuts.'),
      icon: 'menu_book'
    },
    {
      title: tx('خدمة المجتمع والأمة', 'Community Service (Khidmah)'),
      desc: tx('توجيه الطاقات لنفع المسلمين وعمارة المساجد وإرشاد المجتمع بروح التواضع والمسؤولية.', 'Graduates actively dedicated to pastoral care, religious guidance, and uplifting the coastal community and nation.'),
      icon: 'volunteer_activism'
    }
  ]

  const milestones = [
    {
      year: '2004',
      title: tx('التأسيس المبارك في قرية مدلايبلي', 'Foundation in Mudalippalli'),
      desc: tx('انطلاق مسيرة التعليم بحلقات قرآنية مباركة لتلبية حاجة أبناء الساحل في شبه جزيرة كالبيتيا.', 'Established as an intimate preliminary Arabic and Quranic madrasa serving the rural families of the Kalpitiya peninsula.')
    },
    {
      year: '2008',
      title: tx('التسجيل الرسمي لدى وزارة الشؤون الدينية', 'Official Ministry Registration'),
      desc: tx('التسجيل لدى إدارة الشؤون الدينية والثقافية الإسلامية في سريلانكا.', 'Registered with Sri Lanka’s Department of Muslim Religious and Cultural Affairs.')
    },
  ]

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen">
      
      {/* 1. Slim Editorial Header & Breadcrumb */}
      <section className="relative w-full bg-ink-green-900 text-paper-white py-16 overflow-hidden border-b border-sand-border/20">
        <img src="/images/campus/building.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-ink-green-900/80" aria-hidden="true" />
        <KhatamPattern className="opacity-[0.04]" strokeColor="#FBF8F0" id="about-khatam" />
        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          
          <nav className="flex items-center gap-2 text-xs text-dark-text-primary/70 mb-4" aria-label={tx('مسار التنقل', 'Breadcrumb')}>
            <Link to="/" className="hover:text-gold-wash-100 transition-colors">{tx('الرئيسية', 'Home')}</Link>
            <span>/</span>
            <span className="text-brass-gold-500 font-medium">{tx('من نحن', 'About')}</span>
          </nav>

          <span className="text-xs font-semibold uppercase tracking-widest text-brass-gold-500 mb-2 block">
            {tx('عن دار العلوم', 'Institutional Heritage')}
          </span>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-paper-white tracking-tight max-w-3xl">
            {tx('أصالة التلقي ورسالة النور', 'Rooted in Tradition, Illuminating the Future')}
          </h1>
          <p className="font-serif text-sm sm:text-base text-dark-text-primary/80 mt-3 max-w-2xl leading-relaxed">
            {tx('نبذة عن مسيرة دار العلوم كاشف الهدى في خدمة القرآن الكريم والعلوم الإسلامية على امتداد عقدين من الزمن.', 'Over two decades of dedicated pedagogical service, Quranic memorization, and classical Islamic scholarship in Kalpitiya, Sri Lanka.')}
          </p>
        </div>
      </section>

      {/* 2. Our Story (Editorial Two-Column Layout) */}
      <section className="w-full py-20 border-b border-sand-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-7 space-y-6">
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-700 block">
                {tx('قصة التأسيس', 'Our Story & Genesis')}
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900 leading-snug">
                {tx('من حلقة قرآنية متواضعة إلى صرحٍ تعليمي إسلامي معتمد', 'From a Humble Coastal Circle to an Authenticated College of Arabic Scholarship')}
              </h2>
              <p className="text-sm sm:text-base text-ink-text-secondary leading-relaxed font-sans">
                {tx('تأسست دار العلوم كاشف الهدى في عام ٢٠٠٤ م كمؤسسة تعليمية عربية أولية في قرية مُدلايبّلّي بريف شبه جزيرة كالبيتيا، مقاطعة بوتالام، سريلانكا. وقد انطلقت المسيرة برعاية نخبة من العلماء المخلصين الذين استشعروا الحاجة الماسة إلى بناء صرحٍ يجمع بين متانة الحفظ ونقاء العقيدة.', 'The Sri Lankan Arabic College directory lists Dharul Uloom Kashiful Hudha in Mudalippalli, Kalpitiya, Puttalam, with an establishment year of 2004 and registration in 2008. The college provides residential Arabic and Islamic studies.')}
              </p>
              <p className="text-sm sm:text-base text-ink-text-secondary leading-relaxed font-sans">
                {tx('تواصل الكلية تقديم التعليم العربي والإسلامي في بيئتها التعليمية في كالبيتيا.', 'The college continues to provide Arabic and Islamic education in Kalpitiya.')}
              </p>

              <div className="pt-2 flex items-center gap-6 text-xs text-ink-text-muted">
                <div>
                  <span className="font-serif text-xl font-bold text-ink-green-900 block">{tx('مُدلايبالي', 'Mudalippalli')}</span>
                  <span>{tx('موقع الكلية', 'College location')}</span>
                </div>
                <div className="h-8 w-px bg-sand-border"></div>
                <div>
                  <span className="font-serif text-xl font-bold text-ink-green-900 block tabular-nums">{tx('{n}+ سنة', '{n}+ Years').replace('{n}', yearsOfService)}</span>
                  <span>{tx('من الخدمة التعليمية المتواصلة', 'Continuous Academic Service')}</span>
                </div>
              </div>
            </div>

            {/* Campus Archival Card */}
            <div className="lg:col-span-5">
              <div className="p-4 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
                <div className="min-h-64 overflow-hidden rounded-lg bg-[#f4f1e9]">
                  <img src="/images/campus/building.jpg" alt={tx('مبنى الكلية', 'College building')} className="h-48 w-full object-cover" />
                  <div className="flex flex-col items-center px-6 py-5 text-center">
                    <img src="/images/logo.png" alt={tx('شعار دار العلوم كاشف الهدى', 'Dharul Uloom Kashiful Hudha emblem')} className="mb-3 h-20 w-20 rounded-full object-contain border border-sand-border bg-white" />
                    <span className="font-serif font-semibold text-ink-green-900">{tx('مُدلايبالي، كالبيتيا', 'Mudalippalli, Kalpitiya')}</span>
                    <span className="mt-1 text-xs text-ink-text-muted">{tx('مقاطعة بوتالام · سريلانكا', 'Puttalam District · Sri Lanka')}</span>
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
              {tx('الغاية والمقصد', 'Purpose & Horizon')}
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900">
              {tx('رسالتنا ورؤيتنا', 'Mission & Vision')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Mission Panel */}
            <div className="p-8 rounded-[14px] bg-paper-white border border-sand-border border-t-4 border-t-brass-gold-500 shadow-manuscript relative">
              <div className="w-10 h-10 rounded-lg bg-gold-wash-100 text-brass-gold-500 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-[22px]">{'flag'}</span>
              </div>
              <h3 className="font-serif text-xl font-semibold text-ink-green-900 mb-3">
                {tx('رسالتنا المؤسسية', 'Our Mission')}
              </h3>
              <p className="text-sm text-ink-text-secondary leading-relaxed font-sans">
                {tx('رعاية الإيمان والعلم النافع عبر توفير بيئة تعليمية إسلامية شاملة تدمج بين إتقان حفظ القرآن الكريم، ودراسة علوم الشريعة واللغة العربية، والتربية الروحية، لتخريج دعاة وعلماء يتصفون بحسن الخلق والأمانة وخدمة المجتمع.', 'To nurture authentic faith and rigorous knowledge through a comprehensive Islamic curriculum that combines Quranic memorization, linguistic mastery, and sound jurisprudence with disciplined residential tarbiyyah, preparing righteous and community-minded scholars.')}
              </p>
            </div>

            {/* Vision Panel */}
            <div className="p-8 rounded-[14px] bg-paper-white border border-sand-border border-t-4 border-t-emerald-700 shadow-manuscript relative">
              <div className="w-10 h-10 rounded-lg bg-mint-wash-100 text-emerald-700 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-[22px]">{'visibility'}</span>
              </div>
              <h3 className="font-serif text-xl font-semibold text-ink-green-900 mb-3">
                {tx('رؤيتنا المستقبلية', 'Our Vision')}
              </h3>
              <p className="text-sm text-ink-text-secondary leading-relaxed font-sans">
                {tx('أن نكون منارةً رائدة في سريلانكا وجنوب آسيا في التعليم الإسلامي الأصيل، معروفين بالرسوخ العلمي، والنزاهة الأخلاقية، والريادة في نشر سماحة الإسلام والاعتدال.', 'To stand as an exemplary citadel of traditional Islamic scholarship and moral leadership across Sri Lanka, acclaimed for pedagogical excellence, manuscript preservation, and graduates of enduring scholastic integrity.')}
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
                {tx('الثوابت والقيم', 'Pillars of Virtue')}
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900">
                {tx('القيم الأساسية التي نعتز بها', 'Core Values & Academic Principles')}
              </h2>
            </div>
            <p className="text-sm text-ink-text-secondary max-w-md">
              {tx('مبادئ راسخة تُشكل وجدان طالب العلم وتعكس أمانة حمل الشريعة الغراء.', 'Guiding imperatives that frame every classroom halaqah, residential dormitory routine, and scholarly lecture.')}
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
                  {val.title}
                </h3>
                <p className="text-xs text-ink-text-secondary leading-relaxed">
                  {val.desc}
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
              {tx('المحطات التاريخية', 'Chronicle')}
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-ink-green-900">
              {tx('مسيرة عقدين من البناء والعطاء', 'Milestones in Institutional Growth')}
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
                    {item.title}
                  </h3>
                  <p className="text-xs text-ink-text-secondary leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 6. Admissions and contact links */}
      <section className="w-full py-20 border-b border-sand-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-[14px] bg-ink-green-900 p-8 text-center text-paper-white shadow-manuscript-md sm:p-12">
            <h2 className="font-serif text-2xl font-semibold sm:text-3xl">{tx('تواصل معنا أو استفسر عن القبول', 'Ask about admissions or contact the college')}</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-dark-text-primary/80">{tx('للحصول على أحدث المعلومات حول الدراسة والقبول، تواصل مباشرة مع الكلية.', 'Contact the college for current information about study programs and admissions.')}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link to="/admissions" className="inline-flex h-11 items-center justify-center rounded-lg bg-[#e77835] px-5 text-sm font-semibold text-white hover:bg-[#ce6327]">{tx('معلومات القبول', 'Admissions information')}</Link>
              <Link to="/contact" className="inline-flex h-11 items-center justify-center rounded-lg border border-white/30 px-5 text-sm font-semibold text-white hover:bg-white/10">{tx('تواصل معنا', 'Contact us')}</Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
