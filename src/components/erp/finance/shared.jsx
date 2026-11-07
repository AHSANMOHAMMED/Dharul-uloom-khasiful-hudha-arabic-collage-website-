import { useMemo, useState } from 'react';
import { Button, Field, Input, Modal, Select, Textarea, useAsync, useLang } from '../ui';
import { listEmployees, listStudents } from '../../../lib/erp/financeApi';

/**
 * Confirmation dialog for financial / destructive actions. When
 * `requireReason` is set the confirm button stays disabled until a reason is
 * typed. `onConfirm(reason)` may be async; the dialog closes when it resolves
 * truthy.
 */
export function ConfirmModal({
  open,
  title,
  message,
  requireReason = false,
  reasonLabel,
  confirmLabel,
  danger = true,
  onClose,
  onConfirm,
  children,
}) {
  const { t } = useLang();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setReason('');
    onClose();
  };

  const confirm = async () => {
    setBusy(true);
    const ok = await onConfirm(reason.trim());
    setBusy(false);
    if (ok) {
      setReason('');
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={confirm} disabled={busy || (requireReason && !reason.trim())}>
            {busy ? t('Working…', 'جارٍ التنفيذ…') : confirmLabel || t('Confirm', 'تأكيد')}
          </Button>
        </>
      }
    >
      {message && <p className="text-sm text-gray-300">{message}</p>}
      {children}
      {requireReason && (
        <Field label={reasonLabel || t('Reason (required)', 'السبب (مطلوب)')}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      )}
    </Modal>
  );
}

/** Searchable person picker backed by profiles (students or employees). */
function PersonPicker({ kind, value, onChange, label, allowEmpty = false, filter }) {
  const { t } = useLang();
  const [search, setSearch] = useState('');
  const [state] = useAsync(() => (kind === 'student' ? listStudents() : listEmployees()), [kind]);

  const options = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (state.data || [])
      .filter((p) => (filter ? filter(p) : true))
      .filter(
        (p) =>
          !s ||
          p.id === value ||
          (p.full_name || '').toLowerCase().includes(s) ||
          (p.index_number || '').toLowerCase().includes(s),
      )
      .slice(0, 300)
      .map((p) => ({
        value: p.id,
        label: `${p.full_name || '—'}${p.index_number ? ` (${p.index_number})` : ''}${
          kind === 'student' && p.class_number ? ` · ${t('Class', 'الصف')} ${p.class_number}` : ''
        }`,
      }));
  }, [state.data, search, value, filter, kind, t]);

  return (
    <Field label={label} hint={state.error ? state.error.message : undefined}>
      <div className="space-y-2">
        <Input
          placeholder={t('Search by name or index…', 'ابحث بالاسم أو الرقم…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={value || ''}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={state.loading ? t('Loading…', 'جارٍ التحميل…') : allowEmpty ? t('— None —', '— لا شيء —') : t('Select…', 'اختر…')}
          options={options}
        />
      </div>
    </Field>
  );
}

export function StudentPicker(props) {
  const { t } = useLang();
  return <PersonPicker {...props} kind="student" label={props.label || t('Student', 'الطالب')} />;
}

export function EmployeePicker(props) {
  const { t } = useLang();
  return <PersonPicker {...props} kind="employee" label={props.label || t('Employee', 'الموظف')} />;
}

/** From / to date inputs in a row. */
export function DateRange({ from, to, onChange, fromLabel, toLabel }) {
  const { t } = useLang();
  return (
    <>
      <Field label={fromLabel || t('From', 'من')}>
        <Input type="date" value={from || ''} onChange={(e) => onChange({ from: e.target.value, to })} />
      </Field>
      <Field label={toLabel || t('To', 'إلى')}>
        <Input type="date" value={to || ''} onChange={(e) => onChange({ from, to: e.target.value })} />
      </Field>
    </>
  );
}

/** Right-aligned (logical end) numeric cell content. */
export function Num({ children, className = '' }) {
  return <span className={`block text-end tabular-nums whitespace-nowrap ${className}`}>{children}</span>;
}

/** Wrapper for a filter bar. */
export function FilterBar({ children }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end mb-4">{children}</div>;
}

/** Wider modal body helper (ui Modal is max-w-lg; this is just a scroll wrapper). */
export function ScrollBox({ children }) {
  return <div className="max-h-80 overflow-y-auto">{children}</div>;
}
