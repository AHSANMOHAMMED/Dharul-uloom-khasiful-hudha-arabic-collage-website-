import { useState } from 'react';
import { AsyncView, Badge, Button, Card, Field, Input, Modal, Select, Table, Textarea, useAsync, useLang } from '../ui';
import { useAuth } from '../../../context/AuthContext';
import { query, insertRow, updateRow, formatMoney, formatDate, today } from '../../../lib/erp/rpc';
import { num, profilesMap, runAction } from '../../../lib/erp/financeApi';
import { EmployeePicker, Num } from './shared';

function ProfileForm({ initial, components, existingIds, onClose, onSaved }) {
  const { t } = useLang();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const compByCode = Object.fromEntries(components.map((c) => [c.code, c]));
  const setComp = (i, patch) => set({ components: form.components.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const rowsValid = form.components.every((c) => c.code && num(c.amount) > 0);
  const valid = form.profile_id && form.basic_salary !== '' && num(form.basic_salary) >= 0 && rowsValid && form.effective_from;
  const earnings = form.components.filter((c) => compByCode[c.code]?.kind === 'earning').reduce((s, c) => s + num(c.amount), 0);
  const deductions = form.components.filter((c) => compByCode[c.code]?.kind === 'deduction').reduce((s, c) => s + num(c.amount), 0);

  const save = async () => {
    setBusy(true);
    const row = {
      profile_id: form.profile_id,
      basic_salary: num(form.basic_salary),
      components: form.components.map((c) => ({ code: c.code, amount: Math.round(num(c.amount) * 100) / 100 })),
      epf_applicable: form.epf_applicable,
      payment_method: form.payment_method,
      effective_from: form.effective_from,
      is_active: form.is_active,
      notes: form.notes?.trim() || null,
    };
    const ok = await runAction(
      () => (form.id ? updateRow('staff_salary_profiles', form.id, row) : insertRow('staff_salary_profiles', row)),
      t('Salary profile saved', 'تم حفظ ملف الراتب'),
    );
    setBusy(false);
    if (ok) onSaved();
  };

  return (
    <Modal
      open
      title={form.id ? t('Edit salary profile', 'تعديل ملف الراتب') : t('New salary profile', 'ملف راتب جديد')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button onClick={save} disabled={!valid || busy}>
            {t('Save', 'حفظ')}
          </Button>
        </>
      }
    >
      {form.id ? (
        <p className="text-sm text-white font-semibold">{form.staff_name}</p>
      ) : (
        <EmployeePicker value={form.profile_id} onChange={(v) => set({ profile_id: v })} filter={(p) => !existingIds.has(p.id)} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('Basic salary (monthly)', 'الراتب الأساسي (شهري)')}>
          <Input type="number" min="0" step="0.01" value={form.basic_salary} onChange={(e) => set({ basic_salary: e.target.value })} />
        </Field>
        <Field label={t('Effective from', 'ساري من')}>
          <Input type="date" value={form.effective_from} onChange={(e) => set({ effective_from: e.target.value })} />
        </Field>
        <Field label={t('Payment method', 'طريقة الدفع')}>
          <Select
            value={form.payment_method}
            onChange={(e) => set({ payment_method: e.target.value })}
            options={[
              { value: 'bank_transfer', label: t('Bank transfer', 'تحويل بنكي') },
              { value: 'cash', label: t('Cash', 'نقدًا') },
              { value: 'cheque', label: t('Cheque', 'شيك') },
            ]}
          />
        </Field>
        <div className="flex flex-col gap-2 justify-end pb-1">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" className="accent-emerald-500" checked={form.epf_applicable} onChange={(e) => set({ epf_applicable: e.target.checked })} />
            {t('EPF / ETF applicable', 'يخضع لصندوق الادخار / الثقة')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" className="accent-emerald-500" checked={form.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
            {t('Active (included in payroll)', 'نشط (مشمول في الرواتب)')}
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-gray-400">{t('Recurring allowances & deductions', 'البدلات والاستقطاعات المتكررة')}</div>
        {form.components.map((c, i) => (
          <div key={i} className="flex gap-2 items-center">
            <div className="flex-1">
              <Select
                value={c.code}
                onChange={(e) => setComp(i, { code: e.target.value })}
                placeholder={t('Component…', 'البند…')}
                options={components.map((x) => ({ value: x.code, label: `${x.kind === 'earning' ? '+' : '−'} ${x.name} (${x.code})` }))}
              />
            </div>
            <div className="w-32">
              <Input type="number" min="0" step="0.01" value={c.amount} onChange={(e) => setComp(i, { amount: e.target.value })} />
            </div>
            <Button variant="ghost" size="sm" onClick={() => set({ components: form.components.filter((_, j) => j !== i) })} aria-label={t('Remove', 'حذف')}>
              ✕
            </Button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={() => set({ components: [...form.components, { code: '', amount: '' }] })}>
          + {t('Add component', 'إضافة بند')}
        </Button>
        <div className="text-xs text-gray-400">
          {t('Gross (before unpaid leave)', 'الإجمالي (قبل الإجازات غير المدفوعة)')}: <b className="text-white">{formatMoney(num(form.basic_salary) + earnings)}</b> ·{' '}
          {t('Fixed deductions', 'الاستقطاعات الثابتة')}: <b className="text-white">{formatMoney(deductions)}</b>
          {form.epf_applicable && ` · ${t('EPF 8% is computed on basic at payroll time', 'يُحسب صندوق الادخار 8% على الأساسي عند إعداد الرواتب')}`}
        </div>
      </div>
      <Field label={t('Notes', 'ملاحظات')}>
        <Textarea rows={2} value={form.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </Modal>
  );
}

export default function PaySalaryProfiles() {
  const { t } = useLang();
  const { isHrStaff, isAccountant } = useAuth();
  const canEdit = isHrStaff || isAccountant;
  const [editing, setEditing] = useState(null);

  const [state, reload] = useAsync(async () => {
    const [profiles, components] = await Promise.all([
      query('staff_salary_profiles', (q) => q.select('*').order('created_at')),
      query('salary_components', (q) => q.select('id, code, name, kind, is_system, is_active').eq('is_system', false).eq('is_active', true).order('kind').order('name')),
    ]);
    const people = await profilesMap(profiles.map((p) => p.profile_id));
    return {
      rows: profiles.map((p) => ({ ...p, staff_name: people[p.profile_id]?.full_name || '—' })).sort((a, b) => a.staff_name.localeCompare(b.staff_name)),
      components,
    };
  }, []);

  return (
    <AsyncView state={state}>
      {({ rows, components }) => {
        const compByCode = Object.fromEntries(components.map((c) => [c.code, c]));
        const existingIds = new Set(rows.map((r) => r.profile_id));
        return (
          <Card
            title={t('Salary profiles', 'ملفات الرواتب')}
            actions={
              canEdit && (
                <Button
                  size="sm"
                  onClick={() =>
                    setEditing({ profile_id: null, basic_salary: '', components: [], epf_applicable: true, payment_method: 'bank_transfer', effective_from: today(), is_active: true, notes: '' })
                  }
                >
                  + {t('New profile', 'ملف جديد')}
                </Button>
              )
            }
          >
            <Table
              rows={rows}
              empty={t('No salary profiles yet', 'لا توجد ملفات رواتب بعد')}
              columns={[
                { key: 'staff_name', label: t('Employee', 'الموظف') },
                { key: 'basic_salary', label: t('Basic', 'الأساسي'), render: (r) => <Num>{formatMoney(r.basic_salary)}</Num> },
                {
                  key: 'components',
                  label: t('Components', 'البنود'),
                  render: (r) => (
                    <div className="flex flex-wrap gap-1">
                      {(r.components || []).map((c, i) => (
                        <Badge key={i} tone={compByCode[c.code]?.kind === 'deduction' ? 'amber' : 'blue'}>
                          {c.code} {formatMoney(c.amount)}
                        </Badge>
                      ))}
                      {!r.components?.length && '—'}
                    </div>
                  ),
                },
                { key: 'epf_applicable', label: 'EPF', render: (r) => (r.epf_applicable ? '✓' : '—') },
                { key: 'effective_from', label: t('Effective', 'ساري من'), render: (r) => formatDate(r.effective_from) },
                {
                  key: 'is_active',
                  label: t('Status', 'الحالة'),
                  render: (r) => <Badge tone={r.is_active ? 'green' : 'gray'}>{r.is_active ? t('Active', 'نشط') : t('Inactive', 'غير نشط')}</Badge>,
                },
                {
                  key: 'actions',
                  label: '',
                  render: (r) =>
                    canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEditing({ ...r, basic_salary: String(r.basic_salary), components: (r.components || []).map((c) => ({ code: c.code, amount: String(c.amount) })) })
                        }
                      >
                        {t('Edit', 'تعديل')}
                      </Button>
                    ),
                },
              ]}
            />
            {editing && (
              <ProfileForm
                initial={editing}
                components={components}
                existingIds={existingIds}
                onClose={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null);
                  reload();
                }}
              />
            )}
          </Card>
        );
      }}
    </AsyncView>
  );
}
