import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tx } from '../lib/tx';

export default function Home() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const arrow = i18n.dir() === 'rtl' ? 'arrow_back' : 'arrow_forward';
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
      title: tx('المكتبة الإسلامية', 'Islamic library'),
      description: tx('ابحث في فهرس المكتبة الرقمية.', 'Search the digital library catalogue.'),
      href: '/library',
      icon: 'local_library',
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

  function searchLibrary(event) {
    event.preventDefault();
    const term = query.trim();
    navigate(term ? `/library?q=${encodeURIComponent(term)}` : '/library');
  }

  return (
    <main className="bg-[#fbfaf6] text-[#17231e]">
      {/* Full-bleed campus hero */}
      <section className="relative isolate min-h-[min(88vh,720px)] overflow-hidden">
        <img
          src="/images/campus/building.jpg"
          alt={tx('مبنى كلية دار العلوم كاشف الهدى في مدلايبلي', 'Dharul Uloom Kashiful Hudha campus building in Mudalippalli')}
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
                'كلية عربية إسلامية في مدلايبلي، كالبيتيا — برامج دراسية، قبول، ومكتبة رقمية في منصة واحدة.',
                'An Arabic Islamic college in Mudalippalli, Kalpitiya — studies, admissions and a digital library in one place.'
              )}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/admissions"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#e77835] px-6 text-sm font-semibold text-white shadow-md transition hover:bg-[#ce6327] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {tx('التقديم للقبول', 'Apply for admission')}
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                  {arrow}
                </span>
              </Link>
              <Link
                to="/library"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/35 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {tx('تصفح المكتبة', 'Explore the library')}
              </Link>
            </div>
            <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-white/75">
              <span className="material-symbols-outlined text-[18px] text-[#e77835]">location_on</span>
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
                <span aria-hidden="true" className="material-symbols-outlined">
                  {item.icon}
                </span>
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
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-[17px] transition-transform group-hover:translate-x-1"
                >
                  {arrow}
                </span>
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

      {/* Library search */}
      <section className="mx-auto max-w-[1240px] px-5 py-14 sm:px-8 lg:px-10 lg:py-16">
        <div className="grid w-full min-w-0 gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-[#c36530]">{tx('المكتبة', 'The library')}</p>
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-[#173c2c]">
              {tx('ابحث في المكتبة الإسلامية', 'Search the Islamic library')}
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[#687168]">
              {tx('اكتب عنوان كتاب أو اسم مؤلف للعثور على المواد المتاحة في الفهرس.', 'Search by book title or author to find available catalogue entries.')}
            </p>
          </div>
          <form
            onSubmit={searchLibrary}
            className="flex min-h-14 min-w-0 items-center gap-2 rounded-xl border border-[#ded8cc] bg-white p-2 shadow-sm focus-within:border-[#78947c] focus-within:ring-2 focus-within:ring-[#315c43]/15"
          >
            <span aria-hidden="true" className="material-symbols-outlined px-2 text-[#748077]">
              search
            </span>
            <label className="sr-only" htmlFor="home-library-search">
              {tx('البحث في المكتبة', 'Search the library')}
            </label>
            <input
              id="home-library-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tx('عنوان الكتاب أو اسم المؤلف', 'Book title or author')}
              className="min-w-0 flex-1 bg-transparent text-sm text-[#17231e] outline-none placeholder:text-[#8b928a]"
            />
            <button
              type="submit"
              className="min-h-10 rounded-lg bg-[#234a35] px-4 text-sm font-semibold text-white transition hover:bg-[#173c2c]"
            >
              {tx('بحث', 'Search')}
            </button>
          </form>
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
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
              {arrow}
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
