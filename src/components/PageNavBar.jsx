import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useHistoryNav } from '../lib/useHistoryNav';
import { tx } from '../lib/tx';

/**
 * Back / Forward / Home + breadcrumb shown at the top of every workspace page.
 *
 * crumbs: [{ label, to?, onClick? }] — the last crumb is the current page.
 * home:   { label, to?, onClick? } — where "Home" goes (the portal overview).
 * When there is no in-app history (opened from a link or a new tab), Back
 * falls back to `home` so the button always does something useful.
 */
export default function PageNavBar({ crumbs = [], home, className = '' }) {
  useTranslation();
  const { canBack, canForward, back, forward } = useHistoryNav();
  const goHome = () => {
    if (home?.onClick) home.onClick();
  };
  const atHome = crumbs.length <= 1;
  const onBack = () => {
    if (canBack) back();
    else goHome();
  };
  const backDisabled = !canBack && (atHome || !home);

  const btn =
    'inline-flex items-center justify-center w-9 h-9 rounded-[10px] border border-sand-border bg-paper-white text-ink-green-900 hover:bg-mint-wash-100 disabled:opacity-40 disabled:hover:bg-paper-white transition';

  return (
    <nav aria-label={tx('التنقل', 'Page navigation')} className={`flex items-center gap-2 min-w-0 ${className}`}>
      <button type="button" onClick={onBack} disabled={backDisabled} className={btn} aria-label={tx('رجوع', 'Back')} title={tx('رجوع', 'Back')}>
        <svg className="w-4 h-4 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>
      <button type="button" onClick={forward} disabled={!canForward} className={btn} aria-label={tx('تقدم', 'Forward')} title={tx('تقدم', 'Forward')}>
        <svg className="w-4 h-4 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
      {home && (
        home.to ? (
          <Link to={home.to} className={btn} aria-label={home.label || tx('الرئيسية', 'Home')} title={home.label || tx('الرئيسية', 'Home')}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </Link>
        ) : (
          <button type="button" onClick={goHome} disabled={atHome} className={btn} aria-label={home.label || tx('الرئيسية', 'Home')} title={home.label || tx('الرئيسية', 'Home')}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </button>
        )
      )}
      {crumbs.length > 0 && (
        <ol className="flex items-center gap-1 min-w-0 text-xs sm:text-sm text-ink-text-secondary overflow-hidden">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={`${c.label}-${i}`} className={`flex items-center gap-1 min-w-0 ${last ? '' : 'hidden sm:flex'}`}>
                {i > 0 && (
                  <svg className="w-3.5 h-3.5 text-ink-text-muted rtl:rotate-180 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
                {last ? (
                  <span aria-current="page" className="font-semibold text-ink-green-900 truncate">{c.label}</span>
                ) : c.to ? (
                  <Link to={c.to} className="hover:text-emerald-700 hover:underline truncate">{c.label}</Link>
                ) : (
                  <button type="button" onClick={c.onClick} className="hover:text-emerald-700 hover:underline truncate">{c.label}</button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
