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
        <span className="material-symbols-outlined text-[20px] rtl:rotate-180" aria-hidden>{'arrow_back'}</span>
      </button>
      <button type="button" onClick={forward} disabled={!canForward} className={btn} aria-label={tx('تقدم', 'Forward')} title={tx('تقدم', 'Forward')}>
        <span className="material-symbols-outlined text-[20px] rtl:rotate-180" aria-hidden>{'arrow_forward'}</span>
      </button>
      {home && (
        home.to ? (
          <Link to={home.to} className={btn} aria-label={home.label || tx('الرئيسية', 'Home')} title={home.label || tx('الرئيسية', 'Home')}>
            <span className="material-symbols-outlined text-[20px]" aria-hidden>{'home'}</span>
          </Link>
        ) : (
          <button type="button" onClick={goHome} disabled={atHome} className={btn} aria-label={home.label || tx('الرئيسية', 'Home')} title={home.label || tx('الرئيسية', 'Home')}>
            <span className="material-symbols-outlined text-[20px]" aria-hidden>{'home'}</span>
          </button>
        )
      )}
      {crumbs.length > 0 && (
        <ol className="flex items-center gap-1 min-w-0 text-xs sm:text-sm text-ink-text-secondary overflow-hidden">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={`${c.label}-${i}`} className={`flex items-center gap-1 min-w-0 ${last ? '' : 'hidden sm:flex'}`}>
                {i > 0 && <span className="material-symbols-outlined text-[16px] text-ink-text-muted rtl:rotate-180" aria-hidden>{'chevron_right'}</span>}
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
