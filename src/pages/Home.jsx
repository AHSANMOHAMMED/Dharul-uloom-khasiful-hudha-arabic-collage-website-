import { Link } from 'react-router-dom';
import { tx } from '../lib/tx';

function ArrowIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={`${className} rtl:rotate-180 shrink-0`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function TileIcon({ name }) {
  if (name === 'edit_document') {
    return (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    );
  }
  if (name === 'menu_book') {
    return (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    );
  }
  if (name === 'newspaper') {
    return (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
        <path d="M18 14h-8" />
        <path d="M15 18h-5" />
        <path d="M10 6h8v4h-8V6Z" />
      </svg>
    );
  }
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="21" x2="21" y2="21" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <polyline points="5 6 12 3 19 6" />
      <line x1="4" y1="10" x2="4" y2="21" />
      <line x1="20" y1="10" x2="20" y2="21" />
      <line x1="8" y1="14" x2="8" y2="17" />
      <line x1="12" y1="14" x2="12" y2="17" />
      <line x1="16" y1="14" x2="16" y2="17" />
    </svg>
  );
}

export default function Home() {
  const destinations = [
    {
      title: tx('القبول والتسجيل', 'Admissions'),
      description: tx('معلومات التقديم وخطوات التسجيل للطلاب الجدد.', 'Apply and learn how new students join the college.'),
      href: '/admissions',
      icon: 'edit_document',
      tone: 'orange',
    },
    {
      title: tx('الدراسة والمناهج', 'Study & curriculum'),
      description: tx('تعرف على المواد الدراسية والمراحل التعليمية.', 'Explore subjects and learning pathways.'),
      href: '/curriculum',
      icon: 'menu_book',
      tone: 'green',
    },
    {
      title: tx('الأخبار والفعاليات', 'News & events'),
      description: tx('تابع آخر أخبار الكلية والفعاليات.', 'Follow the latest college news and events.'),
      href: '/news',
      icon: 'newspaper',
      tone: 'blue',
    },
    {
      title: tx('عن الكلية', 'About the college'),
      description: tx('تعرف على دار العلوم كاشف الهدى وموقعها ورسالتها.', 'Learn about Dharul Uloom Kashiful Hudha and its mission.'),
      href: '/about',
      icon: 'account_balance',
      tone: 'gold',
    },
  ];

  return (
    <main className="bg-[#fbfaf6] text-[#17231e]">
      {/* Full-bleed campus hero */}
      <section className="relative isolate min-h-[min(88vh,720px)] overflow-hidden">
        <img
          src="/images/campus/building.jpg"
          alt={tx('مبنى كلية دار العلوم كاشف الهدى في مدلايبلي', 'Dharul Uloom Kashiful Hudha campus building in Mudalippalli')}
          width="1600"
          height="900"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#0b3b2e]/92 via-[#0b3b2e]/72 to-[#0b3b2e]/35"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#0b3b2e]/80 via-transparent to-[#0b3b2e]/25"
        />

        <div className="relative mx-auto flex min-h-[min(88vh,720px)] max-w-[1240px] flex-col justify-end px-5 pb-14 pt-28 sm:px-8 lg:justify-center lg:px-10 lg:pb-20 lg:pt-24">
          <div className="max-w-2xl text-white">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-white/95 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-[#e77835]" />
              {tx('مدلايبلي · كالبيتيا · سريلانكا', 'Mudalippalli · Kalpitiya · Sri Lanka')}
            </div>
            <p className="mb-2 font-arabic text-2xl text-[#f0c786] sm:text-3xl" dir="rtl">
              دار العلوم كاشف الهدى
            </p>
            <h1 className="font-serif text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              {tx('العلمُ هدايةٌ ونور', 'Combine quality with morality')}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/85 sm:text-lg sm:leading-8">
              {tx(
                'كلية عربية إسلامية في مدلايبلي، كالبيتيا — برامج دراسية وقبول وبوابات للطلاب وأولياء الأمور في منصة واحدة.',
                'An Arabic Islamic college in Mudalippalli, Kalpitiya — studies, admissions, and student & parent portals in one place.'
              )}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/admissions"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#e77835] px-6 text-sm font-semibold text-white shadow-md transition hover:bg-[#ce6327] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {tx('التقديم للقبول', 'Apply for admission')}
                <ArrowIcon />
              </Link>
              <Link
                to="/login"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/35 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {tx('دخول البوابة', 'Portal sign-in')}
              </Link>
            </div>
            <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-white/75">
              <svg className="w-4 h-4 text-[#e77835] shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              {tx('موداليبالي، كالبيتيا، منطقة بوتلام', 'Mudalippalli, Kalpitiya, Puttalam District')}
            </p>
          </div>
        </div>
      </section>

      {/* IIU-style shortcut tiles */}
      <section aria-labelledby="find-way" className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-[#c36530]">
              {tx('اكتشف الكلية', 'Explore the college')}
            </p>
            <h2 id="find-way" className="font-serif text-3xl font-semibold tracking-tight text-[#173c2c] sm:text-4xl">
              {tx('كيف نساعدك؟', 'Find your way')}
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[#687168]">
            {tx(
              'اختر الموضوع الذي تبحث عنه للوصول مباشرة إلى المعلومات والخدمات.',
              'Choose a topic to go directly to the information and services you need.'
            )}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {destinations.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`group flex min-h-[200px] flex-col rounded-xl border p-5 transition duration-200 hover:-translate-y-1 hover:shadow-[0_14px_35px_rgba(35,57,42,0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315c43] ${
                item.tone === 'orange'
                  ? 'border-[#e77835]/40 bg-[#e77835] text-white hover:bg-[#ce6327]'
                  : 'border-[#e8e2d7] bg-white hover:border-[#bdcdbd]'
              }`}
            >
              <span
                className={`mb-7 flex h-11 w-11 items-center justify-center rounded-lg ${
                  item.tone === 'orange'
                    ? 'bg-white/20 text-white'
                    : item.tone === 'blue'
                      ? 'bg-[#edf2f4] text-[#426b7a]'
                      : item.tone === 'gold'
                        ? 'bg-[#f7f0dd] text-[#967535]'
                        : 'bg-[#eaf1e9] text-[#315c43]'
                }`}
              >
                <TileIcon name={item.icon} />
              </span>
              <h3 className={`font-serif text-lg font-semibold ${item.tone === 'orange' ? 'text-white' : 'text-[#234a35]'}`}>
                {item.title}
              </h3>
              <p className={`mt-2 flex-1 text-sm leading-6 ${item.tone === 'orange' ? 'text-white/90' : 'text-[#687168]'}`}>
                {item.description}
              </p>
              <span
                className={`mt-4 inline-flex items-center gap-1 text-sm font-semibold ${
                  item.tone === 'orange' ? 'text-white' : 'text-[#315c43]'
                }`}
              >
                {tx('اعرف المزيد', 'Explore')}
                <ArrowIcon className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Campus glimpse */}
      <section className="border-y border-[#e8e2d7] bg-[#f4f1e9]">
        <div className="mx-auto grid max-w-[1240px] gap-8 px-5 py-14 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-10 lg:py-16">
          <div className="overflow-hidden rounded-2xl border border-[#e8e2d7] shadow-sm">
            <img
              src="/images/campus/gate.jpg"
              alt={tx('بوابة كلية دار العلوم كاشف الهدى', 'Entrance gate of Dharul Uloom Kashiful Hudha')}
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-[#c36530]">
              {tx('الحرم الجامعي', 'Campus')}
            </p>
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-[#173c2c]">
              {tx('مدلايبلي، كالبيتيا', 'Mudalippalli, Kalpitiya')}
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#687168] sm:text-base">
              {tx(
                'كلية عربية إسلامية تخدم مجتمع الساحل، ببرامج الحفظ والعلوم الشرعية والعربية. زوروا معرض الصور أو تواصلوا معنا لزيارة الحرم.',
                'An Arabic Islamic college serving the coastal community — Hifz, Shariah and Arabic studies. Browse the gallery or contact us to visit campus.'
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/gallery"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#234a35] px-5 text-sm font-semibold text-white transition hover:bg-[#173c2c]"
              >
                {tx('معرض الصور', 'Photo gallery')}
              </Link>
              <Link
                to="/contact"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#cbd4ca] bg-white px-5 text-sm font-semibold text-[#234a35] transition hover:border-[#315c43]"
              >
                {tx('تواصل معنا', 'Contact us')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Portal strip */}
      <section className="border-t border-[#e8e2d7] bg-[#f4f1e9]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-5 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-[#173c2c]">{tx('بوابة الكلية', 'College portal')}</h2>
            <p className="mt-1 text-sm text-[#687168]">
              {tx('للوصول إلى الخدمات المخصصة للطلاب وأولياء الأمور والموظفين.', 'Access services for students, parents and college staff.')}
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg border border-[#cbd4ca] bg-white px-5 text-sm font-semibold text-[#234a35] transition hover:border-[#315c43] sm:self-auto"
          >
            {tx('تسجيل الدخول', 'Sign in to the portal')}
            <ArrowIcon />
          </Link>
        </div>
      </section>
    </main>
  );
}
