import { useState } from 'react';
import { AsyncView, Badge, Button, Card, Field, Input, Modal, Select, Table, useAsync, useLang } from '../ui';
import { useAuth } from '../../../context/AuthContext';
import { query, insertRow, updateRow, deleteRow, formatMoney } from '../../../lib/erp/rpc';
import { CLASS_OPTIONS, FEE_FREQUENCIES, labelOf, listAccounts, num, runAction, toOptions } from '../../../lib/erp/financeApi';
import { ConfirmModal, Num } from './shared';

const blankCategory = { code: '', name: '', name_ar: '', income_account_code: '4100', is_recurring: false, default_amount: '0', is_active: true };
const blankStructure = { fee_category_id: '', class_number: '', academic_year_id: '', amount: '', frequency: 'monthly', due_day: '10', is_active: true };

function Check({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-emerald-500" />
      {label}
    </label>
  );
}

function CategoryForm({ initial, incomeAccounts, onClose, onSaved }) {
  const { t } = useLang();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const valid = form.code.trim() && form.name.trim() && num(form.default_amount) >= 0;

  const save = async () => {
    setBusy(true);
    const row = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      name_ar: form.name_ar?.trim() || null,
      income_account_code: form.income_account_code,
      is_recurring: form.is_recurring,
      default_amount: num(form.default_amount),
      is_active: form.is_active,
    };
    const ok = await runAction(
      () => (form.id ? updateRow('fee_categories', form.id, row) : insertRow('fee_categories', row)),
      t('Fee category saved', 'تم حفظ فئة الرسوم'),
    );
    setBusy(false);
    if (ok) onSaved();
  };

  return (
    <Modal
      open
      title={form.id ? t('Edit fee category', 'تعديل فئة الرسوم') : t('New fee category', 'فئة رسوم جديدة')}
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
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('Code', 'الرمز')}>
          <Input value={form.code} onChange={(e) => set({ code: e.target.value })} />
        </Field>
        <Field label={t('Default amount', 'المبلغ الافتراضي')}>
          <Input type="number" min="0" step="0.01" value={form.default_amount} onChange={(e) => set({ default_amount: e.target.value })} />
        </Field>
        <Field label={t('Name (English)', 'الاسم (إنجليزي)')}>
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label={t('Name (Arabic)', 'الاسم (عربي)')}>
          <Input dir="rtl" value={form.name_ar || ''} onChange={(e) => set({ name_ar: e.target.value })} />
        </Field>
      </div>
      <Field label={t('Income account', 'حساب الإيراد')}>
        <Select
          value={form.income_account_code}
          onChange={(e) => set({ income_account_code: e.target.value })}
          options={incomeAccounts.map((a) => ({ value: a.code, label: `${a.code} · ${a.name}` }))}
        />
      </Field>
      <div className="flex flex-wrap gap-4">
        <Check label={t('Recurring', 'متكرر')} checked={form.is_recurring} onChange={(v) => set({ is_recurring: v })} />
        <Check label={t('Active', 'نشط')} checked={form.is_active} onChange={(v) => set({ is_active: v })} />
      </div>
    </Modal>
  );
}

function StructureForm({ initial, categories, years, onClose, onSaved }) {
  const { t } = useLang();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const dueDay = Number(form.due_day);
  const valid = form.fee_category_id && num(form.amount) >= 0 && form.amount !== '' && dueDay >= 1 && dueDay <= 28;

  const save = async () => {
    setBusy(true);
    const row = {
      fee_category_id: form.fee_category_id,
      class_number: form.class_number ? Number(form.class_number) : null,
      academic_year_id: form.academic_year_id || null,
      amount: num(form.amount),
      frequency: form.frequency,
      due_day: dueDay,
      is_active: form.is_active,
    };
    const ok = await runAction(
      () => (form.id ? updateRow('fee_structures', form.id, row) : insertRow('fee_structures', row)),
      t('Fee structure saved', 'تم حفظ هيكل الرسوم'),
    );
    setBusy(false);
    if (ok) onSaved();
  };

  return (
    <Modal
      open
      title={form.id ? t('Edit fee structure', 'تعديل هيكل الرسوم') : t('New fee structure', 'هيكل رسوم جديد')}
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
      <Field label={t('Fee category', 'فئة الرسوم')}>
        <Select
          value={form.fee_category_id}
          onChange={(e) => set({ fee_category_id: e.target.value })}
          placeholder={t('Select…', 'اختر…')}
          options={categories.map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` }))}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('Class', 'الصف')}>
          <Select value={form.class_number} onChange={(e) => set({ class_number: e.target.value })} placeholder={t('All classes', 'كل الصفوف')} options={CLASS_OPTIONS} />
        </Field>
        <Field label={t('Academic year', 'العام الدراسي')}>
          <Select
            value={form.academic_year_id}
            onChange={(e) => set({ academic_year_id: e.target.value })}
            placeholder={t('All years', 'كل الأعوام')}
            options={years.map((y) => ({ value: y.id, label: `${y.name}${y.is_current ? ' (Current)' : ''}` }))}
          />
        </Field>
        <Field label={t('Amount', 'المبلغ')}>
          <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
        </Field>
        <Field label={t('Frequency', 'التكرار')}>
          <Select value={form.frequency} onChange={(e) => set({ frequency: e.target.value })} options={toOptions(FEE_FREQUENCIES, t)} />
        </Field>
        <Field label={t('Due day (1–28)', 'يوم الاستحقاق (1–28)')}>
          <Input type="number" min="1" max="28" value={form.due_day} onChange={(e) => set({ due_day: e.target.value })} />
        </Field>
      </div>
      <Check label={t('Active', 'نشط')} checked={form.is_active} onChange={(v) => set({ is_active: v })} />
      <p className="text-xs text-gray-500">
        {t(
          'Only monthly structures are applied by monthly invoice generation; a class-specific structure overrides the all-classes one.',
          'تُطبَّق الهياكل الشهرية فقط عند إنشاء الفواتير الشهرية؛ ويُقدَّم هيكل الصف المحدد على هيكل كل الصفوف.',
        )}
      </p>
    </Modal>
  );
}

export default function FeeSetup() {
  const { t, ar } = useLang();
  const { isFinanceStaff } = useAuth();
  const [editingCat, setEditingCat] = useState(null);
  const [editingStruct, setEditingStruct] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const [state, reload] = useAsync(async () => {
    const [categories, structures, years, incomeAccounts] = await Promise.all([
      query('fee_categories', (q) => q.select('*').order('code')),
      query('fee_structures', (q) => q.select('*').order('class_number', { ascending: true, nullsFirst: true })),
      query('academic_years', (q) => q.select('id, name, is_current').order('start_date', { ascending: false })).catch(() => []),
      listAccounts((q) => q.eq('type', 'income').eq('is_active', true)).catch(() => []),
    ]);
    return { categories, structures, years, incomeAccounts };
  }, []);

  const done = () => {
    setEditingCat(null);
    setEditingStruct(null);
    reload();
  };

  return (
    <AsyncView state={state}>
      {({ categories, structures, years, incomeAccounts }) => {
        const catById = Object.fromEntries(categories.map((c) => [c.id, c]));
        const yearById = Object.fromEntries(years.map((y) => [y.id, y]));
        const incomeOptions = incomeAccounts.length ? incomeAccounts : [{ code: '4100', name: 'Tuition Fee Income' }];
        return (
          <div className="space-y-5">
            <Card
              title={t('Fee categories', 'فئات الرسوم')}
              actions={
                isFinanceStaff && (
                  <Button size="sm" onClick={() => setEditingCat({ ...blankCategory })}>
                    + {t('New category', 'فئة جديدة')}
                  </Button>
                )
              }
            >
              <Table
                rows={categories}
                empty={t('No fee categories', 'لا توجد فئات رسوم')}
                columns={[
                  { key: 'code', label: t('Code', 'الرمز'), render: (c) => <span className="font-mono">{c.code}</span> },
                  { key: 'name', label: t('Name', 'الاسم'), render: (c) => (ar && c.name_ar ? c.name_ar : c.name) },
                  { key: 'income_account_code', label: t('Income a/c', 'حساب الإيراد') },
                  { key: 'default_amount', label: t('Default', 'الافتراضي'), render: (c) => <Num>{formatMoney(c.default_amount)}</Num> },
                  { key: 'is_recurring', label: t('Recurring', 'متكرر'), render: (c) => (c.is_recurring ? <span className="material-symbols-outlined text-emerald-500 text-[16px]">check_circle</span> : '—') },
                  {
                    key: 'is_active',
                    label: t('Status', 'الحالة'),
                    render: (c) => <Badge tone={c.is_active ? 'green' : 'gray'}>{c.is_active ? t('Active', 'نشط') : t('Inactive', 'غير نشط')}</Badge>,
                  },
                  {
                    key: 'actions',
                    label: '',
                    render: (c) =>
                      isFinanceStaff && (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setEditingCat({ ...c, default_amount: String(c.default_amount) })}>
                            {t('Edit', 'تعديل')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              if (await runAction(() => updateRow('fee_categories', c.id, { is_active: !c.is_active }))) reload();
                            }}
                          >
                            {c.is_active ? t('Deactivate', 'تعطيل') : t('Activate', 'تفعيل')}
                          </Button>
                        </div>
                      ),
                  },
                ]}
              />
            </Card>

            <Card
              title={t('Fee structures', 'هياكل الرسوم')}
              actions={
                isFinanceStaff && (
                  <Button size="sm" onClick={() => setEditingStruct({ ...blankStructure })} disabled={!categories.length}>
                    + {t('New structure', 'هيكل جديد')}
                  </Button>
                )
              }
            >
              <Table
                rows={structures}
                empty={t('No fee structures — invoices will use the default tuition amount.', 'لا توجد هياكل رسوم — ستُستخدم الرسوم الافتراضية.')}
                columns={[
                  { key: 'cat', label: t('Category', 'الفئة'), render: (s) => catById[s.fee_category_id]?.name || '—' },
                  { key: 'class_number', label: t('Class', 'الصف'), render: (s) => s.class_number ?? t('All', 'الكل') },
                  { key: 'year', label: t('Year', 'العام'), render: (s) => yearById[s.academic_year_id]?.name || t('All', 'الكل') },
                  { key: 'frequency', label: t('Frequency', 'التكرار'), render: (s) => labelOf(FEE_FREQUENCIES, s.frequency, t) },
                  { key: 'due_day', label: t('Due day', 'يوم الاستحقاق') },
                  { key: 'amount', label: t('Amount', 'المبلغ'), render: (s) => <Num>{formatMoney(s.amount)}</Num> },
                  {
                    key: 'is_active',
                    label: t('Status', 'الحالة'),
                    render: (s) => <Badge tone={s.is_active ? 'green' : 'gray'}>{s.is_active ? t('Active', 'نشط') : t('Inactive', 'غير نشط')}</Badge>,
                  },
                  {
                    key: 'actions',
                    label: '',
                    render: (s) =>
                      isFinanceStaff && (
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setEditingStruct({
                                ...s,
                                class_number: s.class_number ? String(s.class_number) : '',
                                academic_year_id: s.academic_year_id || '',
                                amount: String(s.amount),
                                due_day: String(s.due_day),
                              })
                            }
                          >
                            {t('Edit', 'تعديل')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleting(s)}>
                            {t('Delete', 'حذف')}
                          </Button>
                        </div>
                      ),
                  },
                ]}
              />
            </Card>

            {editingCat && <CategoryForm initial={editingCat} incomeAccounts={incomeOptions} onClose={() => setEditingCat(null)} onSaved={done} />}
            {editingStruct && (
              <StructureForm initial={editingStruct} categories={categories} years={years} onClose={() => setEditingStruct(null)} onSaved={done} />
            )}
            <ConfirmModal
              open={Boolean(deleting)}
              title={t('Delete fee structure', 'حذف هيكل الرسوم')}
              message={t('Existing invoices are not affected. Future invoices will no longer use this structure.', 'لن تتأثر الفواتير الحالية، ولن يُستخدم هذا الهيكل مستقبلاً.')}
              confirmLabel={t('Delete', 'حذف')}
              onClose={() => setDeleting(null)}
              onConfirm={async () => {
                const ok = await runAction(() => deleteRow('fee_structures', deleting.id), t('Fee structure deleted', 'تم حذف هيكل الرسوم'));
                if (ok) reload();
                return ok;
              }}
            />
          </div>
        );
      }}
    </AsyncView>
  );
}
