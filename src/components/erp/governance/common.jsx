/* eslint-disable react-refresh/only-export-components */
import { useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Badge, Input, useAsync, useLang } from '../ui';
import { listEmployees } from '../../../lib/erp/financeApi';
import { DUTY_CATEGORIES, dutyName, pairLabel } from '../../../lib/erp/governanceApi';

/** Governance admins = administrators, principal, vice principal (mirrors is_governance_admin()). */
export function useGovernance() {
  const auth = useAuth();
  return {
    user: auth.user,
    isAdmin: Boolean(auth.isAdmin),
    isAccountant: Boolean(auth.isAccountant),
    isFinanceStaff: Boolean(auth.isFinanceStaff),
    isFinanceViewer: Boolean(auth.isFinanceViewer),
    isGov: Boolean(auth.isAdmin || auth.isPrincipal || auth.isVP),
  };
}

/** Approved lecturers / staff (the people duties and tasks can be given to). */
export function useStaff() {
  const [state] = useAsync(() => listEmployees(), []);
  const list = useMemo(() => state.data || [], [state.data]);
  const map = useMemo(() => Object.fromEntries(list.map((p) => [p.id, p])), [list]);
  const options = useMemo(() => list.map((p) => ({ value: p.id, label: p.full_name || p.id })), [list]);
  return { state, list, map, options };
}

export function DutyLabel({ duty }) {
  const { lang, t } = useLang();
  if (!duty) return <span className="text-gray-500">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{dutyName(duty, lang)}</span>
      <Badge tone="blue">{pairLabel(DUTY_CATEGORIES, duty.category, t)}</Badge>
    </span>
  );
}

/** Checkbox list with a search box for picking several people. */
export function PeopleMultiSelect({ people = [], value = [], onChange }) {
  const { t } = useLang();
  const [q, setQ] = useState('');
  const selected = new Set(value);
  const needle = q.trim().toLowerCase();
  const shown = people.filter((p) => !needle || (p.full_name || '').toLowerCase().includes(needle));
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input placeholder={t('Search people…', 'ابحث عن الأشخاص…')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="text-xs text-emerald-400 whitespace-nowrap" onClick={() => onChange(people.map((p) => p.id))}>
          {t('Select all', 'تحديد الكل')}
        </button>
        <button type="button" className="text-xs text-gray-400 whitespace-nowrap" onClick={() => onChange([])}>
          {t('Clear', 'مسح')}
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-800 p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
        {shown.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm text-gray-200">
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
            <span className="truncate">{p.full_name || p.id}</span>
          </label>
        ))}
        {!shown.length && <div className="text-xs text-gray-500">{t('No people found', 'لا يوجد أشخاص')}</div>}
      </div>
      <div className="text-xs text-gray-500">
        {t('Selected', 'المحدد')}: {value.length}
      </div>
    </div>
  );
}

const STATUS = {
  draft: ['Draft', 'مسودة', 'amber'],
  finalized: ['Finalized', 'معتمد', 'green'],
  active: ['Active', 'نشط', 'green'],
  ended: ['Ended', 'منتهٍ', 'gray'],
  submitted: ['Awaiting approval', 'بانتظار الاعتماد', 'amber'],
  posted: ['Posted', 'مرحَّل', 'green'],
  rejected: ['Rejected', 'مرفوض', 'red'],
};

/** Status badge with translated labels for governance records. */
export function GovStatus({ status }) {
  const { t } = useLang();
  const s = STATUS[status];
  if (!s) return <Badge>{status || '—'}</Badge>;
  return <Badge tone={s[2]}>{t(s[0], s[1])}</Badge>;
}

export function Checkbox({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-300">
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
