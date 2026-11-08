import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { AsyncView, Badge, Button, Card, ErrorNote, Field, Input, Loading, Select, Stat, StatusBadge, Table, Tabs, Textarea, useAsync, useLang } from '../ui';
import { formatDate, formatMoney, query, rpc, updateRow } from '../../../lib/erp/rpc';
import { classOptions } from '../../../lib/erp/campusApi';
import { KeyValue, WideModal } from './common';
import { useAction } from './hooks';
import { printRecord } from '../../../lib/printReport';

const EMPTY = {
  admission_no: '', admission_date: '', date_of_birth: '', gender: '', nationality: 'Sri Lankan', national_id: '',
  address: '', city: '', guardian_name: '', guardian_relationship: '', guardian_phone: '', guardian_email: '',
  emergency_contact: '', blood_group: '', medical_notes: '', previous_school: '', status: 'active', status_reason: '',
};
const STATUSES = ['active', 'suspended', 'graduated', 'withdrawn', 'transferred', 'alumni'];

function DetailsForm({ student, canEdit, onSaved }) {
  const { t, lang } = useLang();
  const [busy, run] = useAction();
  const [state, reload] = useAsync(
    () => query('student_details', (q) => q.select('*').eq('profile_id', student.id).maybeSingle()),
    [student.id]
  );
  const [form, setForm] = useState(EMPTY);
  useEffect(() => {
    if (state.data) {
      const next = { ...EMPTY };
      Object.keys(EMPTY).forEach((k) => {
        next[k] = state.data[k] ?? '';
      });
      setForm(next);
    } else if (!state.loading) setForm(EMPTY);
  }, [state.data, state.loading]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    const row = { profile_id: student.id };
    Object.entries(form).forEach(([k, v]) => {
      row[k] = v === '' ? null : v;
    });
    row.status = form.status || 'active';
    const res = await run(
      () => query('student_details', (q) => q.upsert(row, { onConflict: 'profile_id' }).select().single()),
      t('Student record saved', 'تم حفظ سجل الطالب')
    );
    if (res.ok) {
      reload();
      onSaved?.();
    }
  };

  if (state.loading && !state.data) return <Loading />;
  if (state.error) return <ErrorNote error={state.error} />;
  const f = (k, label, type = 'text') => (
    <Field label={label}>
      <Input type={type} value={form[k] || ''} onChange={set(k)} disabled={!canEdit} />
    </Field>
  );
  return (
    <form onSubmit={save} className="space-y-4">
      {!state.data && <p className="text-sm text-amber-300">{t('No student record yet — fill in and save to create it.', 'لا يوجد سجل بعد — املأ واحفظ لإنشائه.')}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {f('admission_no', t('Admission no.', 'رقم القبول'))}
        {f('admission_date', t('Admission date', 'تاريخ القبول'), 'date')}
        {f('date_of_birth', t('Date of birth', 'تاريخ الميلاد'), 'date')}
        <Field label={t('Gender', 'الجنس')}>
          <Select value={form.gender || ''} onChange={set('gender')} disabled={!canEdit} placeholder="—"
            options={[{ value: 'male', label: t('Male', 'ذكر') }, { value: 'female', label: t('Female', 'أنثى') }]} />
        </Field>
        {f('nationality', t('Nationality', 'الجنسية'))}
        {f('national_id', t('National ID / birth cert.', 'رقم الهوية'))}
        {f('address', t('Address', 'العنوان'))}
        {f('city', t('City', 'المدينة'))}
        {f('previous_school', t('Previous school', 'المدرسة السابقة'))}
        {f('guardian_name', t('Guardian name', 'اسم ولي الأمر'))}
        {f('guardian_relationship', t('Relationship', 'صلة القرابة'))}
        {f('guardian_phone', t('Guardian phone', 'هاتف ولي الأمر'), 'tel')}
        {f('guardian_email', t('Guardian e-mail', 'بريد ولي الأمر'), 'email')}
        {f('emergency_contact', t('Emergency contact', 'جهة اتصال الطوارئ'))}
        {f('blood_group', t('Blood group', 'فصيلة الدم'))}
        <Field label={t('Status', 'الحالة')}>
          <Select value={form.status} onChange={set('status')} disabled={!canEdit} options={STATUSES.map((s) => ({ value: s, label: s }))} />
        </Field>
        {f('status_reason', t('Status reason', 'سبب الحالة'))}
      </div>
      <Field label={t('Medical notes', 'ملاحظات طبية')}>
        <Textarea value={form.medical_notes || ''} onChange={set('medical_notes')} disabled={!canEdit} />
      </Field>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!canEdit && (
          <p className="text-xs text-gray-500 me-auto">{t('Read only — editing requires academic or admissions staff.', 'للقراءة فقط — التعديل لطاقم الشؤون الأكاديمية أو القبول.')}</p>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            const v = state.data || {};
            try {
              printRecord({
                title: t('Student profile', 'ملف الطالب'),
                subtitle: `${student.full_name || ''} · ${student.index_number || ''}`,
                dir: document.documentElement.dir || 'ltr',
                lang,
                sections: [
                  { title: t('Student', 'الطالب'), items: [
                    [t('Name', 'الاسم'), student.full_name], [t('Index no.', 'رقم القيد'), student.index_number],
                    [t('Class', 'الصف'), student.class_number], [t('Status', 'الحالة'), v.status || 'active'],
                    [t('Admission no.', 'رقم القبول'), v.admission_no], [t('Admission date', 'تاريخ القبول'), v.admission_date],
                    [t('Date of birth', 'تاريخ الميلاد'), v.date_of_birth], [t('Gender', 'الجنس'), v.gender],
                    [t('Nationality', 'الجنسية'), v.nationality], [t('National ID / birth cert.', 'رقم الهوية'), v.national_id],
                    [t('Blood group', 'فصيلة الدم'), v.blood_group], [t('Previous school', 'المدرسة السابقة'), v.previous_school],
                  ] },
                  { title: t('Contact', 'الاتصال'), items: [
                    [t('Phone', 'الهاتف'), student.phone], [t('Email', 'البريد الإلكتروني'), student.email],
                    [t('Address', 'العنوان'), v.address], [t('City', 'المدينة'), v.city],
                  ] },
                  { title: t('Guardian', 'ولي الأمر'), items: [
                    [t('Guardian name', 'اسم ولي الأمر'), v.guardian_name], [t('Relationship', 'صلة القرابة'), v.guardian_relationship],
                    [t('Guardian phone', 'هاتف ولي الأمر'), v.guardian_phone], [t('Guardian e-mail', 'بريد ولي الأمر'), v.guardian_email],
                    [t('Emergency contact', 'جهة اتصال الطوارئ'), v.emergency_contact],
                  ] },
                  { title: t('Medical notes', 'ملاحظات طبية'), items: [[t('Medical notes', 'ملاحظات طبية'), v.medical_notes]] },
                ],
                signatures: [t('Class tutor', 'معلم الصف'), t('Principal', 'المدير')],
              });
            } catch (err) {
              window.alert(err.message);
            }
          }}
        >
          {t('Print profile', 'طباعة الملف')}
        </Button>
        {canEdit && <Button type="submit" disabled={busy}>{t('Save record', 'حفظ السجل')}</Button>}
      </div>
    </form>
  );
}

function Enrolments({ student }) {
  const { t } = useLang();
  const [state] = useAsync(
    () => query('student_enrollments', (q) => q.select('*, academic_years(name)').eq('student_id', student.id).order('enrolled_on', { ascending: false })),
    [student.id]
  );
  return (
    <AsyncView state={state}>
      {(rows) => (
        <Table rows={rows} empty={t('No enrolments.', 'لا يوجد تسجيل.')} columns={[
          { key: 'year', label: t('Academic year', 'العام الدراسي'), render: (r) => r.academic_years?.name },
          { key: 'class_number', label: t('Class', 'الصف') },
          { key: 'section', label: t('Section', 'الشعبة') },
          { key: 'roll_no', label: t('Roll', 'الرقم') },
          { key: 'status', label: t('Status', 'الحالة'), render: (r) => <StatusBadge status={r.status} /> },
          { key: 'enrolled_on', label: t('Enrolled', 'التسجيل'), render: (r) => formatDate(r.enrolled_on) },
          { key: 'left_on', label: t('Left', 'المغادرة'), render: (r) => formatDate(r.left_on) },
        ]} />
      )}
    </AsyncView>
  );
}

function AttendanceAndResults({ student }) {
  const { t } = useLang();
  const [att] = useAsync(() => rpc('attendance_summary', { p_student: student.id }), [student.id]);
  const [res] = useAsync(
    () => query('student_results', (q) => q.select('id, exam_name, subject, marks_obtained, max_marks, grade, remarks, created_at').eq('student_id', student.id).order('created_at', { ascending: false }).limit(200)),
    [student.id]
  );
  return (
    <div className="space-y-4">
      <AsyncView state={att}>
        {(a) => (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Stat label={t('Rate', 'النسبة')} value={a?.rate != null ? `${a.rate}%` : '—'} />
            <Stat label={t('Present', 'حاضر')} value={a?.present ?? 0} />
            <Stat label={t('Late', 'متأخر')} value={a?.late ?? 0} tone="amber" />
            <Stat label={t('Absent', 'غائب')} value={a?.absent ?? 0} tone="red" />
            <Stat label={t('Excused', 'بعذر')} value={a?.excused ?? 0} tone="blue" />
            <Stat label={t('Days', 'الأيام')} value={a?.total ?? 0} tone="gray" />
          </div>
        )}
      </AsyncView>
      <AsyncView state={res}>
        {(rows) => (
          <Table rows={rows} empty={t('No results recorded.', 'لا توجد نتائج.')} columns={[
            { key: 'exam_name', label: t('Exam', 'الامتحان') },
            { key: 'subject', label: t('Subject', 'المادة') },
            { key: 'marks', label: t('Marks', 'الدرجات'), render: (r) => `${r.marks_obtained} / ${r.max_marks}` },
            { key: 'grade', label: t('Grade', 'التقدير'), render: (r) => <Badge tone={r.grade === 'F' ? 'red' : 'green'}>{r.grade}</Badge> },
            { key: 'remarks', label: t('Remarks', 'ملاحظات') },
          ]} />
        )}
      </AsyncView>
    </div>
  );
}

function Fees({ student }) {
  const { t } = useLang();
  const [, setParams] = useSearchParams();
  const [state] = useAsync(
    () => query('student_fees', (q) => q.select('id, month, total_due, paid_amount, status').eq('student_id', student.id).order('month', { ascending: false }).limit(24)),
    [student.id]
  );
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="secondary" onClick={() => setParams({ module: 'fees', student: student.id })}>
          {t('Open full fee statement', 'فتح كشف الرسوم الكامل')} →
        </Button>
      </div>
      <AsyncView state={state}>
        {(rows) => (
          <Table rows={rows} empty={t('No invoices.', 'لا توجد فواتير.')} columns={[
            { key: 'month', label: t('Month', 'الشهر') },
            { key: 'total_due', label: t('Due', 'المستحق'), render: (r) => formatMoney(r.total_due) },
            { key: 'paid_amount', label: t('Paid', 'المدفوع'), render: (r) => formatMoney(r.paid_amount) },
            { key: 'bal', label: t('Balance', 'الرصيد'), render: (r) => formatMoney(Number(r.total_due) - Number(r.paid_amount)) },
            { key: 'status', label: t('Status', 'الحالة'), render: (r) => <StatusBadge status={r.status} /> },
          ]} />
        )}
      </AsyncView>
    </div>
  );
}

function AdminControls({ student, onChanged }) {
  const { t } = useLang();
  const auth = useAuth();
  const [busy, run] = useAction();
  const [cls, setCls] = useState(student.class_number ? String(student.class_number) : '');
  const canApprove = auth.isAdmin || auth.isPrincipal || auth.isVP;
  if (!canApprove) {
    return <p className="text-sm text-gray-500">{t('Only administrators, the principal or vice principal can change account approval.', 'يمكن للمسؤول أو المدير أو نائبه فقط تغيير اعتماد الحساب.')}</p>;
  }
  const toggleApproval = async () => {
    const approve = !student.is_approved;
    if (!approve && !window.confirm(t('Revoke approval? The student will lose portal access.', 'إلغاء الاعتماد؟ سيفقد الطالب الوصول.'))) return;
    const res = await run(() => rpc('approve_account', { p_profile_id: student.id, p_approve: approve }), approve ? t('Approved', 'تم الاعتماد') : t('Approval revoked', 'تم إلغاء الاعتماد'));
    if (res.ok) onChanged?.();
  };
  const saveClass = async () => {
    const res = await run(() => updateRow('profiles', student.id, { class_number: cls ? Number(cls) : null }), t('Class updated', 'تم تحديث الصف'));
    if (res.ok) onChanged?.();
  };
  return (
    <Card title={t('Account controls', 'إعدادات الحساب')}>
      <div className="flex flex-wrap items-end gap-3">
        <Button variant={student.is_approved ? 'danger' : 'primary'} disabled={busy} onClick={toggleApproval}>
          {student.is_approved ? t('Revoke approval', 'إلغاء الاعتماد') : t('Approve account', 'اعتماد الحساب')}
        </Button>
        {auth.isAdmin && (
          <>
            <div className="w-40">
              <Field label={t('Current class', 'الصف الحالي')}>
                <Select value={cls} onChange={(e) => setCls(e.target.value)} options={classOptions(t)} placeholder="—" />
              </Field>
            </div>
            <Button variant="secondary" disabled={busy} onClick={saveClass}>{t('Save class', 'حفظ الصف')}</Button>
          </>
        )}
      </div>
    </Card>
  );
}

export default function StudentDetail({ student, onClose, onChanged }) {
  const { t } = useLang();
  const auth = useAuth();
  const [tab, setTab] = useState('record');
  if (!student) return null;
  const canEdit = auth.isAcademicAdmin || auth.isAdmissionsStaff;
  return (
    <WideModal open title={student.full_name || student.email} onClose={onClose}>
      <KeyValue items={[
        [t('Index', 'الرقم'), student.index_number],
        [t('Class', 'الصف'), student.class_number],
        [t('E-mail', 'البريد'), student.email],
        [t('Phone', 'الهاتف'), student.phone],
        [t('Approval', 'الاعتماد'), student.is_approved ? t('Approved', 'معتمد') : t('Pending', 'معلق')],
        [t('Registered', 'التسجيل'), formatDate(student.created_at)],
      ]} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'record', label: t('Student record', 'سجل الطالب') },
        { id: 'enrol', label: t('Enrolments', 'التسجيلات') },
        { id: 'perf', label: t('Attendance & results', 'الحضور والنتائج') },
        { id: 'fees', label: t('Fees', 'الرسوم') },
        { id: 'account', label: t('Account', 'الحساب') },
      ]} />
      {tab === 'record' && <DetailsForm student={student} canEdit={canEdit} onSaved={onChanged} />}
      {tab === 'enrol' && <Enrolments student={student} />}
      {tab === 'perf' && <AttendanceAndResults student={student} />}
      {tab === 'fees' && <Fees student={student} />}
      {tab === 'account' && (
        <AdminControls student={student} onChanged={onChanged} />
      )}
    </WideModal>
  );
}
