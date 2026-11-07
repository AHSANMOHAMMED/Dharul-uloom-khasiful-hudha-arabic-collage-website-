import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { AsyncView, Button, Card, Field, Input, Select, StatusBadge, Table, Tabs, Textarea, useAsync, useLang } from '../ui';
import { formatDate, insertRow, query, rpc, updateRow } from '../../../lib/erp/rpc';
import { COURSES, CRM_STAGES, LEAD_SOURCES, STAGE_STATUS, classOptions, labelOf } from '../../../lib/erp/campusApi';
import { KeyValue, WideModal } from './common';
import { useAction } from './hooks';

const KINDS = ['call', 'meeting', 'email', 'sms', 'whatsapp', 'visit'];

function fmtDateTime(v) {
  if (!v) return '—';
  return new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Notes({ lead }) {
  const { t } = useLang();
  const { user } = useAuth();
  const [busy, run] = useAction();
  const [body, setBody] = useState('');
  const [notes, reloadNotes] = useAsync(
    () => query('admission_notes', (q) => q.select('*, author:profiles!author_id(full_name)').eq('admission_id', lead.id).order('created_at', { ascending: false })),
    [lead.id]
  );
  const [history] = useAsync(
    () => query('admission_status_history', (q) => q.select('*, by:profiles!changed_by(full_name)').eq('admission_id', lead.id).order('created_at', { ascending: false })),
    [lead.id]
  );
  const add = async () => {
    if (!body.trim()) return;
    const res = await run(() => insertRow('admission_notes', { admission_id: lead.id, author_id: user?.id, body: body.trim() }), t('Note added', 'تمت إضافة الملاحظة'));
    if (res.ok) {
      setBody('');
      reloadNotes();
    }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('Add a note…', 'أضف ملاحظة…')} />
        <div className="flex justify-end"><Button disabled={busy || !body.trim()} onClick={add}>{t('Add note', 'إضافة')}</Button></div>
        <AsyncView state={notes}>
          {(rows) => rows.length ? (
            <ul className="space-y-2">
              {rows.map((n) => (
                <li key={n.id} className="rounded-xl bg-gray-900 border border-gray-800 p-3 text-sm">
                  <div className="text-gray-100 whitespace-pre-wrap">{n.body}</div>
                  <div className="text-xs text-gray-500 mt-1">{n.author?.full_name || '—'} · {fmtDateTime(n.created_at)}</div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-gray-500">{t('No notes yet.', 'لا توجد ملاحظات.')}</p>}
        </AsyncView>
      </div>
      <div>
        <h4 className="text-sm font-bold text-gray-300 mb-2">{t('Stage history', 'سجل المراحل')}</h4>
        <AsyncView state={history}>
          {(rows) => (
            <Table rows={rows} empty={t('No changes yet.', 'لا تغييرات.')} columns={[
              { key: 'when', label: t('When', 'متى'), render: (r) => fmtDateTime(r.created_at) },
              { key: 'move', label: t('Change', 'التغيير'), render: (r) => `${r.from_stage || '—'} → ${r.to_stage}` },
              { key: 'by', label: t('By', 'بواسطة'), render: (r) => r.by?.full_name || '—' },
              { key: 'note', label: t('Note', 'ملاحظة') },
            ]} />
          )}
        </AsyncView>
      </div>
    </div>
  );
}

export function FollowupsTable({ rows, busy, onDone, showLead, t }) {
  const now = Date.now();
  return (
    <Table rows={rows} empty={t('No follow-ups.', 'لا توجد متابعات.')} columns={[
      ...(showLead ? [{ key: 'lead', label: t('Lead', 'العميل'), render: (r) => <div><div>{r.admissions?.student_name}</div><div className="text-xs text-gray-500">{r.admissions?.parent_name} · {r.admissions?.phone}</div></div> }] : []),
      { key: 'due_at', label: t('Due', 'الموعد'), render: (r) => {
        const overdue = !r.done_at && new Date(r.due_at).getTime() < now;
        return <span className={overdue ? 'text-red-400 font-bold' : ''}>{fmtDateTime(r.due_at)}{overdue ? ` · ${t('overdue', 'متأخر')}` : ''}</span>;
      } },
      { key: 'kind', label: t('Type', 'النوع') },
      { key: 'note', label: t('Note', 'ملاحظة') },
      { key: 'assignee', label: t('Assigned', 'المسؤول'), render: (r) => r.assignee?.full_name || '—' },
      { key: 'done', label: t('Outcome', 'النتيجة'), render: (r) => (r.done_at ? <span className="text-emerald-300">✓ {r.outcome || ''} <span className="text-xs text-gray-500">{fmtDateTime(r.done_at)}</span></span> : null) },
      { key: 'act', label: '', render: (r) => (!r.done_at ? (
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => onDone(r)}>{t('Mark done', 'تم')}</Button>
        </div>
      ) : null) },
    ]} />
  );
}

function Followups({ lead, employees }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [form, setForm] = useState({ due_at: '', kind: 'call', note: '', assigned_to: '' });
  const [state, reload] = useAsync(
    () => query('crm_followups', (q) => q.select('*, assignee:profiles!assigned_to(full_name)').eq('admission_id', lead.id).order('due_at')),
    [lead.id]
  );
  const add = async (e) => {
    e.preventDefault();
    const due = new Date(form.due_at).toISOString();
    const res = await run(async () => {
      const row = await insertRow('crm_followups', { admission_id: lead.id, due_at: due, kind: form.kind, note: form.note || null, assigned_to: form.assigned_to || null });
      await updateRow('admissions', lead.id, { follow_up_at: due });
      return row;
    }, t('Follow-up scheduled', 'تمت جدولة المتابعة'));
    if (res.ok) {
      setForm({ due_at: '', kind: 'call', note: '', assigned_to: '' });
      reload();
    }
  };
  const done = async (r) => {
    const outcome = window.prompt(t('Outcome of this follow-up:', 'نتيجة المتابعة:'), '');
    if (outcome === null) return;
    const res = await run(() => updateRow('crm_followups', r.id, { done_at: new Date().toISOString(), outcome: outcome || null }), t('Marked done', 'تم'));
    if (res.ok) reload();
  };
  const remove = async (r) => {
    if (!window.confirm(t('Delete this follow-up?', 'حذف هذه المتابعة؟'))) return;
    const res = await run(() => query('crm_followups', (q) => q.delete().eq('id', r.id)), t('Deleted', 'تم الحذف'));
    if (res.ok) reload();
  };
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <Field label={t('Due', 'الموعد')}><Input type="datetime-local" required value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></Field>
        <Field label={t('Type', 'النوع')}><Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} options={KINDS.map((k) => ({ value: k, label: k }))} /></Field>
        <Field label={t('Assign to', 'إسناد إلى')}><Select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} placeholder="—" options={employees.map((p) => ({ value: p.id, label: p.full_name || p.email }))} /></Field>
        <Field label={t('Note', 'ملاحظة')}><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        <Button type="submit" disabled={busy}>{t('Schedule', 'جدولة')}</Button>
      </form>
      <AsyncView state={state}>
        {(rows) => (
          <div className="space-y-2">
            <FollowupsTable rows={rows} busy={busy} onDone={done} t={t} />
            {rows.some((r) => !r.done_at) && (
              <div className="flex flex-wrap gap-2">
                {rows.filter((r) => !r.done_at).map((r) => (
                  <Button key={r.id} size="sm" variant="ghost" disabled={busy} onClick={() => remove(r)}>{t('Delete', 'حذف')} {fmtDateTime(r.due_at)}</Button>
                ))}
              </div>
            )}
          </div>
        )}
      </AsyncView>
    </div>
  );
}

function Enroll({ lead, onEnrolled }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [index, setIndex] = useState(lead.enrolled_index || '');
  const [cls, setCls] = useState(String(lead.enrolled_class || 1));
  const [result, setResult] = useState(null);
  const enroll = async () => {
    if (!index.trim()) return;
    if (!window.confirm(t(`Enrol ${lead.student_name} with index ${index.trim()} in class ${cls}?`, `تسجيل ${lead.student_name} بالرقم ${index.trim()} في الصف ${cls}؟`))) return;
    const res = await run(() => rpc('enroll_admission', { p_admission_id: lead.id, p_index_number: index.trim(), p_class_number: Number(cls) }), t('Student enrolled', 'تم تسجيل الطالب'));
    if (res.ok) {
      setResult(res.data);
      onEnrolled?.();
    }
  };
  const copy = async (v) => {
    try {
      await navigator.clipboard.writeText(v);
    } catch {
      /* clipboard unavailable — token stays visible */
    }
  };
  return (
    <div className="space-y-4">
      {lead.pipeline_stage === 'enrolled' && !result && (
        <p className="text-sm text-emerald-300">{t('Already enrolled with index', 'مسجل بالفعل بالرقم')} {lead.enrolled_index} · {t('class', 'الصف')} {lead.enrolled_class}</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <Field label={t('Index number to issue', 'رقم القيد')}><Input value={index} onChange={(e) => setIndex(e.target.value)} /></Field>
        <Field label={t('Class', 'الصف')}><Select value={cls} onChange={(e) => setCls(e.target.value)} options={classOptions(t)} /></Field>
        <Button disabled={busy || !index.trim()} onClick={enroll}>{t('Enrol student', 'تسجيل الطالب')}</Button>
      </div>
      <p className="text-xs text-gray-500">{t('Creates the index number, marks the lead enrolled and sends the parent an invite (SMS/e-mail) with a code to link their child.', 'ينشئ رقم القيد ويرسل لولي الأمر رمز دعوة لربط الطالب.')}</p>
      {result && (
        <Card title={t('Enrolment complete', 'اكتمل التسجيل')}>
          <KeyValue items={[
            [t('Index', 'الرقم'), result.index_number],
            [t('Class', 'الصف'), result.class_number],
            [t('Parent invite code', 'رمز دعوة ولي الأمر'), <span key="tok" className="font-mono text-emerald-300 break-all">{result.parent_invite_token}</span>],
          ]} />
          <div className="flex justify-end mt-3"><Button size="sm" variant="secondary" onClick={() => copy(result.parent_invite_token)}>{t('Copy code', 'نسخ الرمز')}</Button></div>
        </Card>
      )}
    </div>
  );
}

export default function CrmLeadDetail({ lead, employees, onClose, onChanged }) {
  const { t, ar } = useLang();
  const { user } = useAuth();
  const [busy, run] = useAction();
  const [tab, setTab] = useState('notes');
  const [stage, setStage] = useState(lead.pipeline_stage || 'submitted');
  const [stageNote, setStageNote] = useState('');
  useEffect(() => {
    setStage(lead.pipeline_stage || 'submitted');
  }, [lead.pipeline_stage]);

  const changeStage = async () => {
    const from = lead.pipeline_stage || 'submitted';
    if (stage === from) return;
    const res = await run(async () => {
      await updateRow('admissions', lead.id, { pipeline_stage: stage, status: STAGE_STATUS[stage], reviewed_at: new Date().toISOString() });
      await insertRow('admission_status_history', { admission_id: lead.id, from_stage: from, to_stage: stage, changed_by: user?.id, note: stageNote || null });
    }, t('Stage updated', 'تم تحديث المرحلة'));
    if (res.ok) {
      setStageNote('');
      onChanged?.();
    }
  };
  const assign = async (assigned_to) => {
    const res = await run(() => updateRow('admissions', lead.id, { assigned_to: assigned_to || null }), t('Owner updated', 'تم تحديث المسؤول'));
    if (res.ok) onChanged?.();
  };

  return (
    <WideModal open title={`${lead.student_name} · ${labelOf(CRM_STAGES, lead.pipeline_stage || 'submitted', ar)}`} onClose={onClose}>
      <KeyValue items={[
        [t('Parent', 'ولي الأمر'), lead.parent_name],
        [t('Phone', 'الهاتف'), lead.phone],
        [t('E-mail', 'البريد'), lead.email],
        [t('Date of birth', 'تاريخ الميلاد'), lead.date_of_birth ? formatDate(lead.date_of_birth) : null],
        [t('Age', 'العمر'), lead.age],
        [t('Course', 'البرنامج'), labelOf(COURSES, lead.course, ar)],
        [t('Source', 'المصدر'), labelOf(LEAD_SOURCES, lead.source, ar)],
        [t('Address', 'العنوان'), lead.address],
        [t('Previous education', 'التعليم السابق'), lead.previous_education],
        [t('Received', 'تاريخ الاستلام'), formatDate(lead.created_at)],
        [t('Next follow-up', 'المتابعة القادمة'), fmtDateTime(lead.follow_up_at)],
      ]} />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <Field label={t('Move to stage', 'نقل إلى مرحلة')}>
          <Select value={stage} onChange={(e) => setStage(e.target.value)} options={CRM_STAGES.filter((s) => s.value !== 'enrolled' || lead.pipeline_stage === 'enrolled').map((s) => ({ value: s.value, label: t(s.en, s.ar) }))} />
        </Field>
        <Field label={t('Reason / note', 'السبب / ملاحظة')}><Input value={stageNote} onChange={(e) => setStageNote(e.target.value)} /></Field>
        <Button disabled={busy || stage === (lead.pipeline_stage || 'submitted')} onClick={changeStage}>{t('Update stage', 'تحديث المرحلة')}</Button>
        <Field label={t('Owner', 'المسؤول')}>
          <Select value={lead.assigned_to || ''} onChange={(e) => assign(e.target.value)} placeholder="—" options={employees.map((p) => ({ value: p.id, label: p.full_name || p.email }))} />
        </Field>
      </div>
      <div className="flex items-center gap-2"><span className="text-xs text-gray-500">{t('Status', 'الحالة')}:</span><StatusBadge status={lead.status} /></div>
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'notes', label: t('Notes & history', 'الملاحظات والسجل') },
        { id: 'follow', label: t('Follow-ups', 'المتابعات') },
        { id: 'enroll', label: t('Enrol', 'التسجيل') },
      ]} />
      {tab === 'notes' && <Notes lead={lead} />}
      {tab === 'follow' && <Followups lead={lead} employees={employees} />}
      {tab === 'enroll' && <Enroll lead={lead} onEnrolled={onChanged} />}
    </WideModal>
  );
}
