import { useMemo, useState } from 'react';
import { AsyncView, Badge, Button, Card, Field, Input, Modal, Select, Table, Textarea, useAsync, useLang } from '../ui';
import { useAuth } from '../../../context/AuthContext';
import { insertRow, updateRow } from '../../../lib/erp/rpc';
import { ACCOUNT_SUBTYPES, ACCOUNT_TYPES, labelOf, listAccounts, runAction, toOptions } from '../../../lib/erp/financeApi';
import { ConfirmModal, FilterBar } from './shared';

function AccountForm({ accounts, onClose, onSaved }) {
  const { t } = useLang();
  const [form, setForm] = useState({ code: '', name: '', name_ar: '', type: 'expense', subtype: 'other', parent_id: '', description: '' });
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const codeTaken = accounts.some((a) => a.code === form.code.trim());
  const valid = form.code.trim() && form.name.trim() && !codeTaken;

  const save = async () => {
    setBusy(true);
    const ok = await runAction(
      () =>
        insertRow('accounts', {
          code: form.code.trim(),
          name: form.name.trim(),
          name_ar: form.name_ar.trim() || null,
          type: form.type,
          subtype: form.subtype || null,
          parent_id: form.parent_id || null,
          description: form.description.trim() || null,
        }),
      t('Account created', 'تم إنشاء الحساب'),
    );
    setBusy(false);
    if (ok) onSaved();
  };

  return (
    <Modal
      open
      title={t('New account', 'حساب جديد')}
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
        <Field label={t('Code', 'الرمز')} hint={codeTaken ? t('Code already in use', 'الرمز مستخدم') : undefined}>
          <Input value={form.code} onChange={(e) => set({ code: e.target.value })} placeholder="5950" />
        </Field>
        <Field label={t('Type', 'النوع')}>
          <Select value={form.type} onChange={(e) => set({ type: e.target.value })} options={toOptions(ACCOUNT_TYPES, t)} />
        </Field>
        <Field label={t('Name (English)', 'الاسم (إنجليزي)')}>
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label={t('Name (Arabic)', 'الاسم (عربي)')}>
          <Input dir="rtl" value={form.name_ar} onChange={(e) => set({ name_ar: e.target.value })} />
        </Field>
        <Field label={t('Subtype', 'النوع الفرعي')}>
          <Select value={form.subtype} onChange={(e) => set({ subtype: e.target.value })} options={toOptions(ACCOUNT_SUBTYPES, t)} />
        </Field>
        <Field label={t('Parent account', 'الحساب الأب')}>
          <Select
            value={form.parent_id}
            onChange={(e) => set({ parent_id: e.target.value })}
            placeholder={t('— None —', '— لا شيء —')}
            options={accounts.filter((a) => a.type === form.type).map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }))}
          />
        </Field>
      </div>
      <Field label={t('Description', 'الوصف')}>
        <Textarea rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
    </Modal>
  );
}

export default function AcctAccounts() {
  const { t, ar } = useLang();
  const { isAccountant } = useAuth();
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [state, reload] = useAsync(() => listAccounts(), []);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (state.data || []).filter(
      (a) => (!type || a.type === type) && (!s || a.code.includes(s) || a.name.toLowerCase().includes(s) || (a.name_ar || '').includes(s)),
    );
  }, [state.data, type, search]);

  return (
    <Card
      title={t('Chart of accounts', 'دليل الحسابات')}
      actions={
        isAccountant && (
          <Button size="sm" onClick={() => setCreating(true)} disabled={!state.data}>
            + {t('New account', 'حساب جديد')}
          </Button>
        )
      }
    >
      <FilterBar>
        <Field label={t('Type', 'النوع')}>
          <Select value={type} onChange={(e) => setType(e.target.value)} placeholder={t('All types', 'كل الأنواع')} options={toOptions(ACCOUNT_TYPES, t)} />
        </Field>
        <Field label={t('Search', 'بحث')}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Code or name', 'الرمز أو الاسم')} />
        </Field>
      </FilterBar>
      <AsyncView state={state}>
        {() => (
          <Table
            rows={rows}
            empty={t('No accounts', 'لا توجد حسابات')}
            columns={[
              { key: 'code', label: t('Code', 'الرمز'), render: (a) => <span className="font-mono">{a.code}</span> },
              {
                key: 'name',
                label: t('Name', 'الاسم'),
                render: (a) => (
                  <div>
                    <div>{ar && a.name_ar ? a.name_ar : a.name}</div>
                    {a.description && <div className="text-xs text-gray-500">{a.description}</div>}
                  </div>
                ),
              },
              { key: 'type', label: t('Type', 'النوع'), render: (a) => labelOf(ACCOUNT_TYPES, a.type, t) },
              { key: 'subtype', label: t('Subtype', 'الفرعي'), render: (a) => (a.subtype ? labelOf(ACCOUNT_SUBTYPES, a.subtype, t) : '—') },
              {
                key: 'flags',
                label: t('Status', 'الحالة'),
                render: (a) => (
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={a.is_active ? 'green' : 'gray'}>{a.is_active ? t('Active', 'نشط') : t('Inactive', 'غير نشط')}</Badge>
                    {a.is_system && <Badge tone="blue">{t('System', 'نظامي')}</Badge>}
                  </div>
                ),
              },
              {
                key: 'actions',
                label: '',
                render: (a) =>
                  isAccountant &&
                  !a.is_system && (
                    <Button size="sm" variant="ghost" onClick={() => setToggling(a)}>
                      {a.is_active ? t('Deactivate', 'تعطيل') : t('Activate', 'تفعيل')}
                    </Button>
                  ),
              },
            ]}
          />
        )}
      </AsyncView>
      {creating && (
        <AccountForm
          accounts={state.data || []}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
      <ConfirmModal
        open={Boolean(toggling)}
        danger={Boolean(toggling?.is_active)}
        title={toggling?.is_active ? t('Deactivate account', 'تعطيل الحساب') : t('Activate account', 'تفعيل الحساب')}
        message={
          toggling
            ? toggling.is_active
              ? t(`Deactivate ${toggling.code} ${toggling.name}? It can no longer be used for new postings; history is kept.`, `تعطيل ${toggling.code}؟ لن يُستخدم في قيود جديدة مع الاحتفاظ بالسجل.`)
              : t(`Re-activate ${toggling.code} ${toggling.name}?`, `إعادة تفعيل ${toggling.code}؟`)
            : ''
        }
        onClose={() => setToggling(null)}
        onConfirm={async () => {
          const ok = await runAction(() => updateRow('accounts', toggling.id, { is_active: !toggling.is_active }), t('Account updated', 'تم تحديث الحساب'));
          if (ok) reload();
          return ok;
        }}
      />
    </Card>
  );
}
