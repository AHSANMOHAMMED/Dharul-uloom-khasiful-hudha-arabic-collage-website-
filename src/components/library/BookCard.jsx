import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tx } from '../../lib/tx';

const LANGUAGE_LABELS = {
  ar: { ar: 'عربي', en: 'Arabic' },
  ur: { ar: 'أردو', en: 'Urdu' },
  en: { ar: 'إنجليزي', en: 'English' },
  mixed: { ar: 'متعدد', en: 'Multilingual' },
};

export default function BookCard({ book }) {
  useTranslation(); // subscribe: re-render on language change
  const label = LANGUAGE_LABELS[book.language];
  const languageLabel = label ? tx(label.ar, label.en) : book.language;
  const primaryCategory = book.categories?.[0] || book.category || tx('عام', 'General');

  return (
    <article className="group flex flex-col justify-between rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript hover:border-emerald-700 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
      <Link to={`/library/${book.id}`} className="flex flex-col h-full">
        
        {/* Cover Canvas */}
        <div className="relative aspect-[3/4] bg-ink-green-900 overflow-hidden border-b border-sand-border/50">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title_ar || book.title_en}
              loading="lazy"
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex h-full w-full flex-col justify-between p-4 text-center bg-gradient-to-br from-ink-green-900 via-emerald-950 to-ink-green-900 text-paper-white relative">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-brass-gold-500 self-center">
                {tx('المكتبة الكاشفية', 'Maktabah Kashifiyyah')}
              </span>
              <div className="my-auto px-2">
                <span className="font-arabic text-sm sm:text-base font-bold leading-relaxed line-clamp-3 text-gold-wash-100" dir="rtl">
                  {book.title_ar || book.title_en}
                </span>
                {book.author && (
                  <span className="font-arabic text-xs text-dark-text-primary/75 mt-1 block line-clamp-1" dir="rtl">
                    {book.author}
                  </span>
                )}
              </div>
              <div className="w-8 h-px bg-brass-gold-500/40 self-center"></div>
            </div>
          )}

          {/* Badges on Cover */}
          {languageLabel && (
            <span className="absolute top-2 start-2 rounded-full bg-paper-white/90 text-ink-green-900 px-2 py-0.5 text-[10px] font-semibold border border-sand-border shadow-xs backdrop-blur-xs">
              {languageLabel}
            </span>
          )}
        </div>

        {/* Text Information */}
        <div className="flex flex-1 flex-col justify-between p-3.5 space-y-2">
          <div>
            <h3
              dir="rtl"
              className="font-arabic text-xs sm:text-sm font-bold text-ink-green-900 group-hover:text-emerald-700 transition-colors line-clamp-2 leading-snug"
            >
              {book.title_ar}
            </h3>
            {book.title_en && (
              <p className="text-[11px] text-ink-text-muted line-clamp-1 mt-0.5 font-sans">
                {book.title_en}
              </p>
            )}
            {book.author && (
              <p dir="rtl" className="font-arabic text-[11px] text-ink-text-secondary line-clamp-1 mt-1">
                {book.author}
              </p>
            )}
          </div>

          <div className="pt-2 border-t border-sand-border/50 flex items-center justify-between text-[10px] text-ink-text-muted">
            <span dir="auto" className="px-2 py-0.5 rounded-full bg-sand-border/40 text-ink-text-secondary font-medium">
              {primaryCategory}
            </span>
            <span className="text-emerald-700 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
              {tx('اقرأ', 'Read')} <span className="material-symbols-outlined text-[12px] rtl:rotate-180">{'chevron_right'}</span>
            </span>
          </div>
        </div>

      </Link>
    </article>
  );
}
