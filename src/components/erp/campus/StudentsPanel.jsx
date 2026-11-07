import { useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { AsyncView, Badge, Button, Card, Input, PageHeader, Select, StatusBadge, Table, Tabs, useAsync, useLang } from '../ui';
import { downloadCsv, query } from '../../../lib/erp/rpc';
import { ClassSelect } from './common';
import StudentDetail from './StudentDetail';
import StudentEnrolment from './StudentEnrolment';
import { ApprovalsTab, IndexNumbersTab, ParentLinksTab } from './StudentAdminTabs';

function Directory() {
  const { t } = useLang();
  const [q, setQ] = useState('');
  const [cls, setCls] = useState('');
  const [approval, setApproval] = useState('');
  const [selected, setSelected] = useState(null);
  const [state, reload] = useAsync(
    () =>
      query('profiles', (b) =>
        b.select('id, full_name, email, phone, index_number, class_number, is_approved, created_at, student_details(status, admission_no, guardian_phone)')
          .eq('account_type', 'student').order('full_name').limit(5000)
      ),
    []
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (state.data || []).filter((s) => {
      if (cls && String(s.class_number) !== cls) return false;
      if (approval === 'approved' && !s.is_approved) return false;
      if (approval === 'pending' && s.is_approved) return false;
      if (!needle) return true;
      return [s.full_name, s.email, s.index_number, s.phone, s.student_details?.admission_no]
        .some((v) => (v || '').toLowerCase().includes(needle));
    });
  }, [state.data, q, cls, approval]);

  const exportCsv = () =>
    downloadCsv('students.csv', rows.map((s) => ({
      name: s.full_name, index: s.index_number, class: s.class_number, email: s.email, phone: s.phone,
      approved: s.is_approved, status: s.student_details?.status || '', admission_no: s.student_details?.admission_no || '',
    })));

  return (
    <Card
      title={`${t('Student directory', 'دليل الطلاب')} (${rows.length})`}
      actions={<><Button variant="secondary" size="sm" onClick={exportCsv} disabled={!rows.length}>{t('CSV', 'CSV')}</Button><Button variant="secondary" size="sm" onClick={reload}>{t('Refresh', 'تحديث')}</Button></>}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search name, index, e-mail, phone…', 'ابحث بالاسم أو الرقم أو البريد…')} />
        <ClassSelect value={cls} onChange={setCls} allLabel={t('All classes', 'كل الصفوف')} />
        <Select value={approval} onChange={(e) => setApproval(e.target.value)} placeholder={t('Any approval status', 'كل حالات الاعتماد')} options={[
          { value: 'approved', label: t('Approved', 'معتمد') },
          { value: 'pending', label: t('Pending approval', 'بانتظار الاعتماد') },
        ]} />
      </div>
      <AsyncView state={state}>
        {() => (
          <Table rows={rows} empty={t('No students match.', 'لا يوجد طلاب مطابقون.')} columns={[
            { key: 'full_name', label: t('Name', 'الاسم'), render: (r) => (
              <button type="button" className="text-emerald-300 hover:underline text-start" onClick={() => setSelected(r)}>{r.full_name || r.email}</button>
            ) },
            { key: 'index_number', label: t('Index', 'الرقم') },
            { key: 'class_number', label: t('Class', 'الصف') },
            { key: 'phone', label: t('Phone', 'الهاتف'), render: (r) => r.phone || r.student_details?.guardian_phone || '—' },
            { key: 'status', label: t('Record', 'السجل'), render: (r) => (r.student_details ? <StatusBadge status={r.student_details.status} /> : <Badge>{t('no record', 'بدون سجل')}</Badge>) },
            { key: 'is_approved', label: t('Approval', 'الاعتماد'), render: (r) => (r.is_approved ? <Badge tone="green">{t('approved', 'معتمد')}</Badge> : <Badge tone="amber">{t('pending', 'معلق')}</Badge>) },
            { key: 'act', label: '', render: (r) => <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>{t('Open', 'فتح')}</Button> },
          ]} />
        )}
      </AsyncView>
      {selected && (
        <StudentDetail
          student={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            reload();
            setSelected(null);
          }}
        />
      )}
    </Card>
  );
}

export default function StudentsPanel() {
  const { t } = useLang();
  const auth = useAuth();
  const [tab, setTab] = useState('directory');
  const canApprove = auth.isAdmin || auth.isPrincipal || auth.isVP;
  const tabs = [
    { id: 'directory', label: t('Directory', 'الدليل') },
    (canApprove || auth.isAcademicAdmin) && { id: 'approvals', label: t('Approvals', 'الاعتمادات') },
    auth.isAdmissionsStaff && { id: 'index', label: t('Index numbers', 'أرقام القيد') },
    (auth.isAcademicAdmin || auth.isAdmissionsStaff) && { id: 'enrol', label: t('Enrolment & promotion', 'التسجيل والترفيع') },
    auth.isAdmissionsStaff && { id: 'links', label: t('Parent links', 'ربط أولياء الأمور') },
  ].filter(Boolean);
  const active = tabs.find((x) => x.id === tab) ? tab : 'directory';
  return (
    <div>
      <PageHeader title={t('Students', 'الطلاب')} subtitle={t('Records, approvals, enrolment and parent links.', 'السجلات والاعتمادات والتسجيل وربط أولياء الأمور.')} />
      <Tabs tabs={tabs} active={active} onChange={setTab} />
      {active === 'directory' && <Directory />}
      {active === 'approvals' && <ApprovalsTab canApprove={canApprove} />}
      {active === 'index' && <IndexNumbersTab canManage={auth.isAdmissionsStaff} />}
      {active === 'enrol' && <StudentEnrolment canEnroll={auth.isAcademicAdmin || auth.isAdmissionsStaff} canPromote={auth.isAcademicAdmin} />}
      {active === 'links' && <ParentLinksTab canReview={auth.isAdmissionsStaff} />}
    </div>
  );
}
