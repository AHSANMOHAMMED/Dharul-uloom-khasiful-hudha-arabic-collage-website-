import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getNewsById, listNews, resolveContentUrl } from '../lib/contentApi';
import { localized } from '../lib/localized';
import { tx } from '../lib/tx';

export default function NewsDetail() {
  const { id } = useParams();
  const { i18n } = useTranslation();
  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = await getNewsById(id);
        if (!active) return;
        if (!data) {
          // If not in database, check fallback
          setNotFound(true);
        } else {
          setArticle(data);
          const all = await listNews();
          if (active && all) {
            setRelated(all.filter((item) => String(item._id || item.id) !== String(id)).slice(0, 3));
          }
        }
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-parchment-50 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-ink-text-muted">{tx('جاري تحميل الخبر...', 'Loading dispatch...')}</p>
        </div>
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="min-h-screen bg-parchment-50 flex flex-col items-center justify-center p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-ink-text-muted mb-2">{'article'}</span>
        <h2 className="font-serif text-2xl font-semibold text-ink-green-900 mb-2">
          {tx('الخبر غير متوفر', 'Article Not Found')}
        </h2>
        <p className="text-xs text-ink-text-secondary mb-6">
          {tx('ربما تمت أرشفة الخبر أو النشرة المطلوبة.', 'The requested dispatch or bulletin may have been archived.')}
        </p>
        <Link
          to="/news"
          className="px-5 py-2.5 rounded-[10px] bg-emerald-700 text-white text-xs font-semibold shadow-xs"
        >
          {tx('العودة لجميع الأخبار', 'Return to News Index')}
        </Link>
      </div>
    );
  }

  const locale = { ar: 'ar-SA', ta: 'ta-LK' }[i18n.language] || 'en-GB';
  const formatDate = (d) => (d ? new Date(d).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }) : '');
  const arrowIcon = i18n.dir() === 'rtl' ? 'arrow_back' : 'arrow_forward';
  const backIcon = i18n.dir() === 'rtl' ? 'arrow_forward' : 'arrow_back';
  const title = localized(article.title) || tx('إعلان رسمي', 'Institutional Announcement');
  const content = localized(article.content) || '';
  const date = article.date_hijri || formatDate(article.date) || tx('حديثاً', 'Recent');
  const category = localized(article.category) || tx('نشرة الكلية', 'Collegiate Dispatch');
  const heroImage = article.imageUrl || (article.image && resolveContentUrl(article.image));

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen">
      
      {/* 1. Campus header with breadcrumb */}
      <section className="relative w-full overflow-hidden border-b border-sand-border bg-ink-green-900 py-10 text-paper-white">
        <img src="/images/campus/building.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-ink-green-900/85" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-[720px] px-4 sm:px-6">
          <nav className="mb-6 flex items-center gap-2 text-xs text-dark-text-primary/70" aria-label={tx('مسار التنقل', 'Breadcrumb')}>
            <Link to="/" className="transition-colors hover:text-gold-wash-100">{tx('الرئيسية', 'Home')}</Link>
            <span>/</span>
            <Link to="/news" className="transition-colors hover:text-gold-wash-100">{tx('الأخبار', 'News')}</Link>
            <span>/</span>
            <span className="truncate font-semibold text-brass-gold-500">{tx('الخبر', 'Dispatch')}</span>
          </nav>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-paper-white/10 px-2.5 py-0.5 text-xs font-semibold text-brass-gold-500">
              {category}
            </span>
            <span className="text-xs text-dark-text-primary/70">{date}</span>
          </div>

          <h1 className="mb-4 font-serif text-2xl font-semibold leading-tight tracking-tight text-paper-white sm:text-4xl">
            {title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 border-t border-sand-border/30 pt-3 text-xs text-dark-text-primary/80">
            <span className="font-semibold text-paper-white">{tx('مكتب التحرير بكاشف الهدى', 'Kashiful Hudha Editorial Office')}</span>
            <span>·</span>
            <span>{tx('مدلپلّي، كالبيتيا', 'Mudalippalli, Kalpitiya')}</span>
          </div>
        </div>
      </section>

      {/* 2. Narrow 720px Editorial Reading Column */}
      <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-12 space-y-8 font-sans">
        
        {/* Hero Image if available */}
        {heroImage && (
          <div className="rounded-[14px] overflow-hidden border border-sand-border bg-paper-white shadow-manuscript">
            <img
              src={heroImage}
              alt={title}
              className="w-full h-auto max-h-[420px] object-cover"
            />
          </div>
        )}

        {/* Pull Quote */}
        <div className="p-6 rounded-[14px] bg-paper-white border-l-4 border-l-brass-gold-500 border border-sand-border shadow-manuscript">
          <p className="font-serif italic text-base text-ink-green-900 leading-relaxed">
            {tx('«إن المحافظة على الأمانة العلمية وربط الأجيال بأصول الشريعة هو الأساس الراسخ الذي قامت عليه الكلية منذ تأسيسها.»', '"Preserving scholastic transmission and anchoring future generations in orthodox scripture remains the enduring bedrock of this collegiate assembly."')}
          </p>
        </div>

        {/* Article Body Content */}
        <article className="prose max-w-none text-ink-text-primary text-sm sm:text-base leading-relaxed space-y-4">
          {content.split('\n\n').map((paragraph, idx) => (
            <p key={idx} className="leading-relaxed">
              {paragraph}
            </p>
          ))}
        </article>

        {/* Share & Meta Bar */}
        <div className="pt-8 border-t border-sand-border flex items-center justify-between text-xs text-ink-text-muted">
          <Link to="/news" className="inline-flex items-center text-emerald-700 font-semibold gap-1">
            <span className="material-symbols-outlined text-[16px]">
              {backIcon}
            </span>
            <span>{tx('العودة إلى جميع النشرات', 'Back to all bulletins')}</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                alert(tx('تم نسخ رابط الخبر', 'Article URL copied to clipboard'));
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sand-border hover:bg-paper-white text-ink-text-secondary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">{'share'}</span>
            <span>{tx('نسخ الرابط', 'Copy Link')}</span>
          </button>
        </div>

      </main>

      {/* 3. Related News Row */}
      {related.length > 0 && (
        <section className="w-full py-16 bg-parchment-50/60 border-t border-sand-border">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
            <h3 className="font-serif text-xl font-semibold text-ink-green-900 mb-6">
              {tx('نشرات ذات صلة', 'Related Institutional Bulletins')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.map((item) => (
                <div key={item._id || item.id} className="p-6 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
                  <span className="text-[11px] font-semibold text-brass-gold-500 block mb-1">
                    {item.date_hijri || formatDate(item.date)}
                  </span>
                  <h4 className="font-serif text-base font-semibold text-ink-green-900 mb-2 leading-snug">
                    <Link to={`/news/${item._id || item.id}`} className="hover:text-emerald-700">
                      {localized(item.title)}
                    </Link>
                  </h4>
                  <Link to={`/news/${item._id || item.id}`} className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1 mt-2">
                    <span>{tx('قراءة الخبر', 'Read dispatch')}</span>
                    <span className="material-symbols-outlined text-[14px]">
                      {arrowIcon}
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
