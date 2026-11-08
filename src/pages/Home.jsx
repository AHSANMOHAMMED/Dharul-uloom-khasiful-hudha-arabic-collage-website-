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
      description: tx('معلومات التقديم وخطوات التسجيل للطلاب الجدد.', 'Information for families interested in applying and joining the college.'),
      href: '/admissions',
      icon: 'edit_document',
      tone: 'orange'
    },
    {
      title: tx('الدراسة والمناهج', 'Study & curriculum'),
      description: tx('تعرف على المواد الدراسية والمراحل التعليمية.', 'Explore the subjects and learning pathways offered by the college.'),
      href: '/curriculum',
      icon: 'menu_book',
      tone: 'green'
    },
    {
      title: tx('المكتبة الإسلامية', 'Islamic library'),
      description: tx('ابحث في فهرس المكتبة الرقمية.', 'Search the college’s digital library catalogue.'),
      href: '/library',
      icon: 'local_library',
      tone: 'blue'
    },
    {
      title: tx('عن الكلية', 'About the college'),
      description: tx('تعرف على دار العلوم كاشف الهدى وموقعها ورسالتها.', 'Learn about Dharul Uloom Kashiful Hudha and its work.'),
      href: '/about',
      icon: 'account_balance',
      tone: 'gold'
    }
  ];

  function searchLibrary(event) {
    event.preventDefault();
    const term = query.trim();
    navigate(term ? `/library?q=${encodeURIComponent(term)}` : '/library');
  }

  return (
    <main className="bg-[#fbfaf6] text-[#17231e]">
      <section className="relative isolate overflow-hidden border-b border-[#e8e2d7] bg-[#f4f1e9]">
        <div aria-hidden="true" className="absolute -right-24 -top-40 -z-10 h-[34rem] w-[34rem] rounded-full border border-[#dce4d5]" />
        <div aria-hidden="true" className="absolute -right-10 -top-24 -z-10 h-[26rem] w-[26rem] rounded-full border border-[#e4d9c8]" />
        <div className="mx-auto grid min-h-[540px] max-w-[1240px] items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:gap-16 lg:px-10 lg:py-20">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e2d6c4] bg-white/75 px-3.5 py-2 text-xs font-semibold tracking-wide text-[#536156]">
              <span className="h-2 w-2 rounded-full bg-[#e77835]" />
              {tx('مدلايبالي · كالبيتيا · سريلانكا', 'Mudalippalli · Kalpitiya · Sri Lanka')}
            </div>
            <p className="mb-3 font-arabic text-xl text-[#315c43]" dir="rtl">دار العلوم كاشف الهدى</p>
            <h1 className="max-w-xl font-serif text-4xl font-semibold leading-[1.12] tracking-tight text-[#173c2c] sm:text-5xl lg:text-[3.65rem]">
              {tx('العلمُ هدايةٌ ونور', 'A place to learn, grow and serve')}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#59645c] sm:text-lg sm:leading-8">
              {tx('دار العلوم كاشف الهدى كلية عربية إسلامية في مُدلايبالي، كالبيتيا. اكتشف برامج الدراسة، ومعلومات القبول، وموارد المكتبة.', 'Dharul Uloom Kashiful Hudha is an Arabic college in Mudalippalli, Kalpitiya. Explore study information, admissions and the college library.')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/admissions" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#e77835] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#ce6327] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173c2c]">
                {tx('معلومات القبول', 'Admissions information')}
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{arrow}</span>
              </Link>
              <Link to="/curriculum" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#cbd4ca] bg-white/75 px-5 text-sm font-semibold text-[#234a35] transition hover:border-[#315c43] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173c2c]">
                {tx('استكشف الدراسة', 'Explore studies')}
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{arrow}</span>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#667169]">
              <span className="inline-flex items-center gap-2"><span className="material-symbols-outlined text-[18px] text-[#315c43]">location_on</span>{tx('مُدلايبالي، كالبيتيا', 'Mudalippalli, Kalpitiya')}</span>
              <span className="hidden h-4 w-px bg-[#d4d8cf] sm:block" />
              <Link to="/contact" className="font-medium text-[#315c43] underline-offset-4 hover:underline">{tx('تواصل مع الكلية', 'Contact the college')}</Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[470px]">
            <div className="absolute -inset-3 rotate-2 rounded-[2rem] bg-[#dce5d9]" aria-hidden="true" />
            <div className="relative flex min-h-[380px] flex-col items-center justify-center overflow-hidden rounded-[1.7rem] border border-white/80 bg-[#fffefa] px-8 py-10 shadow-[0_24px_70px_rgba(35,57,42,0.12)] sm:min-h-[440px]">
              <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-[#e77835] via-[#f0c786] to-[#7ea66a]" aria-hidden="true" />
              <img src="/images/logo.svg" alt={tx('شعار دار العلوم كاشف الهدى', 'Dharul Uloom Kashiful Hudha college emblem')} className="w-[min(72%,300px)] drop-shadow-sm" />
              <p className="mt-5 text-center font-serif text-lg font-semibold text-[#234a35]">{tx('دار العلوم كاشف الهدى', 'Dharul Uloom Kashiful Hudha')}</p>
              <p className="mt-1 text-center text-sm text-[#747b73]">{tx('الكلية العربية الإسلامية · سريلانكا', 'Arabic College · Sri Lanka')}</p>
              <span className="absolute bottom-5 right-6 h-3 w-3 rounded-full bg-[#e77835]" aria-hidden="true" />
              <span className="absolute bottom-8 right-12 h-1.5 w-1.5 rounded-full bg-[#7ea66a]" aria-hidden="true" />
              <span className="absolute left-7 top-9 h-2 w-2 rounded-full bg-[#d8ad55]" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="find-way" className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-[#c36530]">{tx('اكتشف الكلية', 'Explore the college')}</p>
            <h2 id="find-way" className="font-serif text-3xl font-semibold tracking-tight text-[#173c2c] sm:text-4xl">{tx('كيف نساعدك؟', 'Find what you need')}</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[#687168]">{tx('اختر الموضوع الذي تبحث عنه للوصول مباشرة إلى المعلومات والخدمات.', 'Choose a topic to go directly to the information and services you need.')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {destinations.map((item) => (
            <Link key={item.href} to={item.href} className="group flex min-h-[205px] flex-col rounded-xl border border-[#e8e2d7] bg-white p-5 transition duration-200 hover:-translate-y-1 hover:border-[#bdcdbd] hover:shadow-[0_14px_35px_rgba(35,57,42,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315c43]">
              <span className={`mb-7 flex h-11 w-11 items-center justify-center rounded-lg ${item.tone === 'orange' ? 'bg-[#fff0e6] text-[#c36530]' : item.tone === 'blue' ? 'bg-[#edf2f4] text-[#426b7a]' : item.tone === 'gold' ? 'bg-[#f7f0dd] text-[#967535]' : 'bg-[#eaf1e9] text-[#315c43]'}`}>
                <span aria-hidden="true" className="material-symbols-outlined">{item.icon}</span>
              </span>
              <h3 className="font-serif text-lg font-semibold text-[#234a35]">{item.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-[#687168]">{item.description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#315c43]">{tx('اعرف المزيد', 'Explore')}<span aria-hidden="true" className="material-symbols-outlined text-[17px] transition-transform group-hover:translate-x-1">{arrow}</span></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-[#e8e2d7] bg-[#f4f1e9]">
        <div className="mx-auto grid w-full min-w-0 max-w-[1240px] gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:px-10 lg:py-16">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-[#c36530]">{tx('المكتبة', 'The library')}</p>
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-[#173c2c]">{tx('ابحث في المكتبة الإسلامية', 'Search the Islamic library')}</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[#687168]">{tx('اكتب عنوان كتاب أو اسم مؤلف للعثور على المواد المتاحة في الفهرس.', 'Search by book title or author to find available catalogue entries.')}</p>
          </div>
          <form onSubmit={searchLibrary} className="flex min-h-14 min-w-0 items-center gap-2 rounded-xl border border-[#ded8cc] bg-white p-2 shadow-sm focus-within:border-[#78947c] focus-within:ring-2 focus-within:ring-[#315c43]/15">
            <span aria-hidden="true" className="material-symbols-outlined px-2 text-[#748077]">search</span>
            <label className="sr-only" htmlFor="home-library-search">{tx('البحث في المكتبة', 'Search the library')}</label>
            <input id="home-library-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tx('عنوان الكتاب أو اسم المؤلف', 'Book title or author')} className="min-w-0 flex-1 bg-transparent text-sm text-[#17231e] outline-none placeholder:text-[#8b928a]" />
            <button type="submit" className="min-h-10 rounded-lg bg-[#234a35] px-4 text-sm font-semibold text-white transition hover:bg-[#173c2c]">{tx('بحث', 'Search')}</button>
          </form>
        </div>
      </section>

      <section className="mx-auto flex max-w-[1240px] flex-col gap-5 px-5 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-[#173c2c]">{tx('بوابة الكلية', 'College portal')}</h2>
          <p className="mt-1 text-sm text-[#687168]">{tx('للوصول إلى الخدمات المخصصة للطلاب وأولياء الأمور والموظفين.', 'Access services for students, parents and college staff.')}</p>
        </div>
        <Link to="/login" className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg border border-[#cbd4ca] bg-white px-5 text-sm font-semibold text-[#234a35] transition hover:border-[#315c43] sm:self-auto">
          {tx('تسجيل الدخول', 'Sign in to the portal')}<span aria-hidden="true" className="material-symbols-outlined text-[18px]">{arrow}</span>
        </Link>
      </section>
    </main>
  );
}
