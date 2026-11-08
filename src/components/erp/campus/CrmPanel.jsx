import { useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { AsyncView, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Stat, Table, Tabs, Textarea, useAsync, useLang } from '../ui';
import { downloadCsv, formatDate, insertRow, query, queryAll, rpc, updateRow } from '../../../lib/erp/rpc';
import { COURSES, CRM_STAGES, LEAD_SOURCES, STAGE_STATUS, labelOf, toOptions } from '../../../lib/erp/campusApi';
import { useAction, useEmployees } from './hooks';
import CrmLeadDetail, { FollowupsTable } from './CrmLeadDetail';
import CrmInvitations from './CrmInvitations';

const LEAD_EMPTY = { student_name: '', age: '', parent_name: '', phone: '', email: '', address: '', previous_education: '', course: 'quran', source: 'walk_in', notes: '' };

function DashboardStrip({ state }) {
  const { t, ar } = useLang();
  return (
    <AsyncView state={state}>
      {(d) => (
        <div className="space-y-3 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label={t('Conversion rate', 'معدل التحويل')} value={d.conversion_rate != null ? `${d.conversion_rate}%` : '—'} />
            <Stat label={t('New (30 days)', 'جديد (30 يومًا)')} value={d.last_30_days ?? 0} tone="blue" />
            <Stat label={t('Follow-ups due today', 'متابعات اليوم')} value={d.followups_due_today ?? 0} tone="amber" />
            <Stat label={t('Overdue follow-ups', 'متابعات متأخرة')} value={d.followups_overdue ?? 0} tone={d.followups_overdue ? 'red' : 'gray'} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(d.by_source || {}).map(([s, n]) => (
              <span key={s} className="rounded-full bg-gray-800 px-3 py-1 text-gray-300">{labelOf(LEAD_SOURCES, s, ar)}: <b className="text-white">{n}</b></span>
            ))}
          </div>
        </div>
      )}
    </AsyncView>
  );
}

function Pipeline({ onChangedStats }) {
  const { t, ar } = useLang();
  const [busy, run] = useAction();
  const [view, setView] = useState('board');
  const [q, setQ] = useState('');
  const [source, setSource] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [newLead, setNewLead] = useState(null);
  const [emps] = useEmployees();
  const employees = emps.data || [];
  const [state, reload] = useAsync(() => queryAll('admissions', (b) => b.select('*').order('created_at', { ascending: false }).order('id'), { pageSize: 300, maxRows: 50000 }), []);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (state.data || []).filter((r) => {
      if (source && r.source !== source) return false;
      if (!needle) return true;
      return [r.student_name, r.parent_name, r.phone, r.email].some((v) => (v || '').toLowerCase().includes(needle));
    });
  }, [state.data, q, source]);
  const selected = (state.data || []).find((r) => r.id === selectedId);

  const refresh = () => {
    reload();
    onChangedStats();
  };

  const quickMove = async (lead, stage) => {
    const from = lead.pipeline_stage || 'submitted';
    if (stage === from) return;
    const res = await run(async () => {
      await updateRow('admissions', lead.id, { pipeline_stage: stage, status: STAGE_STATUS[stage], reviewed_at: new Date().toISOString() });
      await insertRow('admission_status_history', { admission_id: lead.id, from_stage: from, to_stage: stage });
    }, t('Stage updated', 'تم تحديث المرحلة'));
    if (res.ok) refresh();
  };

  const createLead = async () => {
    const age = Number(newLead.age);
    if (!(age >= 5 && age <= 15)) {
      window.alert(t('Age must be between 5 and 15.', 'يجب أن يكون العمر بين 5 و 15.'));
      return;
    }
    const row = {
      student_name: newLead.student_name.trim(), age, parent_name: newLead.parent_name.trim(), phone: newLead.phone.trim(),
      email: newLead.email.trim() || null, address: newLead.address.trim() || '—', previous_education: newLead.previous_education || null,
      course: newLead.course, source: newLead.source, notes: newLead.notes || null, pipeline_stage: 'lead', status: 'lead',
    };
    const res = await run(() => insertRow('admissions', row), t('Lead created', 'تم إنشاء العميل'));
    if (res.ok) {
      setNewLead(null);
      refresh();
      setSelectedId(res.data.id);
    }
  };

  const exportCsv = () => downloadCsv('admissions.csv', rows.map((r) => ({
    student: r.student_name, date_of_birth: r.date_of_birth, age: r.age, parent: r.parent_name, phone: r.phone, email: r.email, course: r.course,
    source: r.source, stage: r.pipeline_stage, created: r.created_at, enrolled_index: r.enrolled_index,
  })));

  const now = Date.now();
  const card = (r) => (
    <div key={r.id} className="rounded-xl bg-gray-950/60 border border-gray-800 hover:border-emerald-500/40 p-3">
      <button type="button" onClick={() => setSelectedId(r.id)} className="w-full text-start">
        <div className="font-semibold text-white text-sm">{r.student_name}</div>
        <div className="text-xs text-gray-400 mt-1">{labelOf(COURSES, r.course, ar)} · {r.parent_name}</div>
        <div className="text-xs text-gray-500">{r.phone}</div>
        <div className="flex flex-wrap gap-1 mt-1">
          <Badge>{labelOf(LEAD_SOURCES, r.source, ar)}</Badge>
          {r.follow_up_at && <Badge tone={new Date(r.follow_up_at).getTime() < now ? 'red' : 'amber'}><span className="material-symbols-outlined text-[12px] align-middle me-0.5">schedule</span>{formatDate(r.follow_up_at)}</Badge>}
        </div>
      </button>
      {r.pipeline_stage !== 'enrolled' && (
        <div className="mt-2">
          <select
            className="w-full rounded-lg bg-gray-900 border border-gray-700 px-2 py-1 text-xs text-gray-300"
            value={r.pipeline_stage || 'submitted'}
            disabled={busy}
            onChange={(e) => quickMove(r, e.target.value)}
            aria-label={t('Move stage', 'نقل المرحلة')}
          >
            {CRM_STAGES.filter((s) => s.value !== 'enrolled').map((s) => <option key={s.value} value={s.value}>{t(s.en, s.ar)}</option>)}
          </select>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="w-64"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search name, phone, e-mail…', 'ابحث…')} /></div>
        <div className="w-44"><Select value={source} onChange={(e) => setSource(e.target.value)} placeholder={t('All sources', 'كل المصادر')} options={toOptions(LEAD_SOURCES, ar)} /></div>
        <Button variant={view === 'board' ? 'primary' : 'secondary'} size="sm" onClick={() => setView('board')}>{t('Board', 'لوحة')}</Button>
        <Button variant={view === 'list' ? 'primary' : 'secondary'} size="sm" onClick={() => setView('list')}>{t('List', 'قائمة')}</Button>
        <div className="flex-1" />
        <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!rows.length}>{t('CSV', 'CSV')}</Button>
        <Button onClick={() => setNewLead({ ...LEAD_EMPTY })}>{t('New lead', 'عميل جديد')}</Button>
      </div>
      <AsyncView state={state}>
        {() => view === 'board' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {CRM_STAGES.map((s) => {
              const items = rows.filter((r) => (r.pipeline_stage || 'submitted') === s.value);
              return (
                <div key={s.value} className="rounded-2xl border border-gray-800 bg-gray-900/50 p-3 min-h-[200px]">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-bold text-emerald-300">{t(s.en, s.ar)}</span>
                    <span className="text-xs text-gray-500">{items.length}</span>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">{items.slice(0, 200).map(card)}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <Table rows={rows} empty={t('No admissions.', 'لا توجد طلبات.')} columns={[
            { key: 'student_name', label: t('Student', 'الطالب'), render: (r) => <button type="button" className="text-emerald-300 hover:underline text-start" onClick={() => setSelectedId(r.id)}>{r.student_name}</button> },
            { key: 'parent_name', label: t('Parent', 'ولي الأمر') },
            { key: 'phone', label: t('Phone', 'الهاتف') },
            { key: 'course', label: t('Course', 'البرنامج'), render: (r) => labelOf(COURSES, r.course, ar) },
            { key: 'source', label: t('Source', 'المصدر'), render: (r) => labelOf(LEAD_SOURCES, r.source, ar) },
            { key: 'stage', label: t('Stage', 'المرحلة'), render: (r) => labelOf(CRM_STAGES, r.pipeline_stage || 'submitted', ar) },
            { key: 'follow_up_at', label: t('Follow-up', 'المتابعة'), render: (r) => (r.follow_up_at ? <span className={new Date(r.follow_up_at).getTime() < now ? 'text-red-400' : ''}>{formatDate(r.follow_up_at)}</span> : '—') },
            { key: 'created_at', label: t('Received', 'الاستلام'), render: (r) => formatDate(r.created_at) },
          ]} />
        )}
      </AsyncView>
      {selected && (
        <CrmLeadDetail key={selected.id} lead={selected} employees={employees} onClose={() => setSelectedId(null)} onChanged={refresh} />
      )}
      <Modal open={Boolean(newLead)} title={t('New lead', 'عميل جديد')} onClose={() => setNewLead(null)}
        footer={<><Button variant="ghost" onClick={() => setNewLead(null)}>{t('Cancel', 'إلغاء')}</Button>
          <Button disabled={busy || !newLead?.student_name || !newLead?.parent_name || !newLead?.phone || !newLead?.age} onClick={createLead}>{t('Create', 'إنشاء')}</Button></>}>
        {newLead && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('Student name', 'اسم الطالب')}><Input value={newLead.student_name} onChange={(e) => setNewLead({ ...newLead, student_name: e.target.value })} /></Field>
            <Field label={t('Age', 'العمر')}><Input type="number" min="5" max="15" value={newLead.age} onChange={(e) => setNewLead({ ...newLead, age: e.target.value })} /></Field>
            <Field label={t('Parent name', 'اسم ولي الأمر')}><Input value={newLead.parent_name} onChange={(e) => setNewLead({ ...newLead, parent_name: e.target.value })} /></Field>
            <Field label={t('Phone', 'الهاتف')}><Input type="tel" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} /></Field>
            <Field label={t('E-mail', 'البريد')}><Input type="email" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} /></Field>
            <Field label={t('Course', 'البرنامج')}><Select value={newLead.course} onChange={(e) => setNewLead({ ...newLead, course: e.target.value })} options={toOptions(COURSES, ar)} /></Field>
            <Field label={t('Source', 'المصدر')}><Select value={newLead.source} onChange={(e) => setNewLead({ ...newLead, source: e.target.value })} options={toOptions(LEAD_SOURCES, ar)} /></Field>
            <Field label={t('Previous education', 'التعليم السابق')}><Input value={newLead.previous_education} onChange={(e) => setNewLead({ ...newLead, previous_education: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label={t('Address', 'العنوان')}><Input value={newLead.address} onChange={(e) => setNewLead({ ...newLead, address: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label={t('Notes', 'ملاحظات')}><Textarea value={newLead.notes} onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} /></Field></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function AllFollowups({ onChangedStats }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [showDone, setShowDone] = useState(false);
  const [state, reload] = useAsync(
    () => query('crm_followups', (q) => {
      let b = q.select('*, admissions(student_name, parent_name, phone), assignee:profiles!assigned_to(full_name)');
      if (!showDone) b = b.is('done_at', null);
      return b.order('due_at').limit(500);
    }),
    [showDone]
  );
  const done = async (r) => {
    const outcome = window.prompt(t('Outcome of this follow-up:', 'نتيجة المتابعة:'), '');
    if (outcome === null) return;
    const res = await run(() => updateRow('crm_followups', r.id, { done_at: new Date().toISOString(), outcome: outcome || null }), t('Marked done', 'تم'));
    if (res.ok) {
      reload();
      onChangedStats();
    }
  };
  return (
    <Card title={t('Follow-ups', 'المتابعات')} actions={
      <label className="text-sm text-gray-300 flex items-center gap-2"><input type="checkbox" className="accent-emerald-600" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />{t('Show completed', 'إظهار المكتملة')}</label>
    }>
      <AsyncView state={state}>{(rows) => <FollowupsTable rows={rows} busy={busy} onDone={done} showLead t={t} />}</AsyncView>
    </Card>
  );
}

export default function CrmPanel() {
  const { t } = useLang();
  const auth = useAuth();
  const [tab, setTab] = useState('pipeline');
  const [stats, reloadStats] = useAsync(async () => (await rpc('crm_dashboard')) ?? {}, []);
  const tabs = [
    { id: 'pipeline', label: t('Pipeline', 'المسار') },
    { id: 'followups', label: t('Follow-ups', 'المتابعات') },
    ...(auth.isAdmin || auth.isHrStaff ? [{ id: 'invites', label: t('Staff invitations', 'دعوات الموظفين') }] : []),
  ];
  return (
    <div>
      <PageHeader title={t('Admissions CRM', 'إدارة القبول')} subtitle={t('Leads, follow-ups, enrolment and onboarding invitations.', 'العملاء المحتملون والمتابعات والتسجيل والدعوات.')} />
      <DashboardStrip state={stats} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'pipeline' && <Pipeline onChangedStats={reloadStats} />}
      {tab === 'followups' && <AllFollowups onChangedStats={reloadStats} />}
      {tab === 'invites' && <CrmInvitations />}
    </div>
  );
}
