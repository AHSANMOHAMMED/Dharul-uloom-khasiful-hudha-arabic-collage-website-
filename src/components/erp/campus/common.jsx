import { useMemo, useState } from 'react';
import { DialogHeader, Input, Select, useEscapeToClose, useLang } from '../ui';
import { classOptions, studentLabel } from '../../../lib/erp/campusApi';

/** Wider modal / drawer for detail views (ui.jsx Modal is max-w-lg). */
export function WideModal({ open, title, onClose, children, footer }) {
  useEscapeToClose(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-green-900/50 backdrop-blur-xs p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="w-full max-w-4xl my-8 rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript-lg p-6 space-y-4">
        <DialogHeader title={title} onClose={onClose} />
        {children}
        {footer && <div className="flex flex-wrap justify-end gap-2 pt-2">{footer}</div>}
      </div>
    </div>
  );
}

/** Student dropdown with a quick search box. */
export function StudentPicker({ students = [], value, onChange, placeholder }) {
  const { t } = useLang();
  const [q, setQ] = useState('');
  const options = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return students
      .filter(
        (s) =>
          !needle ||
          s.id === value ||
          (s.full_name || '').toLowerCase().includes(needle) ||
          (s.index_number || '').toLowerCase().includes(needle)
      )
      .slice(0, 300)
      .map((s) => ({ value: s.id, label: studentLabel(s) }));
  }, [students, q, value]);
  return (
    <div className="space-y-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search name or index…', 'ابحث بالاسم أو الرقم…')} />
      <Select value={value || ''} onChange={(e) => onChange(e.target.value)} options={options} placeholder={placeholder ?? t('Select student', 'اختر الطالب')} />
    </div>
  );
}

export function ClassSelect({ value, onChange, allLabel, ...rest }) {
  const { t } = useLang();
  return (
    <Select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      options={classOptions(t)}
      placeholder={allLabel}
      {...rest}
    />
  );
}

export function KeyValue({ items }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-sand-border py-1">
          <dt className="text-ink-text-secondary">{k}</dt>
          <dd className="text-ink-text-primary text-end">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Simple multi-select chip toggles. options: [{ value, label }] */
export function ChipMultiSelect({ options, value = [], onChange, disabled }) {
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => toggle(o.value)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition disabled:opacity-50 ${
              on ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-paper-white border-sand-border text-ink-text-secondary hover:border-emerald-700/50'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Checkbox({ checked, onChange, label, disabled }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-ink-text-primary cursor-pointer">
      <input
        type="checkbox"
        className="accent-emerald-700 h-4 w-4"
        checked={Boolean(checked)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
