import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { AsyncView, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, StatusBadge, Table, Tabs, Textarea, useAsync, useLang } from '../ui';
import { deleteRow, formatDate, insertRow, query, today, updateRow } from '../../../lib/erp/rpc';
import { studentLabel } from '../../../lib/erp/campusApi';
import { StudentPicker, WideModal } from './common';
import { useAction, useEmployees, useStudents } from './hooks';
import { useUrlState } from '../../../lib/useTabParam';

const CATEGORIES = ['behaviour', 'attendance', 'uniform', 'academic_dishonesty', 'bullying', 'property', 'other'];
const SEVERITY_TONE = { minor: 'gray', moderate: 'amber', major: 'red' };
const CASE_TYPES = ['counselling', 'medical', 'financial_aid', 'family', 'other'];

function Discipline({ students }) {
  const { t } = useLang();
  const auth = useAuth();
  const [busy, run] = useAction();
  const [status, setStatus] = useState('open');
  const [report, setReport] = useState(null);
  const [edit, setEdit] = useState(null);
  const [state, reload] = useAsync(
    () => query('discipline_incidents', (q) => {
      let b = q.select('*, student:profiles!student_id(full_name, index_number, class_number), reporter:profiles!reported_by(full_name)');
      if (status) b = b.eq('status', status);
      return b.order('incident_date', { ascending: false }).limit(500);
    }),
    [status]
  );
  const submit = async () => {
    const res = await run(() => insertRow('discipline_incidents', {
      student_id: report.student_id, incident_date: report.incident_date, category: report.category,
      severity: report.severity, description: report.description.trim(), action_taken: report.action_taken || null,
    }), report.severity === 'major' ? t('Incident recorded — parents have been notified', 'تم التسجيل — تم إبلاغ أولياء الأمور') : t('Incident recorded', 'تم تسجيل الحادثة'));
    if (res.ok) { setReport(null); reload(); }
  };
  const saveEdit = async () => {
    const patch = { status: edit.status, action_taken: edit.action_taken || null, resolved_at: edit.status === 'resolved' ? new Date().toISOString() : null };
    const res = await run(() => updateRow('discipline_incidents', edit.id, patch), t('Incident updated', 'تم التحديث'));
    if (res.ok) { setEdit(null); reload(); }
  };
  const remove = async (r) => {
    if (!window.confirm(t('Delete this incident permanently?', 'حذف هذه الحادثة نهائيًا؟'))) return;
    const res = await run(() => deleteRow('discipline_incidents', r.id), t('Deleted', 'تم الحذف'));
    if (res.ok) reload();
  };
  const canUpdate = (r) => auth.isWelfareStaff || r.reported_by === auth.user?.id;
  return (
    <Card title={t('Discipline incidents', 'حوادث الانضباط')} actions={
      <div className="flex gap-2 items-center">
        <div className="w-36"><Select value={status} onChange={(e) => setStatus(e.target.value)} placeholder={t('All', 'الكل')} options={['open', 'escalated', 'resolved'].map((s) => ({ value: s, label: s }))} /></div>
        <Button onClick={() => setReport({ student_id: '', incident_date: today(), category: 'behaviour', severity: 'minor', description: '', action_taken: '' })}>{t('Report incident', 'الإبلاغ عن حادثة')}</Button>
      </div>
    }>
      <AsyncView state={state}>
        {(rows) => (
          <Table rows={rows} empty={t('No incidents.', 'لا توجد حوادث.')} columns={[
            { key: 'incident_date', label: t('Date', 'التاريخ'), render: (r) => formatDate(r.incident_date) },
            { key: 'student', label: t('Student', 'الطالب'), render: (r) => studentLabel(r.student) },
            { key: 'category', label: t('Category', 'الفئة') },
            { key: 'severity', label: t('Severity', 'الخطورة'), render: (r) => <Badge tone={SEVERITY_TONE[r.severity]}>{r.severity}</Badge> },
            { key: 'description', label: t('Description', 'الوصف'), render: (r) => <span className="whitespace-pre-wrap">{r.description}</span> },
            { key: 'action_taken', label: t('Action taken', 'الإجراء') },
            { key: 'status', label: t('Status', 'الحالة'), render: (r) => <div className="space-y-1"><StatusBadge status={r.status} />{r.parent_notified && <div className="text-xs text-sky-300">{t('parents notified', 'تم إبلاغ الأهل')}</div>}</div> },
            { key: 'reporter', label: t('Reported by', 'المبلغ'), render: (r) => r.reporter?.full_name || '—' },
            { key: 'act', label: '', render: (r) => (
              <div className="flex gap-2">
                {canUpdate(r) && <Button size="sm" variant="secondary" onClick={() => setEdit({ id: r.id, status: r.status, action_taken: r.action_taken || '' })}>{t('Update', 'تحديث')}</Button>}
                {auth.isAdmin && <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove(r)}>{t('Delete', 'حذف')}</Button>}
              </div>
            ) },
          ]} />
        )}
      </AsyncView>
      <Modal open={Boolean(report)} title={t('Report incident', 'الإبلاغ عن حادثة')} onClose={() => setReport(null)}
        footer={<><Button variant="ghost" onClick={() => setReport(null)}>{t('Cancel', 'إلغاء')}</Button><Button disabled={busy || !report?.student_id || !report?.description?.trim()} onClick={submit}>{t('Submit', 'إرسال')}</Button></>}>
        {report && (
          <div className="space-y-3">
            <Field label={t('Student', 'الطالب')}><StudentPicker students={students} value={report.student_id} onChange={(v) => setReport({ ...report, student_id: v })} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t('Date', 'التاريخ')}><Input type="date" max={today()} value={report.incident_date} onChange={(e) => setReport({ ...report, incident_date: e.target.value })} /></Field>
              <Field label={t('Category', 'الفئة')}><Select value={report.category} onChange={(e) => setReport({ ...report, category: e.target.value })} options={CATEGORIES.map((c) => ({ value: c, label: c }))} /></Field>
              <Field label={t('Severity', 'الخطورة')}><Select value={report.severity} onChange={(e) => setReport({ ...report, severity: e.target.value })} options={['minor', 'moderate', 'major'].map((c) => ({ value: c, label: c }))} /></Field>
            </div>
            {report.severity === 'major' && <p className="text-xs text-amber-300">{t('Linked parents are notified automatically for major incidents.', 'يتم إبلاغ أولياء الأمور تلقائيًا في الحوادث الكبيرة.')}</p>}
            <Field label={t('Description', 'الوصف')}><Textarea value={report.description} onChange={(e) => setReport({ ...report, description: e.target.value })} /></Field>
            <Field label={t('Immediate action taken', 'الإجراء الفوري')}><Input value={report.action_taken} onChange={(e) => setReport({ ...report, action_taken: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
      <Modal open={Boolean(edit)} title={t('Update incident', 'تحديث الحادثة')} onClose={() => setEdit(null)}
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>{t('Cancel', 'إلغاء')}</Button><Button disabled={busy} onClick={saveEdit}>{t('Save', 'حفظ')}</Button></>}>
        {edit && (
          <div className="space-y-3">
            <Field label={t('Status', 'الحالة')}><Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} options={['open', 'escalated', 'resolved'].map((s) => ({ value: s, label: s }))} /></Field>
            <Field label={t('Action taken', 'الإجراء المتخذ')}><Textarea value={edit.action_taken} onChange={(e) => setEdit({ ...edit, action_taken: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function CaseDetail({ c, employees, onClose, onChanged }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [note, setNote] = useState('');
  const [notes, reloadNotes] = useAsync(
    () => query('welfare_notes', (q) => q.select('*, author:profiles!author_id(full_name)').eq('case_id', c.id).order('created_at', { ascending: false })),
    [c.id]
  );
  const patch = async (p, msg) => {
    const res = await run(() => updateRow('welfare_cases', c.id, p), msg);
    if (res.ok) onChanged();
  };
  const addNote = async () => {
    if (!note.trim()) return;
    const res = await run(() => insertRow('welfare_notes', { case_id: c.id, note: note.trim() }), t('Note added', 'تمت إضافة الملاحظة'));
    if (res.ok) { setNote(''); reloadNotes(); }
  };
  const close = () => {
    if (!window.confirm(t('Close this case?', 'إغلاق هذه الحالة؟'))) return;
    patch({ status: 'closed', closed_at: new Date().toISOString() }, t('Case closed', 'تم إغلاق الحالة'));
  };
  return (
    <WideModal open title={`${c.summary} · ${c.student?.full_name || ''}`} onClose={onClose}>
      <div className="flex flex-wrap gap-2 items-center">
        <StatusBadge status={c.status} /><Badge tone="blue">{c.case_type}</Badge>
        {c.is_confidential && <Badge tone="red"><span className="material-symbols-outlined text-[12px] align-middle me-0.5">lock</span>{t('confidential', 'سري')}</Badge>}
        <span className="text-xs text-gray-500">{t('Opened', 'فتحت')} {formatDate(c.created_at)} · {c.opener?.full_name || ''}</span>
      </div>
      {c.details && <p className="text-sm text-gray-300 whitespace-pre-wrap">{c.details}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <Field label={t('Assigned to', 'مسند إلى')}>
          <Select value={c.assigned_to || ''} onChange={(e) => patch({ assigned_to: e.target.value || null }, t('Assignee updated', 'تم التحديث'))} placeholder="—" options={employees.map((p) => ({ value: p.id, label: p.full_name || p.email }))} />
        </Field>
        <Field label={t('Status', 'الحالة')}>
          <Select value={c.status} onChange={(e) => patch({ status: e.target.value, closed_at: e.target.value === 'closed' ? new Date().toISOString() : null }, t('Status updated', 'تم التحديث'))}
            options={['open', 'in_progress', 'closed'].map((s) => ({ value: s, label: s }))} />
        </Field>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => patch({ is_confidential: !c.is_confidential }, t('Confidentiality updated', 'تم التحديث'))}>
            {c.is_confidential ? t('Make visible to staff', 'إظهار للموظفين') : t('Mark confidential', 'تحديد كسري')}
          </Button>
          {c.status !== 'closed' && <Button variant="danger" disabled={busy} onClick={close}>{t('Close', 'إغلاق')}</Button>}
        </div>
      </div>
      <Card title={t('Case notes', 'ملاحظات الحالة')}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Add a note…', 'أضف ملاحظة…')} />
        <div className="flex justify-end mt-2"><Button disabled={busy || !note.trim()} onClick={addNote}>{t('Add note', 'إضافة')}</Button></div>
        <AsyncView state={notes}>
          {(rows) => rows.length ? (
            <ol className="mt-4 space-y-3 border-s border-gray-800 ps-4">
              {rows.map((n) => (
                <li key={n.id}>
                  <div className="text-xs text-gray-500">{new Date(n.created_at).toLocaleString('en-GB')} · {n.author?.full_name || '—'}</div>
                  <div className="text-sm text-gray-100 whitespace-pre-wrap">{n.note}</div>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-gray-500 mt-3">{t('No notes yet.', 'لا توجد ملاحظات.')}</p>}
        </AsyncView>
      </Card>
    </WideModal>
  );
}

function WelfareCases({ students }) {
  const { t } = useLang();
  const auth = useAuth();
  const [busy, run] = useAction();
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [emps] = useEmployees();
  const [state, reload] = useAsync(
    () => query('welfare_cases', (q) => {
      let b = q.select('*, student:profiles!student_id(full_name, index_number, class_number), assignee:profiles!assigned_to(full_name), opener:profiles!opened_by(full_name)');
      if (status) b = b.eq('status', status);
      return b.order('created_at', { ascending: false }).limit(500);
    }),
    [status]
  );
  const create = async () => {
    const res = await run(() => insertRow('welfare_cases', {
      student_id: modal.student_id, case_type: modal.case_type, summary: modal.summary.trim(), details: modal.details || null,
      is_confidential: Boolean(modal.is_confidential), assigned_to: modal.assigned_to || null,
    }), t('Case opened', 'تم فتح الحالة'));
    if (res.ok) { setModal(null); reload(); }
  };
  const selected = (state.data || []).find((c) => c.id === selectedId);
  return (
    <Card title={t('Welfare cases', 'حالات الرعاية')} actions={
      <div className="flex gap-2 items-center">
        <div className="w-36"><Select value={status} onChange={(e) => setStatus(e.target.value)} placeholder={t('All', 'الكل')} options={['open', 'in_progress', 'closed'].map((s) => ({ value: s, label: s }))} /></div>
        {auth.isWelfareStaff && <Button onClick={() => setModal({ student_id: '', case_type: 'counselling', summary: '', details: '', is_confidential: true, assigned_to: '' })}>{t('Open case', 'فتح حالة')}</Button>}
      </div>
    }>
      {!auth.isWelfareStaff && <p className="text-xs text-gray-500 mb-3">{t('You see non-confidential cases and cases assigned to you.', 'تظهر لك الحالات غير السرية والمسندة إليك.')}</p>}
      <AsyncView state={state}>
        {(rows) => (
          <Table rows={rows} empty={t('No cases.', 'لا توجد حالات.')} columns={[
            { key: 'summary', label: t('Summary', 'الملخص'), render: (c) => <button type="button" className="text-emerald-300 hover:underline text-start flex items-center gap-1" onClick={() => setSelectedId(c.id)}>{c.is_confidential && <span className="material-symbols-outlined text-[13px]">lock</span>}<span>{c.summary}</span></button> },
            { key: 'student', label: t('Student', 'الطالب'), render: (c) => studentLabel(c.student) },
            { key: 'case_type', label: t('Type', 'النوع') },
            { key: 'assignee', label: t('Assigned', 'المسؤول'), render: (c) => c.assignee?.full_name || '—' },
            { key: 'status', label: t('Status', 'الحالة'), render: (c) => <StatusBadge status={c.status} /> },
            { key: 'updated_at', label: t('Updated', 'التحديث'), render: (c) => formatDate(c.updated_at) },
          ]} />
        )}
      </AsyncView>
      {selected && <CaseDetail key={selected.id} c={selected} employees={emps.data || []} onClose={() => setSelectedId(null)} onChanged={reload} />}
      <Modal open={Boolean(modal)} title={t('Open welfare case', 'فتح حالة رعاية')} onClose={() => setModal(null)}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>{t('Cancel', 'إلغاء')}</Button><Button disabled={busy || !modal?.student_id || !modal?.summary?.trim()} onClick={create}>{t('Open case', 'فتح')}</Button></>}>
        {modal && (
          <div className="space-y-3">
            <Field label={t('Student', 'الطالب')}><StudentPicker students={students} value={modal.student_id} onChange={(v) => setModal({ ...modal, student_id: v })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('Type', 'النوع')}><Select value={modal.case_type} onChange={(e) => setModal({ ...modal, case_type: e.target.value })} options={CASE_TYPES.map((c) => ({ value: c, label: c }))} /></Field>
              <Field label={t('Assign to', 'إسناد إلى')}><Select value={modal.assigned_to} onChange={(e) => setModal({ ...modal, assigned_to: e.target.value })} placeholder="—" options={(emps.data || []).map((p) => ({ value: p.id, label: p.full_name || p.email }))} /></Field>
            </div>
            <Field label={t('Summary', 'الملخص')}><Input value={modal.summary} onChange={(e) => setModal({ ...modal, summary: e.target.value })} /></Field>
            <Field label={t('Details', 'التفاصيل')}><Textarea value={modal.details} onChange={(e) => setModal({ ...modal, details: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" className="accent-emerald-600" checked={Boolean(modal.is_confidential)} onChange={(e) => setModal({ ...modal, is_confidential: e.target.checked })} />{t('Confidential (welfare staff and assignee only)', 'سري (لطاقم الرعاية والمسؤول فقط)')}</label>
          </div>
        )}
      </Modal>
    </Card>
  );
}

export default function WelfarePanel({ initialTab = 'discipline' }) {
  const { t } = useLang();
  // In the URL (?welfare=) so Back/Forward and links reach this tab.
  const [tab, setTab] = useUrlState('welfare', initialTab === 'welfare' ? 'welfare' : 'discipline');
  const [students] = useStudents();
  return (
    <div>
      <PageHeader title={t('Discipline & welfare', 'الانضباط والرعاية')} subtitle={t('Conduct incidents and confidential student welfare cases.', 'حوادث السلوك وحالات الرعاية السرية.')} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'discipline', label: t('Discipline', 'الانضباط') },
        { id: 'welfare', label: t('Welfare cases', 'حالات الرعاية') },
      ]} />
      {tab === 'discipline' && <Discipline students={students.data || []} />}
      {tab === 'welfare' && <WelfareCases students={students.data || []} />}
    </div>
  );
}
