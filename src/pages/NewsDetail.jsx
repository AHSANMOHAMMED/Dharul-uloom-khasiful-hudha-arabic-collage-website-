import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getNewsById, listNews } from '../lib/contentApi';

export default function NewsDetail() {
  const { id } = useParams();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
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
            setRelated(all.filter((item) => String(item.id) !== String(id)).slice(0, 3));
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
          <p className="text-xs text-ink-text-muted">Loading dispatch...</p>
        </div>
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="min-h-screen bg-parchment-50 flex flex-col items-center justify-center p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-ink-text-muted mb-2">article</span>
        <h2 className="font-serif text-2xl font-semibold text-ink-green-900 mb-2">
          {isRTL ? 'الخبر غير متوفر' : 'Article Not Found'}
        </h2>
        <p className="text-xs text-ink-text-secondary mb-6">
          The requested dispatch or bulletin may have been archived.
        </p>
        <Link
          to="/news"
          className="px-5 py-2.5 rounded-[10px] bg-emerald-700 text-white text-xs font-semibold shadow-xs"
        >
          {isRTL ? 'العودة لجميع الأخبار' : 'Return to News Index'}
        </Link>
      </div>
    );
  }

  const title = article.title?.[isRTL ? 'ar' : 'en'] || article.title?.en || article.title || 'Institutional Announcement';
  const content = article.content?.[isRTL ? 'ar' : 'en'] || article.content?.en || article.content || '';
  const date = article.date_hijri || (article.date ? new Date(article.date).toLocaleDateString() : 'Recent');
  const category = article.category?.[isRTL ? 'ar' : 'en'] || article.category || 'Collegiate Dispatch';

  return (
    <div className="w-full bg-parchment-50 text-ink-text-primary min-h-screen">
      
      {/* 1. Header with Breadcrumb */}
      <section className="w-full bg-paper-white border-b border-sand-border py-8">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6">
          <nav className="flex items-center gap-2 text-xs text-ink-text-muted mb-6" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-emerald-700 transition-colors">Home</Link>
            <span>/</span>
            <Link to="/news" className="hover:text-emerald-700 transition-colors">News</Link>
            <span>/</span>
            <span className="text-ink-green-900 font-semibold truncate">Dispatch</span>
          </nav>

          <div className="flex items-center gap-2 mb-4">
            <span className="px-2.5 py-0.5 rounded-full bg-mint-wash-100 text-emerald-700 text-xs font-semibold">
              {category}
            </span>
            <span className="text-xs text-ink-text-muted">{date}</span>
          </div>

          <h1 className="font-serif text-2xl sm:text-4xl font-semibold text-ink-green-900 leading-tight mb-4">
            {title}
          </h1>

          <div className="flex items-center gap-3 pt-3 border-t border-sand-border text-xs text-ink-text-muted">
            <span className="font-semibold text-ink-text-primary">Kashiful Hudha Editorial Office</span>
            <span>·</span>
            <span>Mudalippalli, Kalpitiya</span>
          </div>
        </div>
      </section>

      {/* 2. Narrow 720px Editorial Reading Column */}
      <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-12 space-y-8 font-sans">
        
        {/* Hero Image if available */}
        {article.imageUrl && (
          <div className="rounded-[14px] overflow-hidden border border-sand-border bg-paper-white shadow-manuscript">
            <img
              src={article.imageUrl}
              alt={title}
              className="w-full h-auto max-h-[420px] object-cover"
            />
          </div>
        )}

        {/* Pull Quote */}
        <div className="p-6 rounded-[14px] bg-paper-white border-l-4 border-l-brass-gold-500 border border-sand-border shadow-manuscript">
          <p className="font-serif italic text-base text-ink-green-900 leading-relaxed">
            {isRTL
              ? '«إن المحافظة على الأمانة العلمية وربط الأجيال بأصول الشريعة هو الأساس الراسخ الذي قامت عليه الكلية منذ تأسيسها.»'
              : '"Preserving scholastic transmission and anchoring future generations in orthodox scripture remains the enduring bedrock of this collegiate assembly."'}
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
              {isRTL ? 'arrow_forward' : 'arrow_back'}
            </span>
            <span>Back to all bulletins</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                alert('Article URL copied to clipboard');
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sand-border hover:bg-paper-white text-ink-text-secondary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">share</span>
            <span>Copy Link</span>
          </button>
        </div>

      </main>

      {/* 3. Related News Row */}
      {related.length > 0 && (
        <section className="w-full py-16 bg-parchment-50/60 border-t border-sand-border">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
            <h3 className="font-serif text-xl font-semibold text-ink-green-900 mb-6">
              Related Institutional Bulletins
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.map((item) => (
                <div key={item.id} className="p-6 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript">
                  <span className="text-[11px] font-semibold text-brass-gold-500 block mb-1">
                    {item.date_hijri || item.date}
                  </span>
                  <h4 className="font-serif text-base font-semibold text-ink-green-900 mb-2 leading-snug">
                    <Link to={`/news/${item.id}`} className="hover:text-emerald-700">
                      {item.title?.[isRTL ? 'ar' : 'en'] || item.title?.en || item.title}
                    </Link>
                  </h4>
                  <Link to={`/news/${item.id}`} className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1 mt-2">
                    <span>Read dispatch</span>
                    <span className="material-symbols-outlined text-[14px]">
                      {isRTL ? 'arrow_back' : 'arrow_forward'}
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
