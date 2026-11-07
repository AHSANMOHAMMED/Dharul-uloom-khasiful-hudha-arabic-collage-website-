import { useState } from 'react';
import { AsyncView, Badge, Button, Card, Field, Input, Modal, Select, Table, Textarea, useAsync, useLang } from '../ui';
import { useAuth } from '../../../context/AuthContext';
import { query, insertRow, updateRow, formatDate, formatMoney, today } from '../../../lib/erp/rpc';
import { num, profilesMap, runAction } from '../../../lib/erp/financeApi';
import { ConfirmModal, StudentPicker } from './shared';

function ConcessionForm({ categories, onClose, onSaved }) {
  const { t } = useLang();
  const [form, setForm] = useState({ student_id: null, fee_category_id: '', kind: 'percent', value: '', reason: '', valid_from: today(), valid_to: '' });
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const value = num(form.value);
  const valid =
    form.student_id &&
    value > 0 &&
    (form.kind !== 'percent' || value <= 100) &&
    form.reason.trim() &&
    form.valid_from &&
    (!form.valid_to || form.valid_to >= form.valid_from);

  const save = async () => {
    setBusy(true);
    const ok = await runAction(
      () =>
        insertRow('student_fee_concessions', {
          student_id: form.student_id,
          fee_category_id: form.fee_category_id || null,
          kind: form.kind,
          value,
          reason: form.reason.trim(),
          valid_from: form.valid_from,
          valid_to: form.valid_to || null,
        }),
      t('Concession created', 'تم إنشاء الإعفاء'),
    );
    setBusy(false);
    if (ok) onSaved();
  };

  return (
    <Modal
      open
      title={t('New concession', 'إعفاء جديد')}
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
      <StudentPicker value={form.student_id} onChange={(v) => set({ student_id: v })} />
      <Field label={t('Applies to', 'ينطبق على')}>
        <Select
          value={form.fee_category_id}
          onChange={(e) => set({ fee_category_id: e.target.value })}
          placeholder={t('All fee categories', 'كل فئات الرسوم')}
          options={categories.map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` }))}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('Type', 'النوع')}>
          <Select
            value={form.kind}
            onChange={(e) => set({ kind: e.target.value })}
            options={[
              { value: 'percent', label: t('Percentage', 'نسبة مئوية') },
              { value: 'fixed', label: t('Fixed amount', 'مبلغ ثابت') },
            ]}
          />
        </Field>
        <Field label={form.kind === 'percent' ? t('Percent (1–100)', 'النسبة (1–100)') : t('Amount per invoice', 'المبلغ لكل فاتورة')}>
          <Input type="number" min="0" step="0.01" value={form.value} onChange={(e) => set({ value: e.target.value })} />
        </Field>
        <Field label={t('Valid from', 'ساري من')}>
          <Input type="date" value={form.valid_from} onChange={(e) => set({ valid_from: e.target.value })} />
        </Field>
        <Field label={t('Valid to (optional)', 'ساري حتى (اختياري)')}>
          <Input type="date" value={form.valid_to} onChange={(e) => set({ valid_to: e.target.value })} />
        </Field>
      </div>
      <Field label={t('Reason', 'السبب')}>
        <Textarea rows={2} value={form.reason} onChange={(e) => set({ reason: e.target.value })} />
      </Field>
      <p className="text-xs text-gray-500">
        {t('Concessions are applied as discount lines when monthly invoices are generated.', 'تُطبَّق الإعفاءات كبنود خصم عند إنشاء الفواتير الشهرية.')}
      </p>
    </Modal>
  );
}

export default function FeeConcessions() {
  const { t } = useLang();
  const { isAccountant, isPrincipal } = useAuth();
  const canManage = isAccountant || isPrincipal;
  const [showInactive, setShowInactive] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deactivating, setDeactivating] = useState(null);

  const [state, reload] = useAsync(async () => {
    const [rows, categories] = await Promise.all([
      query('student_fee_concessions', (q) => {
        const b = q.select('*').order('created_at', { ascending: false }).limit(1000);
        return showInactive ? b : b.eq('is_active', true);
      }),
      query('fee_categories', (q) => q.select('id, code, name').order('code')),
    ]);
    const people = await profilesMap(rows.flatMap((r) => [r.student_id, r.approved_by]));
    return { rows, categories, people };
  }, [showInactive]);

  return (
    <Card
      title={t('Fee concessions', 'إعفاءات الرسوم')}
      actions={
        <>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input type="checkbox" className="accent-emerald-500" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            {t('Show inactive', 'إظهار غير النشطة')}
          </label>
          {canManage && (
            <Button size="sm" onClick={() => setCreating(true)}>
              + {t('New concession', 'إعفاء جديد')}
            </Button>
          )}
        </>
      }
    >
      <AsyncView state={state}>
        {({ rows, categories, people }) => {
          const catById = Object.fromEntries(categories.map((c) => [c.id, c]));
          return (
            <>
              <Table
                rows={rows}
                empty={t('No concessions', 'لا توجد إعفاءات')}
                columns={[
                  {
                    key: 'student',
                    label: t('Student', 'الطالب'),
                    render: (r) => (
                      <div>
                        <div>{people[r.student_id]?.full_name || '—'}</div>
                        <div className="text-xs text-gray-500">{people[r.student_id]?.index_number || ''}</div>
                      </div>
                    ),
                  },
                  { key: 'cat', label: t('Category', 'الفئة'), render: (r) => catById[r.fee_category_id]?.name || t('All', 'الكل') },
                  { key: 'value', label: t('Concession', 'الإعفاء'), render: (r) => (r.kind === 'percent' ? `${num(r.value)}%` : formatMoney(r.value)) },
                  { key: 'reason', label: t('Reason', 'السبب') },
                  { key: 'valid', label: t('Validity', 'الصلاحية'), render: (r) => `${formatDate(r.valid_from)} → ${r.valid_to ? formatDate(r.valid_to) : '∞'}` },
                  { key: 'approved_by', label: t('Approved by', 'اعتمده'), render: (r) => people[r.approved_by]?.full_name || '—' },
                  {
                    key: 'is_active',
                    label: t('Status', 'الحالة'),
                    render: (r) => <Badge tone={r.is_active ? 'green' : 'gray'}>{r.is_active ? t('Active', 'نشط') : t('Inactive', 'غير نشط')}</Badge>,
                  },
                  {
                    key: 'actions',
                    label: '',
                    render: (r) =>
                      canManage &&
                      r.is_active && (
                        <Button size="sm" variant="ghost" onClick={() => setDeactivating(r)}>
                          {t('Deactivate', 'تعطيل')}
                        </Button>
                      ),
                  },
                ]}
              />
              {creating && (
                <ConcessionForm
                  categories={categories}
                  onClose={() => setCreating(false)}
                  onSaved={() => {
                    setCreating(false);
                    reload();
                  }}
                />
              )}
            </>
          );
        }}
      </AsyncView>
      <ConfirmModal
        open={Boolean(deactivating)}
        title={t('Deactivate concession', 'تعطيل الإعفاء')}
        message={t('Future invoices will no longer receive this concession. Existing invoices are unchanged.', 'لن تحصل الفواتير المستقبلية على هذا الإعفاء. الفواتير الحالية لا تتغير.')}
        confirmLabel={t('Deactivate', 'تعطيل')}
        onClose={() => setDeactivating(null)}
        onConfirm={async () => {
          const ok = await runAction(
            () => updateRow('student_fee_concessions', deactivating.id, { is_active: false }),
            t('Concession deactivated', 'تم تعطيل الإعفاء'),
          );
          if (ok) reload();
          return ok;
        }}
      />
    </Card>
  );
}
