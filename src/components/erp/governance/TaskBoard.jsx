import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Badge, Button, ErrorNote, Field, Input, Loading, PageHeader, Select, Tabs, Textarea, useAsync, useLang } from '../ui';
import { FilterBar } from '../finance/shared';
import { WideModal } from '../campus/common';
import { formatDate, today } from '../../../lib/erp/rpc';
import { profilesMap } from '../../../lib/erp/financeApi';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  activeHoldersByDuty,
  addTaskComment,
  createTask,
  dbMessage,
  deleteTask,
  dutyName,
  holderIdForDuty,
  listDutyRoles,
  listMeetings,
  listTaskComments,
  listTaskEvents,
  listTasks,
  pairLabel,
  pairOptions,
  reorderTask,
  subscribeTable,
  updateTask,
  weekStartOf,
} from '../../../lib/erp/governanceApi';
import { useGovernance, useStaff } from './common';

const PRIORITY_TONE = { low: 'gray', normal: 'blue', high: 'amber', urgent: 'red' };
const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };
const COLUMN_TONE = { todo: 'border-gray-700', in_progress: 'border-sky-800', review: 'border-amber-800', done: 'border-emerald-800' };

/** Translate the task-board rule messages raised by the database trigger. */
function useTaskError() {
  const { t } = useLang();
  return useCallback(
    (e) => {
      const msg = dbMessage(e);
      if (/Move the task to Review/i.test(msg)) return t('Move the task to Review — the person who assigned it marks it Done', 'انقل المهمة إلى المراجعة — من أسندها هو من يعلّمها منجزة');
      if (/Only the task owner can edit/i.test(msg)) return t('Only the task owner can edit task details', 'تعديل تفاصيل المهمة لصاحبها فقط');
      if (/assign tasks to others/i.test(msg)) return t('Only the principal / administrators assign tasks to others', 'إسناد المهام للآخرين للمدير / المسؤولين فقط');
      return msg;
    },
    [t],
  );
}

function sortTasks(list) {
  return [...list].sort(
    (a, b) =>
      (a.position || 0) - (b.position || 0) ||
      (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
      String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')),
  );
}

// ---------------------------------------------------------------------------
// Task form (new + edit details)
// ---------------------------------------------------------------------------
function TaskFields({ form, set, canAssignOthers, userId, staff, duties, meetings, holdersMap, readOnly }) {
  const { t, lang } = useLang();
  const assigneeOptions = canAssignOthers ? staff.options : staff.options.filter((o) => o.value === userId);
  const holder = holderIdForDuty(holdersMap, form.duty_role_id);
  const holderName = holder ? staff.options.find((o) => o.value === holder)?.label : null;

  const onDutyChange = (dutyRoleId) => {
    const patch = { duty_role_id: dutyRoleId };
    if (canAssignOthers) {
      const nextHolder = holderIdForDuty(holdersMap, dutyRoleId);
      if (nextHolder) patch.assignee_id = nextHolder;
    }
    set(patch);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="sm:col-span-2">
        <Field label={t('Title', 'العنوان')}>
          <Input value={form.title} disabled={readOnly} onChange={(e) => set({ title: e.target.value })} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label={t('Description', 'الوصف')}>
          <Textarea rows={3} value={form.description} disabled={readOnly} onChange={(e) => set({ description: e.target.value })} />
        </Field>
      </div>
      <Field label={t('Duty', 'المسؤولية')} hint={holderName ? `${t('Current holder', 'الحامل الحالي')}: ${holderName}` : undefined}>
        <Select
          value={form.duty_role_id}
          disabled={readOnly}
          onChange={(e) => onDutyChange(e.target.value)}
          placeholder={t('— None —', '— لا شيء —')}
          options={(duties || []).map((d) => ({ value: d.id, label: dutyName(d, lang) }))}
        />
      </Field>
      <Field label={t('Assignee', 'المكلف')} hint={canAssignOthers ? t('Auto-fills from duty holder when you pick a duty', 'يُملأ تلقائياً من حامل المسؤولية') : t('You can only create tasks for yourself', 'يمكنك إنشاء مهام لنفسك فقط')}>
        <Select
          value={form.assignee_id}
          disabled={readOnly || !canAssignOthers}
          onChange={(e) => set({ assignee_id: e.target.value })}
          placeholder={canAssignOthers ? t('— None —', '— لا شيء —') : undefined}
          options={assigneeOptions.length ? assigneeOptions : [{ value: userId, label: t('Me', 'أنا') }]}
        />
      </Field>
      <Field label={t('Priority', 'الأولوية')}>
        <Select value={form.priority} disabled={readOnly} onChange={(e) => set({ priority: e.target.value })} options={pairOptions(TASK_PRIORITIES, t)} />
      </Field>
      <Field label={t('Due date', 'تاريخ الاستحقاق')}>
        <Input type="date" value={form.due_date} disabled={readOnly} onChange={(e) => set({ due_date: e.target.value })} />
      </Field>
      <Field label={t('Week', 'الأسبوع')} hint={form.week_start ? `${t('Week of', 'أسبوع')} ${formatDate(form.week_start)}` : undefined}>
        <Input type="date" value={form.week_start} disabled={readOnly} onChange={(e) => set({ week_start: e.target.value ? weekStartOf(e.target.value) : '' })} />
      </Field>
      <Field label={t('Mashoora', 'الشورى')}>
        <Select value={form.meeting_id} disabled={readOnly} onChange={(e) => set({ meeting_id: e.target.value })} placeholder={t('— None —', '— لا شيء —')} options={(meetings || []).map((m) => ({ value: m.id, label: `${m.title} · ${formatDate(m.meeting_date)}` }))} />
      </Field>
    </div>
  );
}

function toForm(task, userId) {
  return {
    title: task?.title || '',
    description: task?.description || '',
    assignee_id: task?.assignee_id || userId || '',
    priority: task?.priority || 'normal',
    due_date: task?.due_date || '',
    week_start: task?.week_start || weekStartOf(today()),
    duty_role_id: task?.duty_role_id || '',
    meeting_id: task?.meeting_id || '',
  };
}

function fromForm(form) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    assignee_id: form.assignee_id || null,
    priority: form.priority,
    due_date: form.due_date || null,
    week_start: form.week_start || (form.due_date ? weekStartOf(form.due_date) : null),
    duty_role_id: form.duty_role_id || null,
    meeting_id: form.meeting_id || null,
  };
}

function NewTaskModal({ ctx, onClose, onSaved, defaults }) {
  const { t } = useLang();
  const errText = useTaskError();
  const [form, setForm] = useState(() => ({ ...toForm(null, ctx.userId), ...(defaults || {}) }));
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const save = async () => {
    setBusy(true);
    try {
      const row = fromForm(form);
      if (!ctx.isGov) row.assignee_id = ctx.userId;
      const created = await createTask({ ...row, status: 'todo', position: 0 });
      toast.success(t('Task created', 'تم إنشاء المهمة'));
      onSaved(created);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <WideModal
      open
      title={t('New task', 'مهمة جديدة')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t('Cancel', 'إلغاء')}</Button>
          <Button onClick={save} disabled={busy || !form.title.trim()}>{t('Create', 'إنشاء')}</Button>
        </>
      }
    >
      <TaskFields
        form={form}
        set={set}
        canAssignOthers={ctx.isGov}
        userId={ctx.userId}
        staff={ctx.staff}
        duties={ctx.duties}
        meetings={ctx.meetings}
        holdersMap={ctx.holdersMap}
      />
    </WideModal>
  );
}

function CommentsTab({ task, people }) {
  const { t } = useLang();
  const [state, reload] = useAsync(() => listTaskComments(task.id), [task.id]);
  const [authors, setAuthors] = useState({});
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => subscribeTable('task_comments', (p) => {
    if ((p.new?.task_id || p.old?.task_id) === task.id) reloadRef.current();
  }, `task-comments-${task.id}`), [task.id]);

  useEffect(() => {
    const ids = (state.data || []).map((c) => c.author_id).filter((id) => id && !people[id]);
    if (ids.length) profilesMap(ids).then(setAuthors).catch(() => {});
  }, [state.data, people]);

  const send = async () => {
    setBusy(true);
    try {
      await addTaskComment(task.id, body);
      setBody('');
      reload();
    } catch (e) {
      toast.error(dbMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const nameOf = (id) => people[id]?.full_name || authors[id]?.full_name || '—';

  return (
    <div className="space-y-3">
      {state.loading && !state.data ? (
        <Loading />
      ) : state.error ? (
        <ErrorNote error={state.error} />
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {(state.data || []).map((c) => (
            <li key={c.id} className="rounded-xl bg-gray-900/60 border border-gray-800 p-3">
              <div className="flex justify-between text-xs text-gray-500">
                <span className="font-semibold text-gray-300">{nameOf(c.author_id)}</span>
                <span>{new Date(c.created_at).toLocaleString('en-GB')}</span>
              </div>
              <div className="text-sm text-gray-200 whitespace-pre-wrap mt-1">{c.body}</div>
            </li>
          ))}
          {!(state.data || []).length && <li className="text-sm text-gray-500">{t('No comments yet.', 'لا توجد تعليقات بعد.')}</li>}
        </ul>
      )}
      <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('Write a comment…', 'اكتب تعليقًا…')} />
      <div className="flex justify-end">
        <Button size="sm" onClick={send} disabled={busy || !body.trim()}>{t('Add comment', 'إضافة تعليق')}</Button>
      </div>
    </div>
  );
}

function HistoryTab({ task, people }) {
  const { t } = useLang();
  const [state] = useAsync(async () => {
    const events = await listTaskEvents(task.id);
    const actors = await profilesMap(events.map((e) => e.actor_id).filter((id) => id && !people[id]));
    return { events, actors };
  }, [task.id, task.status, task.assignee_id]);
  if (state.loading && !state.data) return <Loading />;
  if (state.error) return <ErrorNote error={state.error} />;
  const { events, actors } = state.data;
  const status = (s) => (s ? pairLabel(TASK_STATUS_LABELS, s, t) : '');
  const note = (n) => ({ created: t('created', 'أُنشئت'), reassigned: t('reassigned', 'أعيد إسنادها') })[n] || n;
  return (
    <ol className="relative border-s border-gray-800 ms-2 space-y-4">
      {events.map((e) => (
        <li key={e.id} className="ms-4">
          <div className="absolute -start-1.5 mt-1.5 h-3 w-3 rounded-full bg-emerald-600" />
          <div className="text-xs text-gray-500">{new Date(e.created_at).toLocaleString('en-GB')}</div>
          <div className="text-sm text-gray-200">
            <b>{people[e.actor_id]?.full_name || actors[e.actor_id]?.full_name || t('System', 'النظام')}</b>{' '}
            {e.from_status ? `${status(e.from_status)} → ${status(e.to_status)}` : status(e.to_status)}
            {e.note ? ` · ${note(e.note)}` : ''}
          </div>
        </li>
      ))}
      {!events.length && <li className="ms-4 text-sm text-gray-500">{t('No history yet.', 'لا يوجد سجل بعد.')}</li>}
    </ol>
  );
}

function TaskModal({ task, ctx, people, onClose, onChanged, onDeleted }) {
  const { t } = useLang();
  const errText = useTaskError();
  const [tab, setTab] = useState('details');
  const [form, setForm] = useState(toForm(task));
  const [busy, setBusy] = useState(false);
  const canEdit = ctx.isGov || task.created_by === ctx.userId;
  const canDelete = ctx.isGov || (task.created_by === ctx.userId && task.status !== 'done');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      const updated = await updateTask(task.id, fromForm(form));
      toast.success(t('Task saved', 'تم حفظ المهمة'));
      onChanged(updated);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(t('Delete this task?', 'حذف هذه المهمة؟'))) return;
    try {
      await deleteTask(task.id);
      toast.success(t('Task deleted', 'تم حذف المهمة'));
      onDeleted(task.id);
    } catch (e) {
      toast.error(errText(e));
    }
  };

  return (
    <WideModal
      open
      title={task.title}
      onClose={onClose}
      footer={
        tab === 'details' && (
          <>
            {canDelete && <Button variant="danger" onClick={remove}>{t('Delete', 'حذف')}</Button>}
            <Button variant="secondary" onClick={onClose}>{t('Close', 'إغلاق')}</Button>
            {canEdit && <Button onClick={save} disabled={busy || !form.title.trim()}>{t('Save', 'حفظ')}</Button>}
          </>
        )
      }
    >
      <div className="flex flex-wrap gap-2 text-xs text-gray-400">
        <Badge tone={task.status === 'done' ? 'green' : 'amber'}>{pairLabel(TASK_STATUS_LABELS, task.status, t)}</Badge>
        <span>
          {t('Created by', 'أنشأها')}: {people[task.created_by]?.full_name || '—'}
        </span>
        {task.completed_at && (
          <span>
            · {t('Completed', 'اكتملت')}: {formatDate(task.completed_at)}
          </span>
        )}
      </div>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'details', label: t('Details', 'التفاصيل') },
          { id: 'comments', label: t('Comments', 'التعليقات') },
          { id: 'history', label: t('History', 'السجل') },
        ]}
      />
      {tab === 'details' && (
        <>
          {!canEdit && <p className="text-xs text-gray-500">{t('Only the person who created this task can edit its details. You can move it on the board.', 'تعديل التفاصيل لمن أنشأ المهمة فقط. يمكنك تحريكها على اللوحة.')}</p>}
          <TaskFields form={form} set={set} canAssignOthers={ctx.isGov} userId={ctx.userId} staff={ctx.staff} duties={ctx.duties} meetings={ctx.meetings} holdersMap={ctx.holdersMap} readOnly={!canEdit} />
        </>
      )}
      {tab === 'comments' && <CommentsTab task={task} people={people} />}
      {tab === 'history' && <HistoryTab task={task} people={people} />}
    </WideModal>
  );
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------
function TaskCard({ task, people, canMove, onOpen, onMove, onDragStart }) {
  const { t, lang } = useLang();
  const idx = TASK_STATUSES.indexOf(task.status);
  const overdue = task.due_date && task.status !== 'done' && task.due_date < today();
  return (
    <div
      draggable={canMove}
      onDragStart={(e) => onDragStart(e, task)}
      className={`rounded-xl border border-gray-800 bg-gray-950/80 p-3 space-y-2 ${canMove ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <button type="button" onClick={() => onOpen(task)} className="block w-full text-start">
        <div className="font-semibold text-white text-sm">{task.title}</div>
      </button>
      <div className="flex flex-wrap gap-1 items-center">
        <Badge tone={PRIORITY_TONE[task.priority]}>{pairLabel(TASK_PRIORITIES, task.priority, t)}</Badge>
        {task.duty && <Badge>{dutyName(task.duty, lang)}</Badge>}
        {task.meeting && <Badge tone="blue">{task.meeting.title}</Badge>}
      </div>
      <div className="flex justify-between gap-2 text-xs">
        <span className="text-gray-400 truncate">{people[task.assignee_id]?.full_name || t('Unassigned', 'غير مسندة')}</span>
        {task.due_date && <span className={overdue ? 'text-red-400 font-semibold' : 'text-gray-500'}>{formatDate(task.due_date)}</span>}
      </div>
      {canMove && (
        <div className="flex justify-between">
          <Button size="sm" variant="ghost" disabled={idx <= 0} onClick={() => onMove(task, TASK_STATUSES[idx - 1])} aria-label={t('Move back', 'نقل للخلف')}>
            <span className="rtl:hidden">←</span>
            <span className="hidden rtl:inline">→</span>
          </Button>
          <Button size="sm" variant="ghost" disabled={idx >= TASK_STATUSES.length - 1} onClick={() => onMove(task, TASK_STATUSES[idx + 1])} aria-label={t('Move forward', 'نقل للأمام')}>
            <span className="rtl:hidden">→</span>
            <span className="hidden rtl:inline">←</span>
          </Button>
        </div>
      )}
    </div>
  );
}

export default function TaskBoard() {
  const { t, lang } = useLang();
  const [params, setParams] = useSearchParams();
  const { user, isGov } = useGovernance();
  const userId = user?.id;
  const staff = useStaff();
  const errText = useTaskError();
  const [duties] = useAsync(() => listDutyRoles(), []);
  const [meetings] = useAsync(() => listMeetings({ limit: 100 }), []);
  const [holders] = useAsync(() => activeHoldersByDuty(), []);
  const meetingFromUrl = params.get('meeting') || '';
  const scopeFromUrl = params.get('scope');
  const [scope, setScope] = useState(scopeFromUrl === 'mine' || scopeFromUrl === 'all' ? scopeFromUrl : isGov ? 'all' : 'mine');
  const [filters, setFilters] = useState({ assignee: '', duty: '', week: '', meeting: meetingFromUrl, priority: '' });
  const [tasks, setTasks] = useState([]);
  const [people, setPeople] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const dragId = useRef(null);

  // Keep board filters in sync when navigating from Mashoora ("Open on task board").
  useEffect(() => {
    if (meetingFromUrl && filters.meeting !== meetingFromUrl) {
      setFilters((f) => ({ ...f, meeting: meetingFromUrl }));
      setScope('all');
    }
  }, [meetingFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncUrl = useCallback(
    (nextScope, nextMeeting) => {
      const next = { module: 'tasks' };
      if (nextScope) next.scope = nextScope;
      if (nextMeeting) next.meeting = nextMeeting;
      setParams(next, { replace: true });
    },
    [setParams],
  );

  const load = useCallback(async () => {
    try {
      const rows = await listTasks({
        assigneeId: scope === 'mine' ? userId : filters.assignee || undefined,
        dutyId: filters.duty || undefined,
        weekStart: filters.week || undefined,
        meetingId: filters.meeting || undefined,
        priority: filters.priority || undefined,
      });
      setTasks(rows || []);
      setError(null);
      const ids = (rows || []).flatMap((r) => [r.assignee_id, r.created_by]);
      setPeople(await profilesMap(ids));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [scope, userId, filters.assignee, filters.duty, filters.week, filters.meeting, filters.priority]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Live updates (RLS scopes the stream to this institution).
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    let timer = null;
    const off = subscribeTable('tasks', () => {
      clearTimeout(timer);
      timer = setTimeout(() => loadRef.current(), 300);
    }, 'task-board');
    return () => {
      clearTimeout(timer);
      off();
    };
  }, []);

  const ctx = {
    isGov,
    userId,
    staff,
    duties: duties.data || [],
    meetings: meetings.data || [],
    holdersMap: holders.data || {},
  };
  const canMove = (task) => isGov || task.assignee_id === userId || task.created_by === userId;

  const move = async (task, status, position) => {
    if (!status) return;
    if (task.status === status && (position == null || task.position === position)) return;
    const before = tasks;
    const optimistic = { ...task, status, ...(position != null ? { position } : {}) };
    setTasks((list) => list.map((x) => (x.id === task.id ? optimistic : x)));
    try {
      const updated = await reorderTask(task.id, { status, position });
      setTasks((list) => list.map((x) => (x.id === task.id ? updated : x)));
    } catch (e) {
      setTasks(before);
      toast.error(errText(e));
    }
  };

  const onDragStart = (e, task) => {
    dragId.current = task.id;
    try {
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed = 'move';
    } catch {
      /* some browsers restrict dataTransfer */
    }
  };
  const onDrop = (e, status) => {
    e.preventDefault();
    setDragOver(null);
    let id = dragId.current;
    try {
      id = e.dataTransfer.getData('text/plain') || id;
    } catch {
      /* ignore */
    }
    dragId.current = null;
    const task = tasks.find((x) => x.id === id);
    if (!task) return;
    const column = tasks.filter((x) => x.status === status && x.id !== task.id);
    const maxPos = column.reduce((m, x) => Math.max(m, Number(x.position) || 0), -1);
    move(task, status, maxPos + 1);
  };

  const columns = useMemo(() => Object.fromEntries(TASK_STATUSES.map((s) => [s, sortTasks(tasks.filter((x) => x.status === s))])), [tasks]);
  const openTask = tasks.find((x) => x.id === openId);
  const thisWeek = weekStartOf(today());
  const meetingFilterLabel = filters.meeting
    ? (meetings.data || []).find((m) => m.id === filters.meeting)?.title
    : null;

  return (
    <div>
      <PageHeader
        title={t('Task board', 'لوحة المهام')}
        subtitle={
          meetingFilterLabel
            ? `${t('Filtered by mashoora', 'مصفّاة حسب الشورى')}: ${meetingFilterLabel}`
            : t('Tasks from the mashoora and managers: To do → In progress → Review → Done.', 'مهام من الشورى والإدارة: للتنفيذ ← قيد التنفيذ ← للمراجعة ← منجز.')
        }
        actions={
          <>
            {filters.meeting && (
              <Button
                variant="ghost"
                onClick={() => {
                  setFilters((f) => ({ ...f, meeting: '' }));
                  syncUrl(scope, '');
                }}
              >
                {t('Clear mashoora filter', 'إزالة تصفية الشورى')}
              </Button>
            )}
            <Button variant="secondary" onClick={load}>{t('Refresh', 'تحديث')}</Button>
            <Button onClick={() => setCreating(true)}>+ {t('New task', 'مهمة جديدة')}</Button>
          </>
        }
      />
      <Tabs
        active={scope}
        onChange={(s) => {
          setScope(s);
          syncUrl(s, filters.meeting);
        }}
        tabs={[
          { id: 'mine', label: t('My tasks', 'مهامي') },
          { id: 'all', label: t('All tasks', 'كل المهام') },
        ]}
      />
      <FilterBar>
        {scope === 'all' && (
          <Field label={t('Assignee', 'المكلف')}>
            <Select value={filters.assignee} onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value }))} placeholder={t('All', 'الكل')} options={staff.options} />
          </Field>
        )}
        <Field label={t('Duty', 'المسؤولية')}>
          <Select value={filters.duty} onChange={(e) => setFilters((f) => ({ ...f, duty: e.target.value }))} placeholder={t('All', 'الكل')} options={(duties.data || []).map((d) => ({ value: d.id, label: dutyName(d, lang) }))} />
        </Field>
        <Field label={t('Week', 'الأسبوع')}>
          <div className="flex gap-2">
            <Input type="date" value={filters.week} onChange={(e) => setFilters((f) => ({ ...f, week: e.target.value ? weekStartOf(e.target.value) : '' }))} />
            <Button size="sm" variant={filters.week === thisWeek ? 'primary' : 'secondary'} onClick={() => setFilters((f) => ({ ...f, week: f.week === thisWeek ? '' : thisWeek }))}>
              {t('This week', 'هذا الأسبوع')}
            </Button>
          </div>
        </Field>
        <Field label={t('Mashoora', 'الشورى')}>
          <Select
            value={filters.meeting}
            onChange={(e) => {
              const meeting = e.target.value;
              setFilters((f) => ({ ...f, meeting }));
              syncUrl(scope, meeting);
            }}
            placeholder={t('All', 'الكل')}
            options={(meetings.data || []).map((m) => ({ value: m.id, label: `${m.title} · ${formatDate(m.meeting_date)}` }))}
          />
        </Field>
        <Field label={t('Priority', 'الأولوية')}>
          <Select value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))} placeholder={t('All', 'الكل')} options={pairOptions(TASK_PRIORITIES, t)} />
        </Field>
      </FilterBar>
      <ErrorNote error={error} />
      {loading && !tasks.length ? (
        <Loading />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {TASK_STATUSES.map((s) => (
            <section
              key={s}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOver !== s) setDragOver(s);
              }}
              onDragLeave={() => setDragOver((d) => (d === s ? null : d))}
              onDrop={(e) => onDrop(e, s)}
              className={`rounded-2xl border-2 ${dragOver === s ? 'border-emerald-500 bg-emerald-950/20' : COLUMN_TONE[s]} bg-gray-900/40 p-3 min-h-[12rem]`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white">{pairLabel(TASK_STATUS_LABELS, s, t)}</h3>
                <Badge>{columns[s].length}</Badge>
              </div>
              <div className="space-y-2">
                {columns[s].map((task) => (
                  <TaskCard key={task.id} task={task} people={people} canMove={canMove(task)} onOpen={(x) => setOpenId(x.id)} onMove={(x, st) => move(x, st)} onDragStart={onDragStart} />
                ))}
                {!columns[s].length && <div className="text-xs text-gray-600 text-center py-6">{t('Drop tasks here', 'أفلت المهام هنا')}</div>}
              </div>
            </section>
          ))}
        </div>
      )}
      {creating && (
        <NewTaskModal
          ctx={ctx}
          defaults={filters.meeting ? { meeting_id: filters.meeting } : undefined}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}
      {openTask && (
        <TaskModal
          key={openTask.id}
          task={openTask}
          ctx={ctx}
          people={people}
          onClose={() => setOpenId(null)}
          onChanged={(updated) => setTasks((list) => list.map((x) => (x.id === updated.id ? updated : x)))}
          onDeleted={(id) => {
            setOpenId(null);
            setTasks((list) => list.filter((x) => x.id !== id));
          }}
        />
      )}
    </div>
  );
}
