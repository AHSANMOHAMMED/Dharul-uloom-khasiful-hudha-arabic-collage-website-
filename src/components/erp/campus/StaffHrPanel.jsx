import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { AsyncView, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, StatusBadge, Table, Tabs, useAsync, useLang } from '../ui';
import { deleteRow, downloadCsv, formatDate, insertRow, query, rpc, today, updateRow } from '../../../lib/erp/rpc';
import { useAction } from './hooks';
import StaffRecord from './StaffRecord';

const ATT = ['present', 'half_day', 'leave', 'absent', 'holiday'];
const ATT_LABEL = { present: ['Present', 'حاضر'], half_day: ['Half day', 'نصف يوم'], leave: ['Leave', 'إجازة'], absent: ['Absent', 'غائب'], holiday: ['Holiday', 'عطلة'] };

function Directory() {
  const { t } = useLang();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [state, reload] = useAsync(
    () => query('profiles', (b) =>
      b.select('id, full_name, email, phone, account_type, role, is_approved, assigned_tutor_role, created_at, staff_hr(employee_no, department, job_title, status, employment_type)')
        .in('account_type', ['tutor', 'staff']).order('full_name')),
    []
  );
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (state.data || []).filter((p) => {
      if (type && p.account_type !== type) return false;
      if (!needle) return true;
      const hr = Array.isArray(p.staff_hr) ? p.staff_hr[0] : p.staff_hr;
      return [p.full_name, p.email, p.phone, hr?.employee_no, hr?.department, hr?.job_title].some((v) => (v || '').toLowerCase().includes(needle));
    });
  }, [state.data, q, type]);
  const hrOf = (p) => (Array.isArray(p.staff_hr) ? p.staff_hr[0] : p.staff_hr) || null;
  const selected = (state.data || []).find((p) => p.id === selectedId);
  const exportCsv = () => downloadCsv('employees.csv', rows.map((p) => {
    const hr = hrOf(p) || {};
    return { employee_no: hr.employee_no, name: p.full_name, email: p.email, phone: p.phone, type: p.account_type, department: hr.department, job_title: hr.job_title, status: hr.status, roles: [p.assigned_tutor_role, ...(p.extra_roles || [])].filter((x) => x && x !== 'none').join(' ') };
  }));
  return (
    <Card title={`${t('Employees', 'الموظفون')} (${rows.length})`} actions={<><Button size="sm" variant="secondary" onClick={exportCsv} disabled={!rows.length}>{t('CSV', 'CSV')}</Button><Button size="sm" variant="secondary" onClick={reload}>{t('Refresh', 'تحديث')}</Button></>}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search name, no., department…', 'ابحث…')} />
        <Select value={type} onChange={(e) => setType(e.target.value)} placeholder={t('Tutors & staff', 'المعلمون والموظفون')} options={[
          { value: 'tutor', label: t('Tutors', 'المعلمون') }, { value: 'staff', label: t('Non-teaching staff', 'الموظفون') },
        ]} />
      </div>
      <AsyncView state={state}>
        {() => (
          <Table rows={rows} empty={t('No employees.', 'لا يوجد موظفون.')} columns={[
            { key: 'no', label: t('No.', 'الرقم'), render: (p) => hrOf(p)?.employee_no || '—' },
            { key: 'full_name', label: t('Name', 'الاسم'), render: (p) => <button type="button" className="text-emerald-300 hover:underline text-start" onClick={() => setSelectedId(p.id)}>{p.full_name || p.email}</button> },
            { key: 'account_type', label: t('Type', 'النوع') },
            { key: 'job', label: t('Department / title', 'القسم / المسمى'), render: (p) => [hrOf(p)?.department, hrOf(p)?.job_title].filter(Boolean).join(' · ') || '—' },
            { key: 'roles', label: t('Roles', 'الأدوار'), render: (p) => (
              <div className="flex flex-wrap gap-1">
                {p.role !== 'user' && <Badge tone="red">{p.role}</Badge>}
                {p.assigned_tutor_role && p.assigned_tutor_role !== 'none' && <Badge tone="blue">{p.assigned_tutor_role}</Badge>}
                {(p.extra_roles || []).map((r) => <Badge key={r}>{r}</Badge>)}
              </div>
            ) },
            { key: 'status', label: t('Status', 'الحالة'), render: (p) => (hrOf(p) ? <StatusBadge status={hrOf(p).status} /> : <Badge>{t('no record', 'بدون سجل')}</Badge>) },
            { key: 'is_approved', label: t('Access', 'الوصول'), render: (p) => (p.is_approved ? <Badge tone="green">{t('approved', 'معتمد')}</Badge> : <Badge tone="amber">{t('pending', 'معلق')}</Badge>) },
          ]} />
        )}
      </AsyncView>
      {selected && <StaffRecord key={selected.id} employee={selected} onClose={() => setSelectedId(null)} onChanged={reload} />}
    </Card>
  );
}

function AttendanceRegister() {
  const { t } = useLang();
  const auth = useAuth();
  const [busy, run] = useAction();
  const [date, setDate] = useState(today());
  const [marks, setMarks] = useState({});
  const [state, reload] = useAsync(async () => {
    const [emps, att] = await Promise.all([
      query('profiles', (q) => q.select('id, full_name, account_type').in('account_type', ['tutor', 'staff']).eq('is_approved', true).order('full_name')),
      query('staff_attendance', (q) => q.select('*').eq('date', date)),
    ]);
    return { emps, att };
  }, [date]);
  useEffect(() => {
    const by = Object.fromEntries((state.data?.att || []).map((a) => [a.profile_id, a]));
    setMarks(Object.fromEntries((state.data?.emps || []).map((e) => [e.id, { status: by[e.id]?.status || '', note: by[e.id]?.note || '', check_in: by[e.id]?.check_in, check_out: by[e.id]?.check_out }])));
  }, [state.data]);
  const save = async () => {
    const rows = Object.entries(marks).filter(([, v]) => v.status).map(([profile_id, v]) => ({ profile_id, date, status: v.status, note: v.note || null, marked_by: auth.user?.id }));
    if (!rows.length) return;
    const res = await run(() => query('staff_attendance', (q) => q.upsert(rows, { onConflict: 'profile_id,date' }).select('id')), (r) => `${r?.length ?? rows.length} ${t('records saved', 'سجل محفوظ')}`);
    if (res.ok) reload();
  };
  const fillPresent = () => setMarks((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { ...v, status: v.status || 'present' }])));
  return (
    <Card title={t('Staff attendance register', 'سجل حضور الموظفين')}>
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div className="w-48"><Field label={t('Date', 'التاريخ')}><Input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} /></Field></div>
        <Button variant="secondary" onClick={fillPresent}>{t('Mark unmarked as present', 'تحديد غير المسجلين كحاضرين')}</Button>
        <Button disabled={busy} onClick={save}>{t('Save register', 'حفظ السجل')}</Button>
      </div>
      <p className="text-xs text-gray-500 mb-3">{t('Absences and half days reduce pay in the payroll run.', 'الغياب ونصف اليوم يخصمان من الراتب.')}</p>
      <AsyncView state={state}>
        {(d) => (
          <Table rows={d.emps} empty={t('No employees.', 'لا يوجد موظفون.')} columns={[
            { key: 'full_name', label: t('Employee', 'الموظف') },
            { key: 'times', label: t('In / out', 'دخول / خروج'), render: (e) => `${marks[e.id]?.check_in || '—'} / ${marks[e.id]?.check_out || '—'}` },
            { key: 'status', label: t('Status', 'الحالة'), render: (e) => (
              <div className="flex flex-wrap gap-1">
                {ATT.map((s) => (
                  <button key={s} type="button" onClick={() => setMarks((m) => ({ ...m, [e.id]: { ...m[e.id], status: s } }))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${marks[e.id]?.status === s ? 'bg-emerald-700 border-emerald-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'}`}>
                    {t(...ATT_LABEL[s])}
                  </button>
                ))}
              </div>
            ) },
            { key: 'note', label: t('Note', 'ملاحظة'), render: (e) => <div className="min-w-[160px]"><Input value={marks[e.id]?.note || ''} onChange={(ev) => setMarks((m) => ({ ...m, [e.id]: { ...m[e.id], note: ev.target.value } }))} /></div> },
          ]} />
        )}
      </AsyncView>
    </Card>
  );
}

function LeaveQueue() {
  const { t } = useLang();
  const auth = useAuth();
  const [busy, run] = useAction();
  const [status, setStatus] = useState('pending');
  const [state, reload] = useAsync(
    () => query('staff_leave_requests', (q) =>
      q.select('*, staff:profiles!profile_id(full_name), staff_leave_types(name, is_paid), reviewer:profiles!reviewed_by(full_name)')
        .eq('status', status).order('start_date', { ascending: status !== 'pending' ? false : true }).limit(500)),
    [status]
  );
  const review = async (r, approve) => {
    const note = window.prompt(approve ? t('Approval note (optional):', 'ملاحظة الموافقة (اختياري):') : t('Reason for rejection:', 'سبب الرفض:'), '');
    if (note === null) return;
    const res = await run(() => rpc('review_staff_leave', { p_request: r.id, p_approve: approve, p_note: note || null }), approve ? t('Leave approved', 'تمت الموافقة') : t('Leave rejected', 'تم الرفض'));
    if (res.ok) reload();
  };
  return (
    <Card title={t('Leave requests', 'طلبات الإجازة')} actions={
      <div className="w-40"><Select value={status} onChange={(e) => setStatus(e.target.value)} options={['pending', 'approved', 'rejected', 'cancelled'].map((s) => ({ value: s, label: s }))} /></div>
    }>
      <AsyncView state={state}>
        {(rows) => (
          <Table rows={rows} empty={t('No requests.', 'لا توجد طلبات.')} columns={[
            { key: 'staff', label: t('Employee', 'الموظف'), render: (r) => r.staff?.full_name },
            { key: 'type', label: t('Type', 'النوع'), render: (r) => <span>{r.staff_leave_types?.name}{r.staff_leave_types && !r.staff_leave_types.is_paid && <span className="text-xs text-amber-400 ms-1">({t('unpaid', 'غير مدفوعة')})</span>}</span> },
            { key: 'dates', label: t('Dates', 'التواريخ'), render: (r) => `${formatDate(r.start_date)} → ${formatDate(r.end_date)}` },
            { key: 'days', label: t('Days', 'الأيام') },
            { key: 'reason', label: t('Reason', 'السبب') },
            { key: 'review', label: t('Review', 'المراجعة'), render: (r) => (r.reviewed_at ? `${r.reviewer?.full_name || ''} · ${r.review_note || ''}` : '—') },
            { key: 'act', label: '', render: (r) => (r.status === 'pending' ? (
              <div className="flex gap-2">
                <Button size="sm" disabled={busy || r.profile_id === auth.user?.id} onClick={() => review(r, true)}>{t('Approve', 'موافقة')}</Button>
                <Button size="sm" variant="danger" disabled={busy || r.profile_id === auth.user?.id} onClick={() => review(r, false)}>{t('Reject', 'رفض')}</Button>
              </div>
            ) : null) },
          ]} />
        )}
      </AsyncView>
    </Card>
  );
}

function LeaveTypes({ canEdit }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [modal, setModal] = useState(null);
  const [state, reload] = useAsync(() => query('staff_leave_types', (q) => q.select('*').order('code')), []);
  const save = async () => {
    const row = { code: modal.code.trim().toUpperCase(), name: modal.name.trim(), days_per_year: Number(modal.days_per_year) || 0, is_paid: Boolean(modal.is_paid), is_active: Boolean(modal.is_active) };
    const res = await run(() => (modal.id ? updateRow('staff_leave_types', modal.id, row) : insertRow('staff_leave_types', row)), t('Leave type saved', 'تم الحفظ'));
    if (res.ok) {
      setModal(null);
      reload();
    }
  };
  const remove = async (r) => {
    if (!window.confirm(t(`Delete leave type ${r.name}? Types already used cannot be deleted — deactivate them instead.`, `حذف ${r.name}؟ الأنواع المستخدمة لا تحذف — عطلها بدلًا من ذلك.`))) return;
    const res = await run(() => deleteRow('staff_leave_types', r.id), t('Deleted', 'تم الحذف'));
    if (res.ok) reload();
  };
  return (
    <Card title={t('Leave types', 'أنواع الإجازات')} actions={canEdit && <Button onClick={() => setModal({ code: '', name: '', days_per_year: '0', is_paid: true, is_active: true })}>{t('New type', 'نوع جديد')}</Button>}>
      <AsyncView state={state}>
        {(rows) => (
          <Table rows={rows} empty={t('No leave types.', 'لا توجد أنواع.')} columns={[
            { key: 'code', label: t('Code', 'الرمز') },
            { key: 'name', label: t('Name', 'الاسم') },
            { key: 'days_per_year', label: t('Days / year', 'أيام / سنة') },
            { key: 'is_paid', label: t('Paid', 'مدفوعة'), render: (r) => (r.is_paid ? <Badge tone="green">{t('paid', 'مدفوعة')}</Badge> : <Badge tone="amber">{t('unpaid', 'غير مدفوعة')}</Badge>) },
            { key: 'is_active', label: t('Active', 'نشط'), render: (r) => (r.is_active ? '✓' : '—') },
            { key: 'act', label: '', render: (r) => canEdit && (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setModal({ ...r, days_per_year: String(r.days_per_year) })}>{t('Edit', 'تعديل')}</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove(r)}>{t('Delete', 'حذف')}</Button>
              </div>
            ) },
          ]} />
        )}
      </AsyncView>
      <Modal open={Boolean(modal)} title={t('Leave type', 'نوع الإجازة')} onClose={() => setModal(null)}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>{t('Cancel', 'إلغاء')}</Button><Button disabled={busy || !modal?.code || !modal?.name} onClick={save}>{t('Save', 'حفظ')}</Button></>}>
        {modal && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Code', 'الرمز')}><Input value={modal.code} onChange={(e) => setModal({ ...modal, code: e.target.value })} /></Field>
            <Field label={t('Days per year', 'أيام في السنة')}><Input type="number" step="0.5" min="0" value={modal.days_per_year} onChange={(e) => setModal({ ...modal, days_per_year: e.target.value })} /></Field>
            <div className="col-span-2"><Field label={t('Name', 'الاسم')}><Input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} /></Field></div>
            <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" className="accent-emerald-600" checked={Boolean(modal.is_paid)} onChange={(e) => setModal({ ...modal, is_paid: e.target.checked })} />{t('Paid leave', 'إجازة مدفوعة')}</label>
            <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" className="accent-emerald-600" checked={Boolean(modal.is_active)} onChange={(e) => setModal({ ...modal, is_active: e.target.checked })} />{t('Active', 'نشط')}</label>
          </div>
        )}
      </Modal>
    </Card>
  );
}

export default function StaffHrPanel() {
  const { t } = useLang();
  const auth = useAuth();
  const [tab, setTab] = useState('directory');
  return (
    <div>
      <PageHeader title={t('HR & staff', 'الموارد البشرية')} subtitle={t('Employee records, roles, attendance and leave.', 'سجلات الموظفين والأدوار والحضور والإجازات.')} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'directory', label: t('Employees', 'الموظفون') },
        { id: 'attendance', label: t('Attendance register', 'سجل الحضور') },
        { id: 'leave', label: t('Leave requests', 'طلبات الإجازة') },
        { id: 'types', label: t('Leave types', 'أنواع الإجازات') },
      ]} />
      {tab === 'directory' && <Directory />}
      {tab === 'attendance' && <AttendanceRegister />}
      {tab === 'leave' && <LeaveQueue />}
      {tab === 'types' && <LeaveTypes canEdit={auth.isHrStaff} />}
    </div>
  );
}
