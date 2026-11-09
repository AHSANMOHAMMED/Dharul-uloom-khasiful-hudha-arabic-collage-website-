import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AsyncView, Badge, Button, Card, Field, Input, PageHeader, Select, Table, Textarea, useAsync, useLang } from '../ui';
import { FilterBar } from '../finance/shared';
import { WideModal } from '../campus/common';
import { formatDate, today } from '../../../lib/erp/rpc';
import { profilesMap, runAction } from '../../../lib/erp/financeApi';
import {
  MEETING_TYPES,
  TASK_PRIORITIES,
  TASK_STATUS_LABELS,
  activeHoldersByDuty,
  createMeetingTasks,
  dutyName,
  holderIdForDuty,
  listAcademicYears,
  listAssignments,
  listDutyRoles,
  listMeetings,
  listTasks,
  pairLabel,
  pairOptions,
  saveMeeting,
} from '../../../lib/erp/governanceApi';
import AssignDutyModal from './AssignDutyModal';
import { DutyLabel, PeopleMultiSelect, useGovernance, useStaff, GovStatus } from './common';

const EMPTY_MEETING = { title: '', meeting_type: 'weekly', meeting_date: today(), academic_year_id: '', chaired_by: '', attendees: [], agenda: '', minutes: '', decisions: '' };

function MeetingForm({ meeting, onClose, onSaved }) {
  const { t } = useLang();
  const staff = useStaff();
  const [years] = useAsync(() => listAcademicYears(), []);
  const [form, setForm] = useState({
    ...EMPTY_MEETING,
    ...meeting,
    academic_year_id: meeting?.academic_year_id || '',
    chaired_by: meeting?.chaired_by || '',
    attendees: meeting?.attendees || [],
    agenda: meeting?.agenda || '',
    minutes: meeting?.minutes || '',
    decisions: meeting?.decisions || '',
  });
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setBusy(true);
    const row = {
      ...(form.id ? { id: form.id } : {}),
      title: form.title.trim(),
      meeting_type: form.meeting_type,
      meeting_date: form.meeting_date,
      academic_year_id: form.academic_year_id || null,
      chaired_by: form.chaired_by || null,
      attendees: form.attendees,
      agenda: form.agenda.trim() || null,
      minutes: form.minutes.trim() || null,
      decisions: form.decisions.trim() || null,
    };
    const res = await runAction(() => saveMeeting(row), t('Meeting saved', 'تم حفظ الاجتماع'));
    setBusy(false);
    if (res) onSaved(res);
  };

  return (
    <WideModal
      open
      title={form.id ? t('Edit mashoora', 'تعديل الشورى') : t('New mashoora', 'شورى جديدة')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t('Cancel', 'إلغاء')}</Button>
          <Button onClick={save} disabled={busy || !form.title.trim() || !form.meeting_date}>{t('Save', 'حفظ')}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <Field label={t('Title', 'العنوان')}>
            <Input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder={t('e.g. Weekly mashoora', 'مثل: الشورى الأسبوعية')} />
          </Field>
        </div>
        <Field label={t('Type', 'النوع')}>
          <Select value={form.meeting_type} onChange={(e) => set({ meeting_type: e.target.value })} options={pairOptions(MEETING_TYPES, t)} />
        </Field>
        <Field label={t('Date', 'التاريخ')}>
          <Input type="date" value={form.meeting_date} onChange={(e) => set({ meeting_date: e.target.value })} />
        </Field>
        <Field label={t('Academic year', 'العام الدراسي')}>
          <Select value={form.academic_year_id} onChange={(e) => set({ academic_year_id: e.target.value })} placeholder={t('— None —', '— لا شيء —')} options={(years.data || []).map((y) => ({ value: y.id, label: y.name }))} />
        </Field>
        <Field label={t('Chaired by', 'برئاسة')}>
          <Select value={form.chaired_by} onChange={(e) => set({ chaired_by: e.target.value })} placeholder={t('— None —', '— لا شيء —')} options={staff.options} />
        </Field>
        <div className="md:col-span-2">
          <Field label={t('Attendees', 'الحاضرون')}>
            <PeopleMultiSelect people={staff.list} value={form.attendees} onChange={(v) => set({ attendees: v })} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label={t('Agenda', 'جدول الأعمال')}>
            <Textarea rows={3} value={form.agenda} onChange={(e) => set({ agenda: e.target.value })} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label={t('Minutes', 'المحضر')}>
            <Textarea rows={5} value={form.minutes} onChange={(e) => set({ minutes: e.target.value })} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label={t('Decisions', 'القرارات')}>
            <Textarea rows={4} value={form.decisions} onChange={(e) => set({ decisions: e.target.value })} />
          </Field>
        </div>
      </div>
    </WideModal>
  );
}

const EMPTY_TASK = { title: '', description: '', assignee_id: '', due_date: '', priority: 'normal', duty_role_id: '' };

function MeetingTasksModal({ meeting, onClose, onSaved }) {
  const { t, lang } = useLang();
  const staff = useStaff();
  const [duties] = useAsync(() => listDutyRoles({ activeOnly: true }), []);
  const [holders] = useAsync(() => activeHoldersByDuty(), []);
  const [rows, setRows] = useState([{ ...EMPTY_TASK }]);
  const [busy, setBusy] = useState(false);
  const holdersMap = holders.data || {};

  const setRow = (i, patch) => {
    setRows((rs) =>
      rs.map((r, j) => {
        if (j !== i) return r;
        const next = { ...r, ...patch };
        // Choosing a duty auto-fills the current staff holder (lead preferred).
        if (Object.prototype.hasOwnProperty.call(patch, 'duty_role_id')) {
          const holder = holderIdForDuty(holdersMap, patch.duty_role_id);
          if (holder) next.assignee_id = holder;
        }
        return next;
      }),
    );
  };
  const valid = rows.filter((r) => r.title.trim());

  const save = async () => {
    setBusy(true);
    const payload = valid.map((r) => ({
      title: r.title.trim(),
      description: r.description.trim() || null,
      assignee_id: r.assignee_id || null,
      due_date: r.due_date || null,
      priority: r.priority,
      duty_role_id: r.duty_role_id || null,
    }));
    const n = await runAction(() => createMeetingTasks(meeting.id, payload), t('Tasks created', 'تم إنشاء المهام'));
    setBusy(false);
    if (n !== undefined) onSaved(Number(n) || payload.length);
  };

  return (
    <WideModal
      open
      title={`${t('Assign tasks', 'إسناد مهام')} · ${meeting.title}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t('Cancel', 'إلغاء')}</Button>
          <Button onClick={save} disabled={busy || !valid.length}>
            {t('Create tasks', 'إنشاء المهام')} ({valid.length})
          </Button>
        </>
      }
    >
      <p className="text-xs text-gray-400 mb-3">
        {t(
          'Pick a duty to assign the task to the staff member who currently holds it. You can still override the assignee.',
          'اختر مسؤولية لإسناد المهمة للموظف الذي يحملها حالياً. يمكنك تغيير المكلف يدوياً.',
        )}
      </p>
      <div className="space-y-3">
        {rows.map((r, i) => {
          const holder = holderIdForDuty(holdersMap, r.duty_role_id);
          const holderName = holder ? staff.options.find((o) => o.value === holder)?.label : null;
          return (
            <div key={i} className="rounded-xl border border-gray-800 p-3 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
              <div className="md:col-span-2">
                <Field label={t('Task', 'المهمة')}>
                  <Input value={r.title} onChange={(e) => setRow(i, { title: e.target.value })} />
                </Field>
              </div>
              <Field label={t('Duty', 'المسؤولية')} hint={holderName ? `${t('Holder', 'الحامل')}: ${holderName}` : undefined}>
                <Select
                  value={r.duty_role_id}
                  onChange={(e) => setRow(i, { duty_role_id: e.target.value })}
                  placeholder={t('— None —', '— لا شيء —')}
                  options={(duties.data || []).map((d) => ({ value: d.id, label: dutyName(d, lang) }))}
                />
              </Field>
              <Field label={t('Assignee', 'المكلف')}>
                <Select value={r.assignee_id} onChange={(e) => setRow(i, { assignee_id: e.target.value })} placeholder={t('— None —', '— لا شيء —')} options={staff.options} />
              </Field>
              <Field label={t('Due date', 'تاريخ الاستحقاق')}>
                <Input type="date" value={r.due_date} onChange={(e) => setRow(i, { due_date: e.target.value })} />
              </Field>
              <Field label={t('Priority', 'الأولوية')}>
                <Select value={r.priority} onChange={(e) => setRow(i, { priority: e.target.value })} options={pairOptions(TASK_PRIORITIES, t)} />
              </Field>
              <div className="md:col-span-5">
                <Input value={r.description} onChange={(e) => setRow(i, { description: e.target.value })} placeholder={t('Details (optional)', 'تفاصيل (اختياري)')} />
              </div>
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                  {t('Remove', 'إزالة')}
                </Button>
              </div>
            </div>
          );
        })}
        <Button size="sm" variant="secondary" onClick={() => setRows((rs) => [...rs, { ...EMPTY_TASK }])}>+ {t('Add row', 'إضافة صف')}</Button>
      </div>
    </WideModal>
  );
}

function MeetingDetail({ meeting, isGov, onClose, onEdit, onChanged }) {
  const { t } = useLang();
  const [, setParams] = useSearchParams();
  const [modal, setModal] = useState(null);
  const [state, reload] = useAsync(async () => {
    const [assignments, tasks] = await Promise.all([listAssignments({ status: null, meetingId: meeting.id }), listTasks({ meetingId: meeting.id })]);
    const people = await profilesMap([meeting.chaired_by, ...(meeting.attendees || []), ...assignments.map((a) => a.assignee_id), ...tasks.map((x) => x.assignee_id)]);
    return { assignments, tasks, people };
  }, [meeting.id]);
  const finalized = meeting.status === 'finalized';

  const openOnBoard = () => {
    setParams({ module: 'tasks', meeting: meeting.id, scope: 'all' });
    onClose();
  };

  const setStatus = async (status) => {
    if (status === 'finalized' && !window.confirm(t('Finalize these minutes? They become read-only until reopened.', 'اعتماد هذا المحضر؟ يصبح للقراءة فقط حتى إعادة فتحه.'))) return;
    const res = await runAction(() => saveMeeting({ id: meeting.id, status }), status === 'finalized' ? t('Minutes finalized', 'تم اعتماد المحضر') : t('Meeting reopened', 'أعيد فتح الاجتماع'));
    if (res) onChanged(res);
  };

  const block = (label, text) =>
    text ? (
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{label}</div>
        <div className="whitespace-pre-wrap text-sm text-gray-200 rounded-xl bg-gray-900/50 border border-gray-800 p-3">{text}</div>
      </div>
    ) : null;

  return (
    <WideModal
      open
      title={meeting.title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={openOnBoard}>{t('Open on task board', 'فتح في لوحة المهام')}</Button>
          {isGov && (
            <>
              {!finalized && <Button variant="secondary" onClick={onEdit}>{t('Edit', 'تعديل')}</Button>}
              <Button variant="secondary" onClick={() => setModal('duty')}>{t('Assign duties', 'إسناد مسؤوليات')}</Button>
              <Button variant="secondary" onClick={() => setModal('tasks')}>{t('Assign tasks', 'إسناد مهام')}</Button>
              {finalized ? (
                <Button variant="ghost" onClick={() => setStatus('draft')}>{t('Reopen', 'إعادة فتح')}</Button>
              ) : (
                <Button onClick={() => setStatus('finalized')}>{t('Finalize', 'اعتماد')}</Button>
              )}
            </>
          )}
        </>
      }
    >
      <AsyncView state={state}>
        {({ assignments, tasks, people }) => (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center text-sm text-gray-300">
              <Badge tone="blue">{pairLabel(MEETING_TYPES, meeting.meeting_type, t)}</Badge>
              <span>{formatDate(meeting.meeting_date)}</span>
              <GovStatus status={meeting.status} />
              {meeting.chaired_by && (
                <span>
                  · {t('Chaired by', 'برئاسة')}: {people[meeting.chaired_by]?.full_name || '—'}
                </span>
              )}
            </div>
            {(meeting.attendees || []).length > 0 && (
              <div className="text-sm text-gray-400">
                {t('Attendees', 'الحاضرون')} ({meeting.attendees.length}): {meeting.attendees.map((id) => people[id]?.full_name || '—').join(', ')}
              </div>
            )}
            {block(t('Agenda', 'جدول الأعمال'), meeting.agenda)}
            {block(t('Minutes', 'المحضر'), meeting.minutes)}
            {block(t('Decisions', 'القرارات'), meeting.decisions)}
            <Card title={t('Duties decided in this meeting', 'المسؤوليات المقررة في هذا الاجتماع')}>
              <Table
                rows={assignments}
                empty={t('No duties assigned in this meeting.', 'لم تُسند مسؤوليات في هذا الاجتماع.')}
                columns={[
                  { key: 'duty', label: t('Duty', 'المسؤولية'), render: (a) => <DutyLabel duty={a.duty} /> },
                  { key: 'assignee', label: t('Holder', 'الحامل'), render: (a) => people[a.assignee_id]?.full_name || '—' },
                  { key: 'start_date', label: t('From', 'من'), render: (a) => formatDate(a.start_date) },
                  { key: 'status', label: t('Status', 'الحالة'), render: (a) => <GovStatus status={a.status} /> },
                ]}
              />
            </Card>
            <Card title={t('Tasks from this meeting', 'مهام هذا الاجتماع')}>
              <Table
                rows={tasks}
                empty={t('No tasks from this meeting.', 'لا توجد مهام من هذا الاجتماع.')}
                columns={[
                  { key: 'title', label: t('Task', 'المهمة') },
                  { key: 'assignee', label: t('Assignee', 'المكلف'), render: (x) => people[x.assignee_id]?.full_name || '—' },
                  { key: 'due_date', label: t('Due date', 'تاريخ الاستحقاق'), render: (x) => formatDate(x.due_date) },
                  { key: 'priority', label: t('Priority', 'الأولوية'), render: (x) => pairLabel(TASK_PRIORITIES, x.priority, t) },
                  { key: 'status', label: t('Status', 'الحالة'), render: (x) => <Badge tone={x.status === 'done' ? 'green' : 'amber'}>{pairLabel(TASK_STATUS_LABELS, x.status, t)}</Badge> },
                ]}
              />
            </Card>
          </div>
        )}
      </AsyncView>
      {modal === 'duty' && (
        <AssignDutyModal
          meeting={meeting}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            reload();
          }}
        />
      )}
      {modal === 'tasks' && (
        <MeetingTasksModal
          meeting={meeting}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            reload();
          }}
        />
      )}
    </WideModal>
  );
}

export default function MashooraPanel() {
  const { t } = useLang();
  const { isGov } = useGovernance();
  const [state, reload] = useAsync(() => listMeetings(), []);
  const [filters, setFilters] = useState({ type: '', status: '', q: '' });
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(null);

  return (
    <div>
      <PageHeader
        title={t('Mashoora', 'الشورى')}
        subtitle={t('Weekly, annual and special meetings — minutes, decisions, duties and tasks.', 'الاجتماعات الأسبوعية والسنوية والاستثنائية — المحاضر والقرارات والمسؤوليات والمهام.')}
        actions={
          <>
            <Button variant="secondary" onClick={reload}>{t('Refresh', 'تحديث')}</Button>
            {isGov && <Button onClick={() => setEditing({ ...EMPTY_MEETING })}>+ {t('New mashoora', 'شورى جديدة')}</Button>}
          </>
        }
      />
      <Card>
        <FilterBar>
          <Field label={t('Search', 'بحث')}>
            <Input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          </Field>
          <Field label={t('Type', 'النوع')}>
            <Select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} placeholder={t('All', 'الكل')} options={pairOptions(MEETING_TYPES, t)} />
          </Field>
          <Field label={t('Status', 'الحالة')}>
            <Select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              placeholder={t('All', 'الكل')}
              options={[
                { value: 'draft', label: t('Draft', 'مسودة') },
                { value: 'finalized', label: t('Finalized', 'معتمد') },
              ]}
            />
          </Field>
        </FilterBar>
        <AsyncView state={state}>
          {(rows) => {
            const needle = filters.q.trim().toLowerCase();
            const list = rows
              .filter((m) => !filters.type || m.meeting_type === filters.type)
              .filter((m) => !filters.status || m.status === filters.status)
              .filter((m) => !needle || [m.title, m.agenda, m.decisions].filter(Boolean).some((s) => s.toLowerCase().includes(needle)));
            return (
              <Table
                rows={list}
                empty={t('No meetings recorded.', 'لا توجد اجتماعات مسجلة.')}
                columns={[
                  { key: 'meeting_date', label: t('Date', 'التاريخ'), render: (m) => formatDate(m.meeting_date) },
                  { key: 'title', label: t('Title', 'العنوان'), render: (m) => <span className="font-semibold">{m.title}</span> },
                  { key: 'meeting_type', label: t('Type', 'النوع'), render: (m) => <Badge tone={m.meeting_type === 'annual' ? 'green' : m.meeting_type === 'special' ? 'amber' : 'blue'}>{pairLabel(MEETING_TYPES, m.meeting_type, t)}</Badge> },
                  { key: 'attendees', label: t('Attendees', 'الحاضرون'), render: (m) => (m.attendees || []).length },
                  { key: 'status', label: t('Status', 'الحالة'), render: (m) => <GovStatus status={m.status} /> },
                  { key: 'act', label: '', render: (m) => <Button size="sm" variant="secondary" onClick={() => setOpen(m)}>{t('Open', 'فتح')}</Button> },
                ]}
              />
            );
          }}
        </AsyncView>
      </Card>
      {editing && (
        <MeetingForm
          meeting={editing}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            setEditing(null);
            reload();
            if (m?.id) setOpen(m);
          }}
        />
      )}
      {open && !editing && (
        <MeetingDetail
          key={open.id}
          meeting={open}
          isGov={isGov}
          onClose={() => setOpen(null)}
          onEdit={() => setEditing(open)}
          onChanged={(m) => {
            setOpen(m);
            reload();
          }}
        />
      )}
    </div>
  );
}
