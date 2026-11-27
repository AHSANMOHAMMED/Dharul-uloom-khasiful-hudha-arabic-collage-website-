/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toTamil } from '../../lib/tx';
import { useErpEmbedded } from '../../context/ErpEmbedContext';
import Icon from '../Icon';
export { Icon };

/**
 * Shared ERP UI kit — Modern Manuscript light theme (parchment canvas, white
 * paper cards, sand borders, ink-green text, emerald actions).
 * Every ERP module should compose these instead of ad-hoc markup so the
 * workspace stays visually consistent and RTL-safe (logical spacing only).
 */

export function useLang() {
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const ar = lang === 'ar';
  const ta = lang === 'ta';
  /** t('English', 'العربية') — Tamil comes from src/locales/ta.json (keyed by the English text). */
  const t = useCallback(
    (en, arText) => (ar && arText ? arText : ta ? toTamil(en) : en),
    [ar, ta],
  );
  return { ar, ta, lang, t };
}

/** Load async data with loading/error state; returns [state, reload]. */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    run();
  }, [run]);
  return [state, run];
}

export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`rounded-2xl bg-paper-white dark:bg-dark-surface p-5 border border-slate-200 dark:border-dark-border shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          {title && <h3 className="text-base font-sans font-semibold text-slate-900 dark:text-dark-text-primary text-pretty">{title}</h3>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = 'emerald', icon = null, badge = null, badgeTone = null, onClick = null, className = '' }) {
  const tones = {
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-feedback-danger',
    blue: 'text-feedback-info',
    gray: 'text-ink-text-primary',
  };
  const iconTones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
    amber: 'bg-amber-50 text-amber-700 border-amber-200/70',
    red: 'bg-red-50 text-red-700 border-red-200/70',
    blue: 'bg-sky-50 text-sky-700 border-sky-200/70',
    gray: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  const badgeTones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    amber: 'bg-amber-50 text-amber-700 border-amber-200/80',
    red: 'bg-rose-50 text-rose-700 border-rose-200/80',
    blue: 'bg-sky-50 text-sky-700 border-sky-200/80',
    gray: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick || undefined}
      className={`h-full w-full text-start flex flex-col justify-between rounded-2xl bg-white dark:bg-dark-surface p-4 sm:p-5 border border-slate-200 dark:border-dark-border shadow-sm ${
        onClick ? 'cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3 w-full">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 leading-snug">{label}</div>
          <div className={`text-xl sm:text-2xl font-bold mt-1.5 tracking-tight tabular-nums ${tones[tone] || tones.emerald}`}>{value}</div>
        </div>
        {icon && (
          <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${iconTones[tone] || iconTones.emerald}`}>
            <Icon name={icon} className="text-[20px]" />
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mt-2.5 min-h-[1rem] w-full">
        <span className="truncate">{hint || '\u00A0'}</span>
        {badge && (
          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeTones[badgeTone || tone] || badgeTones.emerald}`}>
            {badge}
          </span>
        )}
      </div>
    </Tag>
  );
}

export function Button({ variant = 'primary', size = 'md', className = '', ...props }) {
  const variants = {
    primary: 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-xs',
    secondary: 'bg-paper-white hover:bg-parchment-50 text-ink-green-900 border border-sand-border shadow-xs',
    danger: 'bg-feedback-danger hover:bg-red-700 text-white',
    ghost: 'bg-transparent hover:bg-mint-wash-100 text-emerald-700',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
  return (
    <button
      type="button"
      className={`rounded-[10px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block text-sm">
      <span className="block text-ink-text-secondary font-medium mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-text-muted mt-1">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-[10px] bg-paper-white border border-sand-border px-3 py-2 text-ink-text-primary placeholder:text-ink-text-muted focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 disabled:bg-parchment-50 disabled:text-ink-text-secondary';

export function Input(props) {
  return <input className={inputCls} {...props} />;
}

export function Textarea(props) {
  return <textarea className={inputCls} rows={3} {...props} />;
}

export function Select({ options = [], placeholder, children, ...props }) {
  return (
    <select className={inputCls} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {children || options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Badge({ children, tone = 'gray' }) {
  const tones = {
    gray: 'bg-parchment-50 text-ink-text-secondary border border-sand-border',
    green: 'bg-mint-wash-100 text-emerald-700 border border-emerald-700/20',
    amber: 'bg-gold-wash-100 text-amber-800 border border-brass-gold-500/30',
    red: 'bg-red-50 text-feedback-danger border border-feedback-danger/20',
    blue: 'bg-sky-50 text-feedback-info border border-feedback-info/20',
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone] || tones.gray}`}>{children}</span>;
}

/** Map common workflow statuses to badge tones. */
export function StatusBadge({ status }) {
  const tone =
    {
      paid: 'green', completed: 'green', approved: 'green', posted: 'green', active: 'green', issued: 'green', published: 'green', resolved: 'green', present: 'green',
      partial: 'amber', pending: 'amber', submitted: 'amber', draft: 'amber', open: 'amber', marking: 'amber', in_progress: 'amber', late: 'amber',
      unpaid: 'red', rejected: 'red', cancelled: 'red', reversed: 'red', revoked: 'red', void: 'red', absent: 'red', suspended: 'red',
    }[status] || 'gray';
  return <Badge tone={tone}>{String(status ?? '—').replace(/_/g, ' ')}</Badge>;
}

/**
 * columns: [{ key, label, render?(row), className? }]
 */
export function Table({ columns, rows, empty = 'No records', rowKey = 'id' }) {
  if (!rows?.length) return <EmptyState text={empty} />;
  return (
    <div className="overflow-x-auto rounded-[12px] border border-sand-border bg-paper-white">
      <table className="min-w-full text-sm">
        <thead className="bg-parchment-50 text-ink-text-secondary border-b border-sand-border">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-3 py-2 text-start font-semibold whitespace-nowrap ${c.className || ''}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-sand-border">
          {rows.map((r, i) => (
            <tr key={r[rowKey] ?? i} className="hover:bg-parchment-50/70">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 text-ink-text-primary align-top ${c.className || ''}`}>
                  {c.render ? c.render(r) : r[c.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({ text = 'Nothing here yet' }) {
  return <div className="text-center text-ink-text-muted py-8 text-sm">{text}</div>;
}

export function Loading() {
  return (
    <div className="flex justify-center py-10">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-700 border-t-transparent" />
    </div>
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return <div role="alert" className="rounded-[10px] bg-red-50 border border-feedback-danger/30 text-feedback-danger px-4 py-3 text-sm">{error.message || String(error)}</div>;
}

/** Renders loading / error / children(data) for a useAsync state. */
export function AsyncView({ state, children }) {
  if (state.loading && !state.data) return <Loading />;
  if (state.error) return <ErrorNote error={state.error} />;
  return children(state.data);
}

/** Close a dialog with the Escape key while it is open. */
export function useEscapeToClose(open, onClose) {
  useEffect(() => {
    if (!open || !onClose) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}

/** Dialog title row: a labelled Back button (closes) + title + close icon. */
export function DialogHeader({ title, onClose }) {
  const { t } = useLang();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-[10px] border border-sand-border text-xs font-semibold text-ink-green-900 hover:bg-mint-wash-100 shrink-0"
          aria-label={t('Back', 'رجوع')}
        >
          <Icon name="arrow_back" className="text-[16px] rtl:rotate-180" />
          {t('Back', 'رجوع')}
        </button>
        <h3 className="text-lg font-serif font-semibold text-ink-green-900 truncate">{title}</h3>
      </div>
      <button type="button" onClick={onClose} className="text-ink-text-muted hover:text-ink-green-900 flex items-center justify-center" aria-label={t('Close', 'إغلاق')}>
        <Icon name="close" className="text-[18px]" />
      </button>
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer }) {
  useEscapeToClose(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-green-900/50 backdrop-blur-xs p-4" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto overscroll-contain rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript-lg p-6 space-y-4">
        <DialogHeader title={title} onClose={onClose} />
        {children}
        {footer && <div className="flex justify-end gap-2 pt-2">{footer}</div>}
      </div>
    </div>
  );
}

/** Simple horizontal tab strip. tabs: [{ id, label }] */
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            active === tab.id ? 'bg-emerald-700 text-white shadow-xs' : 'bg-paper-white text-ink-text-secondary hover:text-ink-green-900 border border-sand-border'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  const embedded = useErpEmbedded();
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 erp-page-header ${embedded ? 'mb-4' : 'mb-6'}`}>
      <div className="min-w-0">
        <h2 className={`${embedded ? 'text-lg' : 'text-xl sm:text-2xl'} font-sans font-semibold text-slate-900 text-balance`}>{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-1 max-w-3xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
