/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toTamil } from '../../lib/tx';

/**
 * Shared ERP UI kit (dark portal theme used by the role dashboards).
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
    <section className={`glass-card rounded-2xl p-5 border border-gray-800 ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          {title && <h3 className="text-lg font-bold text-white">{title}</h3>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone = 'emerald' }) {
  const tones = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    blue: 'text-sky-400',
    gray: 'text-gray-300',
  };
  return (
    <div className="glass-card rounded-2xl p-4 border border-gray-800">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`text-2xl font-extrabold mt-1 ${tones[tone] || tones.emerald}`}>{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}

export function Button({ variant = 'primary', size = 'md', className = '', ...props }) {
  const variants = {
    primary: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    secondary: 'bg-gray-800 hover:bg-gray-700 text-gray-100 border border-gray-700',
    danger: 'bg-red-700 hover:bg-red-600 text-white',
    ghost: 'bg-transparent hover:bg-gray-800 text-gray-300',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
  return (
    <button
      type="button"
      className={`rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block text-sm">
      <span className="block text-gray-400 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl bg-gray-900 border border-gray-700 px-3 py-2 text-gray-100 focus:outline-none focus:border-emerald-500';

export function Input(props) {
  return <input className={inputCls} {...props} />;
}

export function Textarea(props) {
  return <textarea className={inputCls} rows={3} {...props} />;
}

export function Select({ options = [], placeholder, ...props }) {
  return (
    <select className={inputCls} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Badge({ children, tone = 'gray' }) {
  const tones = {
    gray: 'bg-gray-800 text-gray-300',
    green: 'bg-emerald-900/60 text-emerald-300',
    amber: 'bg-amber-900/60 text-amber-300',
    red: 'bg-red-900/60 text-red-300',
    blue: 'bg-sky-900/60 text-sky-300',
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
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-900/80 text-gray-400">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-3 py-2 text-start font-semibold whitespace-nowrap ${c.className || ''}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {rows.map((r, i) => (
            <tr key={r[rowKey] ?? i} className="hover:bg-gray-900/50">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 text-gray-200 align-top ${c.className || ''}`}>
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
  return <div className="text-center text-gray-500 py-8 text-sm">{text}</div>;
}

export function Loading() {
  return (
    <div className="flex justify-center py-10">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500" />
    </div>
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return <div className="rounded-xl bg-red-950/60 border border-red-800 text-red-200 px-4 py-3 text-sm">{error.message || String(error)}</div>;
}

/** Renders loading / error / children(data) for a useAsync state. */
export function AsyncView({ state, children }) {
  if (state.loading && !state.data) return <Loading />;
  if (state.error) return <ErrorNote error={state.error} />;
  return children(state.data);
}

export function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-gray-950 border border-gray-800 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white flex items-center justify-center" aria-label="Close">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
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
            active === tab.id ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h2 className="text-2xl font-extrabold text-white">{title}</h2>
        {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
