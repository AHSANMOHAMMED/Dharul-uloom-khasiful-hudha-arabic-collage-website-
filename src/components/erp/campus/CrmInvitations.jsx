import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { AsyncView, Badge, Button, Card, Field, Input, Select, Table, useAsync, useLang } from '../ui';
import { formatDate, insertRow, query, updateRow } from '../../../lib/erp/rpc';
import { STAFF_ROLES, toOptions } from '../../../lib/erp/campusApi';
import { ChipMultiSelect } from './common';
import { useAction } from './hooks';

const EMPTY = { email: '', full_name: '', account_type: 'tutor', role: 'user', assigned_tutor_role: 'none', extra_roles: [] };

function inviteStatus(r) {
  if (r.revoked_at) return 'revoked';
  if (r.accepted_at) return 'accepted';
  if (new Date(r.expires_at).getTime() < Date.now()) return 'expired';
  return 'pending';
}

export default function CrmInvitations() {
  const { t, ar } = useLang();
  const auth = useAuth();
  const [busy, run] = useAction();
  const [form, setForm] = useState(EMPTY);
  const [filter, setFilter] = useState('pending');
  const [last, setLast] = useState(null);
  const [state, reload] = useAsync(
    () => query('org_invitations', (q) => q.select('*, inviter:profiles!invited_by(full_name)').order('created_at', { ascending: false }).limit(500)),
    []
  );

  const roleOpts = [
    { value: 'user', label: t('Standard user', 'مستخدم عادي') },
    { value: 'librarian', label: t('Librarian (library admin)', 'أمين مكتبة') },
    ...(auth.isAdmin ? [{ value: 'admin', label: t('Organization admin', 'مسؤول المؤسسة') }] : []),
  ];
  const staffRoleOpts = toOptions(STAFF_ROLES, ar);

  const submit = async (e) => {
    e.preventDefault();
    const isEmployee = form.account_type !== 'parent';
    const row = {
      email: form.email.trim().toLowerCase(),
      full_name: form.full_name.trim() || null,
      account_type: form.account_type,
      role: form.role,
      assigned_tutor_role: isEmployee ? form.assigned_tutor_role : 'none',
      extra_roles: isEmployee ? form.extra_roles.filter((r) => r !== form.assigned_tutor_role) : [],
    };
    const res = await run(() => insertRow('org_invitations', row), t('Invitation created', 'تم إنشاء الدعوة'));
    if (res.ok) {
      setLast(res.data);
      setForm(EMPTY);
      reload();
    }
  };
  const revoke = async (r) => {
    if (!window.confirm(t(`Revoke the invitation for ${r.email}?`, `إلغاء دعوة ${r.email}؟`))) return;
    const res = await run(() => updateRow('org_invitations', r.id, { revoked_at: new Date().toISOString() }), t('Invitation revoked', 'تم إلغاء الدعوة'));
    if (res.ok) reload();
  };

  if (!(auth.isAdmin || auth.isHrStaff)) {
    return <Card><p className="text-sm text-gray-400">{t('Only administrators and HR managers can invite staff.', 'دعوة الموظفين للمسؤولين ومديري الموارد البشرية فقط.')}</p></Card>;
  }

  return (
    <div className="space-y-6">
      <Card title={t('Invite a staff member or parent', 'دعوة موظف أو ولي أمر')}>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Field label={t('E-mail', 'البريد')}><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label={t('Full name', 'الاسم الكامل')}><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
            <Field label={t('Account type', 'نوع الحساب')}>
              <Select value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value })} options={[
                { value: 'tutor', label: t('Tutor (teaching)', 'معلم') },
                { value: 'staff', label: t('Staff (non-teaching)', 'موظف') },
                { value: 'parent', label: t('Parent', 'ولي أمر') },
              ]} />
            </Field>
            <Field label={t('System role', 'دور النظام')}><Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={roleOpts} /></Field>
          </div>
          {form.account_type !== 'parent' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Field label={t('Primary staff role', 'الدور الوظيفي الأساسي')}>
                  <Select value={form.assigned_tutor_role} onChange={(e) => setForm({ ...form, assigned_tutor_role: e.target.value })}
                    options={[{ value: 'none', label: t('None', 'لا يوجد') }, ...staffRoleOpts]} />
                </Field>
              </div>
              <Field label={t('Additional roles', 'أدوار إضافية')}>
                <ChipMultiSelect options={staffRoleOpts.filter((o) => o.value !== form.assigned_tutor_role)} value={form.extra_roles} onChange={(v) => setForm({ ...form, extra_roles: v })} />
              </Field>
            </>
          )}
          <div className="flex justify-end"><Button type="submit" disabled={busy}>{t('Create invitation', 'إنشاء الدعوة')}</Button></div>
        </form>
        {last && (
          <div className="mt-4 rounded-xl border border-emerald-700 bg-emerald-950/40 p-3 text-sm text-emerald-100">
            {t('Ask', 'اطلب من')} <b>{last.email}</b> {t('to sign up with this e-mail — the role and approval are applied automatically. Invite token:', 'التسجيل بهذا البريد — يطبق الدور تلقائيًا. رمز الدعوة:')}
            <div className="font-mono break-all mt-1">{last.token}</div>
            <div className="text-xs text-emerald-300 mt-1">{t('Expires', 'تنتهي')} {formatDate(last.expires_at)}</div>
          </div>
        )}
      </Card>
      <Card title={t('Invitations', 'الدعوات')} actions={
        <div className="w-40">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('All', 'الكل')} options={[
            { value: 'pending', label: t('Pending', 'معلقة') }, { value: 'accepted', label: t('Accepted', 'مقبولة') },
            { value: 'revoked', label: t('Revoked', 'ملغاة') }, { value: 'expired', label: t('Expired', 'منتهية') },
          ]} />
        </div>
      }>
        <AsyncView state={state}>
          {(rows) => (
            <Table rows={rows.filter((r) => !filter || inviteStatus(r) === filter)} empty={t('No invitations.', 'لا توجد دعوات.')} columns={[
              { key: 'email', label: t('E-mail', 'البريد'), render: (r) => <div><div>{r.email}</div><div className="text-xs text-gray-500">{r.full_name}</div></div> },
              { key: 'account_type', label: t('Type', 'النوع') },
              { key: 'role', label: t('Role', 'الدور'), render: (r) => (
                <div className="flex flex-wrap gap-1">
                  {r.role !== 'user' && <Badge tone="red">{r.role}</Badge>}
                  {r.assigned_tutor_role !== 'none' && <Badge tone="blue">{r.assigned_tutor_role}</Badge>}
                  {(r.extra_roles || []).map((x) => <Badge key={x}>{x}</Badge>)}
                </div>
              ) },
              { key: 'status', label: t('Status', 'الحالة'), render: (r) => {
                const s = inviteStatus(r);
                return <Badge tone={{ pending: 'amber', accepted: 'green', revoked: 'red', expired: 'gray' }[s]}>{s}</Badge>;
              } },
              { key: 'inviter', label: t('Invited by', 'بواسطة'), render: (r) => r.inviter?.full_name || '—' },
              { key: 'created_at', label: t('Created', 'الإنشاء'), render: (r) => formatDate(r.created_at) },
              { key: 'act', label: '', render: (r) => inviteStatus(r) === 'pending' ? <Button size="sm" variant="danger" disabled={busy} onClick={() => revoke(r)}>{t('Revoke', 'إلغاء')}</Button> : null },
            ]} />
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
