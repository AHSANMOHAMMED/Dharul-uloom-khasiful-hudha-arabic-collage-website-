import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Button, Card, ErrorNote, Field, Input, Loading, Select, Tabs, Textarea, useAsync, useLang } from '../ui';
import { query, rpc, updateRow } from '../../../lib/erp/rpc';
import { STAFF_ROLES, toOptions } from '../../../lib/erp/campusApi';
import { ChipMultiSelect, KeyValue, WideModal } from './common';
import { useAction } from './hooks';
import { printRecord } from '../../../lib/printReport';

const HR_EMPTY = {
  department: '', job_title: '', employment_type: 'permanent', employment_start: '', employment_end: '', status: 'active',
  national_id: '', epf_no: '', bank_name: '', bank_branch: '', bank_account_no: '', emergency_contact: '', emergency_phone: '', notes: '',
};
const EMP_TYPES = ['permanent', 'contract', 'part_time', 'visiting', 'volunteer'];
const HR_STATUSES = ['active', 'on_leave', 'resigned', 'terminated'];

function HrForm({ employee, canEdit, onSaved }) {
  const { t, lang } = useLang();
  const printProfile = () => {
    const v = state.data || {};
    const roles = [employee.assigned_tutor_role, ...(employee.extra_roles || [])].filter((r) => r && r !== 'none');
    try {
      printRecord({
        title: t('Staff record', 'سجل الموظف'),
        subtitle: `${employee.full_name || ''}${v.employee_no ? ` · ${v.employee_no}` : ''}`,
        dir: document.documentElement.dir || 'ltr',
        lang,
        sections: [
          { title: t('Employee', 'الموظف'), items: [
            [t('Name', 'الاسم'), employee.full_name], [t('Employee no.', 'رقم الموظف'), v.employee_no],
            [t('Account type', 'نوع الحساب'), employee.account_type], [t('Roles', 'الأدوار'), roles.join(', ')],
            [t('Department', 'القسم'), v.department], [t('Job title', 'المسمى الوظيفي'), v.job_title],
            [t('Employment type', 'نوع التوظيف'), v.employment_type], [t('Status', 'الحالة'), v.status],
            [t('Start date', 'تاريخ البدء'), v.employment_start], [t('End date', 'تاريخ الانتهاء'), v.employment_end],
          ] },
          { title: t('Contact', 'الاتصال'), items: [
            [t('Phone', 'الهاتف'), employee.phone], [t('Email', 'البريد الإلكتروني'), employee.email],
            [t('Emergency contact', 'جهة اتصال الطوارئ'), v.emergency_contact], [t('Emergency phone', 'هاتف الطوارئ'), v.emergency_phone],
          ] },
          { title: t('Statutory & bank', 'البيانات الرسمية والبنكية'), items: [
            [t('National ID (NIC)', 'رقم الهوية'), v.national_id], [t('EPF no.', 'رقم EPF'), v.epf_no],
            [t('Bank', 'البنك'), v.bank_name], [t('Branch', 'الفرع'), v.bank_branch], [t('Account no.', 'رقم الحساب'), v.bank_account_no],
          ] },
        ],
        signatures: [t('HR manager', 'مدير الموارد البشرية'), t('Principal', 'المدير')],
      });
    } catch (err) {
      window.alert(err.message);
    }
  };
  const [busy, run] = useAction();
  const [state, reload] = useAsync(() => query('staff_hr', (q) => q.select('*').eq('profile_id', employee.id).maybeSingle()), [employee.id]);
  const [form, setForm] = useState(HR_EMPTY);
  useEffect(() => {
    const next = { ...HR_EMPTY };
    if (state.data) Object.keys(HR_EMPTY).forEach((k) => { next[k] = state.data[k] ?? ''; });
    setForm(next);
  }, [state.data]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    const row = { profile_id: employee.id };
    Object.entries(form).forEach(([k, v]) => { row[k] = v === '' ? null : v; });
    row.employment_type = form.employment_type || 'permanent';
    row.status = form.status || 'active';
    const res = await run(() => query('staff_hr', (q) => q.upsert(row, { onConflict: 'profile_id' }).select().single()), t('Employee record saved', 'تم حفظ سجل الموظف'));
    if (res.ok) {
      reload();
      onSaved?.();
    }
  };
  if (state.loading && !state.data) return <Loading />;
  if (state.error) return <ErrorNote error={state.error} />;
  const f = (k, label, type = 'text') => <Field label={label}><Input type={type} value={form[k] || ''} onChange={set(k)} disabled={!canEdit} /></Field>;
  return (
    <form onSubmit={save} className="space-y-4">
      <p className="text-sm text-gray-400">{t('Employee no.', 'رقم الموظف')}: <b className="text-white">{state.data?.employee_no || t('assigned on first save', 'يُعين عند أول حفظ')}</b></p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {f('department', t('Department', 'القسم'))}
        {f('job_title', t('Job title', 'المسمى الوظيفي'))}
        <Field label={t('Employment type', 'نوع التوظيف')}><Select value={form.employment_type} onChange={set('employment_type')} disabled={!canEdit} options={EMP_TYPES.map((x) => ({ value: x, label: x }))} /></Field>
        {f('employment_start', t('Start date', 'تاريخ البدء'), 'date')}
        {f('employment_end', t('End date', 'تاريخ الانتهاء'), 'date')}
        <Field label={t('Status', 'الحالة')}><Select value={form.status} onChange={set('status')} disabled={!canEdit} options={HR_STATUSES.map((x) => ({ value: x, label: x }))} /></Field>
        {f('national_id', t('National ID (NIC)', 'رقم الهوية'))}
        {f('epf_no', t('EPF no.', 'رقم EPF'))}
        {f('bank_name', t('Bank', 'البنك'))}
        {f('bank_branch', t('Branch', 'الفرع'))}
        {f('bank_account_no', t('Account no.', 'رقم الحساب'))}
        {f('emergency_contact', t('Emergency contact', 'جهة اتصال الطوارئ'))}
        {f('emergency_phone', t('Emergency phone', 'هاتف الطوارئ'), 'tel')}
      </div>
      <Field label={t('Notes', 'ملاحظات')}><Textarea value={form.notes || ''} onChange={set('notes')} disabled={!canEdit} /></Field>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!canEdit && <p className="text-xs text-gray-500 me-auto">{t('Read only — HR managers edit employee records.', 'للقراءة فقط — يحرر مدير الموارد البشرية السجلات.')}</p>}
        <Button type="button" variant="secondary" onClick={printProfile}>{t('Print profile', 'طباعة الملف')}</Button>
        {canEdit && <Button type="submit" disabled={busy}>{t('Save record', 'حفظ السجل')}</Button>}
      </div>
    </form>
  );
}

function RolesForm({ employee, onSaved }) {
  const { t, ar } = useLang();
  const auth = useAuth();
  const [busy, run] = useAction();
  const [primary, setPrimary] = useState(employee.assigned_tutor_role || 'none');
  const [extra, setExtra] = useState(employee.extra_roles || []);
  const [role, setRole] = useState(employee.role || 'user');
  const opts = toOptions(STAFF_ROLES, ar);
  const self = employee.id === auth.user?.id;
  const canRoles = auth.isAdmin;
  const canApprove = auth.isAdmin || auth.isPrincipal || auth.isVP;

  const save = async () => {
    const patch = { assigned_tutor_role: primary };
    if (employee.extra_roles !== undefined) {
      patch.extra_roles = extra.filter((x) => x !== primary);
    }
    if (!self && role !== employee.role) patch.role = role;
    const res = await run(() => updateRow('profiles', employee.id, patch), t('Roles updated', 'تم تحديث الأدوار'));
    if (res.ok) onSaved?.();
  };
  const toggleApproval = async () => {
    const approve = !employee.is_approved;
    if (!approve && !window.confirm(t('Suspend this employee account? They lose ERP access.', 'إيقاف حساب الموظف؟ سيفقد الوصول.'))) return;
    const res = await run(() => rpc('approve_account', { p_profile_id: employee.id, p_approve: approve }), approve ? t('Account approved', 'تم الاعتماد') : t('Account suspended', 'تم الإيقاف'));
    if (res.ok) onSaved?.();
  };

  return (
    <div className="space-y-4">
      {canApprove && (
        <Card title={t('Account access', 'الوصول')}>
          <Button variant={employee.is_approved ? 'danger' : 'primary'} disabled={busy || self} onClick={toggleApproval}>
            {employee.is_approved ? t('Suspend account', 'إيقاف الحساب') : t('Approve account', 'اعتماد الحساب')}
          </Button>
        </Card>
      )}
      <Card title={t('Roles & permissions', 'الأدوار والصلاحيات')}>
        {!canRoles && <p className="text-sm text-amber-300 mb-3">{t('Only organization administrators can change roles.', 'تغيير الأدوار للمسؤولين فقط.')}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <Field label={t('Primary staff role', 'الدور الأساسي')}>
            <Select value={primary} disabled={!canRoles} onChange={(e) => setPrimary(e.target.value)} options={[{ value: 'none', label: t('None', 'لا يوجد') }, ...opts]} />
          </Field>
          <Field label={t('System role', 'دور النظام')} hint={self ? t('You cannot change your own system role.', 'لا يمكنك تغيير دورك.') : null}>
            <Select value={role} disabled={!canRoles || self || employee.role === 'super_admin'} onChange={(e) => setRole(e.target.value)} options={[
              { value: 'user', label: t('Standard user', 'مستخدم') },
              { value: 'librarian', label: t('Librarian', 'أمين مكتبة') },
              { value: 'admin', label: t('Organization admin', 'مسؤول المؤسسة') },
              ...(employee.role === 'super_admin' ? [{ value: 'super_admin', label: 'super_admin' }] : []),
            ]} />
          </Field>
        </div>
        <Field label={t('Additional roles', 'أدوار إضافية')}>
          <ChipMultiSelect disabled={!canRoles} options={opts.filter((o) => o.value !== primary)} value={extra} onChange={setExtra} />
        </Field>
        {canRoles && <div className="flex justify-end mt-3"><Button disabled={busy} onClick={save}>{t('Save roles', 'حفظ الأدوار')}</Button></div>}
      </Card>
    </div>
  );
}

export default function StaffRecord({ employee, onClose, onChanged }) {
  const { t } = useLang();
  const auth = useAuth();
  const [tab, setTab] = useState('hr');
  return (
    <WideModal open title={employee.full_name || employee.email} onClose={onClose}>
      <KeyValue items={[
        [t('E-mail', 'البريد'), employee.email],
        [t('Phone', 'الهاتف'), employee.phone],
        [t('Type', 'النوع'), employee.account_type],
        [t('Approved', 'معتمد'), employee.is_approved ? t('Yes', 'نعم') : t('No', 'لا')],
      ]} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'hr', label: t('Employee record', 'سجل الموظف') },
        { id: 'roles', label: t('Roles & access', 'الأدوار والوصول') },
      ]} />
      {tab === 'hr' && <HrForm employee={employee} canEdit={auth.isHrStaff} onSaved={onChanged} />}
      {tab === 'roles' && <RolesForm employee={employee} onSaved={onChanged} />}
    </WideModal>
  );
}
