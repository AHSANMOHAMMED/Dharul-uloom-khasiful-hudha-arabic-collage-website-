import { useEffect, useMemo, useState } from 'react';
import {
  AsyncView, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Stat, Table, Tabs, Textarea, useAsync, useLang,
} from '../ui';
import { ConfirmModal, FilterBar, Num } from '../finance/shared';
import { formatDate, formatMoney } from '../../../lib/erp/rpc';
import { EXPENSE_STATUSES, labelOf, num, runAction } from '../../../lib/erp/financeApi';
import { dutyName, listDutyRoles, listMeetings, pairLabel, pairOptions, subscribeTable } from '../../../lib/erp/governanceApi';
import {
  ACTIVITY_CATEGORIES, ACTIVITY_STATUSES, ASSIGNEE_ROLES, ASSIGNEE_STATUSES, assignActivityStaff, formatDateTime, fromLocalInput,
  listActivities, listActivityExpenses, listActivityTeam, myResponsibilities, removeActivityStaff, respondActivity, saveActivity,
  splitByTime, sumBy, toLocalInput,
} from '../../../lib/erp/opsApi';
import { useGovernance, useStaff } from '../governance/common';
import { PairBadge } from './common';

const EMPTY_ACTIVITY = {
  title: '', description: '', category: 'event', starts_at: '', ends_at: '', location: '', status: 'planned', budget: '', duty_role_id: '', meeting_id: '',
};

// ---------------------------------------------------------------------------
// Create / edit
// ---------------------------------------------------------------------------
function ActivityForm({ activity, onClose, onSaved }) {
  const { t, lang } = useLang();
  const [form, setForm] = useState(() =>
    activity
      ? {
          ...EMPTY_ACTIVITY,
          ...activity,
          starts_at: toLocalInput(activity.starts_at),
          ends_at: toLocalInput(activity.ends_at),
          budget: activity.budget ?? '',
          duty_role_id: activity.duty_role_id || '',
          meeting_id: activity.meeting_id || '',
          description: activity.description || '',
          location: activity.location || '',
        }
      : EMPTY_ACTIVITY,
  );
  const [busy, setBusy] = useState(false);
  const [duties] = useAsync(() => listDutyRoles({ activeOnly: true }).catch(() => []), []);
  const [meetings] = useAsync(() => listMeetings({ limit: 50 }).catch(() => []), []);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const starts = fromLocalInput(form.starts_at);
  const ends = fromLocalInput(form.ends_at);
  const badRange = starts && ends && ends < starts;
  const valid = form.title.trim() && starts && !badRange && num(form.budget) >= 0;

  const save = async () => {
    setBusy(true);
    const row = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      starts_at: starts,
      ends_at: ends,
      location: form.location.trim() || null,
      status: form.status,
      budget: num(form.budget),
      duty_role_id: form.duty_role_id || null,
      meeting_id: form.meeting_id || null,
    };
    if (activity?.id) row.id = activity.id;
    const ok = await runAction(() => saveActivity(row), t('Activity saved', 'تم حفظ النشاط'));
    setBusy(false);
    if (ok) onSaved(ok);
  };

  return (
    <Modal
      open
      title={activity?.id ? t('Edit activity', 'تعديل النشاط') : t('New activity', 'نشاط جديد')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t('Cancel', 'إلغاء')}</Button>
          <Button onClick={save} disabled={busy || !valid}>{t('Save', 'حفظ')}</Button>
        </>
      }
    >
      <Field label={t('Title', 'العنوان')}>
        <Input value={form.title} onChange={set('title')} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t('Category', 'الفئة')}>
          <Select value={form.category} onChange={set('category')} options={pairOptions(ACTIVITY_CATEGORIES, t)} />
        </Field>
        <Field label={t('Status', 'الحالة')}>
          <Select value={form.status} onChange={set('status')} options={pairOptions(ACTIVITY_STATUSES, t)} />
        </Field>
        <Field label={t('Starts', 'يبدأ')}>
          <Input type="datetime-local" value={form.starts_at} onChange={set('starts_at')} />
        </Field>
        <Field label={t('Ends', 'ينتهي')} hint={badRange ? t('The end must be after the start.', 'يجب أن تكون النهاية بعد البداية.') : undefined}>
          <Input type="datetime-local" value={form.ends_at} onChange={set('ends_at')} />
        </Field>
        <Field label={t('Location', 'المكان')}>
          <Input value={form.location} onChange={set('location')} />
        </Field>
        <Field label={t('Budget (LKR)', 'الميزانية (روبية)')}>
          <Input type="number" min="0" step="0.01" value={form.budget} onChange={set('budget')} />
        </Field>
        <Field label={t('Linked duty', 'المسؤولية المرتبطة')}>
          <Select
            value={form.duty_role_id}
            onChange={set('duty_role_id')}
            placeholder={t('— None —', '— لا شيء —')}
            options={(duties.data || []).map((d) => ({ value: d.id, label: dutyName(d, lang) }))}
          />
        </Field>
        <Field label={t('Decided in mashoora', 'تقرر في الشورى')}>
          <Select
            value={form.meeting_id}
            onChange={set('meeting_id')}
            placeholder={t('— None —', '— لا شيء —')}
            options={(meetings.data || []).map((m) => ({ value: m.id, label: `${formatDate(m.meeting_date)} · ${m.title || ''}` }))}
          />
        </Field>
      </div>
      <Field label={t('Description', 'الوصف')}>
        <Textarea value={form.description} onChange={set('description')} />
      </Field>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Add people (several rows at once)
// ---------------------------------------------------------------------------
const newRow = () => ({ key: Math.random().toString(36).slice(2), profile_id: '', role: 'member', responsibilities: '' });

function AddPeopleModal({ activity, team, onClose, onSaved }) {
  const { t } = useLang();
  const staff = useStaff();
  const [rows, setRows] = useState([newRow()]);
  const [busy, setBusy] = useState(false);
  const existing = useMemo(() => new Set(team.map((x) => x.profile_id)), [team]);
  const update = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const chosen = rows.filter((r) => r.profile_id);
  const dupes = chosen.length !== new Set(chosen.map((r) => r.profile_id)).size;

  const save = async () => {
    setBusy(true);
    const people = chosen.map((r) => ({ profile_id: r.profile_id, role: r.role, responsibilities: r.responsibilities.trim() || null }));
    const ok = await runAction(() => assignActivityStaff(activity.id, people), t('People assigned and notified', 'تم تكليف الأشخاص وإشعارهم'));
    setBusy(false);
    if (ok) onSaved();
  };

  return (
    <Modal
      open
      title={`${t('Add people', 'إضافة أشخاص')} · ${activity.title}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t('Cancel', 'إلغاء')}</Button>
          <Button onClick={save} disabled={busy || !chosen.length || dupes}>
            {t('Assign', 'تكليف')} ({chosen.length})
          </Button>
        </>
      }
    >
      <p className="text-xs text-gray-400">
        {t('Each person gets a notification. Assigning someone already on the team updates their role and responsibilities.', 'يتلقى كل شخص إشعارًا. تكليف شخص موجود في الفريق يحدّث دوره ومسؤولياته.')}
      </p>
      {rows.map((r, i) => (
        <div key={r.key} className="rounded-xl border border-gray-800 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">#{i + 1}</span>
            {rows.length > 1 && (
              <Button size="sm" variant="ghost" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                {t('Remove row', 'حذف السطر')}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field
              label={t('Employee', 'الموظف')}
              hint={existing.has(r.profile_id) ? t('Already on the team — will be updated', 'موجود في الفريق — سيتم التحديث') : undefined}
            >
              <Select
                value={r.profile_id}
                onChange={(e) => update(r.key, { profile_id: e.target.value })}
                placeholder={staff.state.loading ? t('Loading…', 'جارٍ التحميل…') : t('Select…', 'اختر…')}
                options={staff.options}
              />
            </Field>
            <Field label={t('Role', 'الدور')}>
              <Select value={r.role} onChange={(e) => update(r.key, { role: e.target.value })} options={pairOptions(ASSIGNEE_ROLES, t)} />
            </Field>
          </div>
          <Field label={t('Responsibilities', 'المسؤوليات')}>
            <Input value={r.responsibilities} onChange={(e) => update(r.key, { responsibilities: e.target.value })} />
          </Field>
        </div>
      ))}
      {dupes && <p className="text-xs text-red-300">{t('The same person is listed twice.', 'الشخص نفسه مذكور مرتين.')}</p>}
      <Button size="sm" variant="secondary" onClick={() => setRows((rs) => [...rs, newRow()])}>
        {t('+ Add row', '+ إضافة سطر')}
      </Button>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------
function ActivityDetail({ activity, isGov, onBack, onEdit }) {
  const { t } = useLang();
  const [team, reloadTeam] = useAsync(() => listActivityTeam(activity.id), [activity.id]);
  const [expenses] = useAsync(() => listActivityExpenses(activity.id).catch(() => []), [activity.id]);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);

  useEffect(() => subscribeTable('activity_assignees', () => reloadTeam(), 'ops-activity-team'), [reloadTeam]);

  const spent = sumBy((expenses.data || []).filter((e) => ['approved', 'paid'].includes(e.status)), 'amount');
  const claimed = sumBy((expenses.data || []).filter((e) => !['rejected', 'void'].includes(e.status)), 'amount');
  const budget = num(activity.budget);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onBack}>{t('← Back to activities', '→ العودة إلى الأنشطة')}</Button>
        {isGov && <Button onClick={onEdit}>{t('Edit activity', 'تعديل النشاط')}</Button>}
      </div>
      <Card title={activity.title}>
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge tone="blue">{pairLabel(ACTIVITY_CATEGORIES, activity.category, t)}</Badge>
          <PairBadge map={ACTIVITY_STATUSES} value={activity.status} />
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div><dt className="text-gray-400">{t('Starts', 'يبدأ')}</dt><dd className="text-gray-100">{formatDateTime(activity.starts_at)}</dd></div>
          <div><dt className="text-gray-400">{t('Ends', 'ينتهي')}</dt><dd className="text-gray-100">{formatDateTime(activity.ends_at)}</dd></div>
          <div><dt className="text-gray-400">{t('Location', 'المكان')}</dt><dd className="text-gray-100">{activity.location || '—'}</dd></div>
          <div><dt className="text-gray-400">{t('Budget', 'الميزانية')}</dt><dd className="text-gray-100">{formatMoney(budget)}</dd></div>
        </dl>
        {activity.description && <p className="text-sm text-gray-300 mt-3 whitespace-pre-wrap">{activity.description}</p>}
      </Card>

      <Card
        title={t('Team', 'الفريق')}
        actions={isGov && <Button size="sm" onClick={() => setAdding(true)}>{t('+ Add people', '+ إضافة أشخاص')}</Button>}
      >
        <AsyncView state={team}>
          {(rows) => (
            <Table
              rows={rows}
              empty={t('Nobody assigned yet.', 'لم يُكلَّف أحد بعد.')}
              columns={[
                { key: 'person', label: t('Person', 'الشخص'), render: (r) => r.person?.full_name || '—' },
                { key: 'role', label: t('Role', 'الدور'), render: (r) => pairLabel(ASSIGNEE_ROLES, r.role, t) },
                { key: 'responsibilities', label: t('Responsibilities', 'المسؤوليات'), render: (r) => r.responsibilities || '—' },
                { key: 'status', label: t('Status', 'الحالة'), render: (r) => <PairBadge map={ASSIGNEE_STATUSES} value={r.status} /> },
                {
                  key: 'response_note',
                  label: t('Response note', 'ملاحظة الرد'),
                  render: (r) => (
                    <span>
                      {r.response_note || '—'}
                      {r.responded_at && <span className="block text-xs text-gray-500">{formatDateTime(r.responded_at)}</span>}
                    </span>
                  ),
                },
                ...(isGov
                  ? [{
                      key: 'actions',
                      label: '',
                      render: (r) => (
                        <Button size="sm" variant="ghost" onClick={() => setRemoving(r)}>{t('Remove', 'إزالة')}</Button>
                      ),
                    }]
                  : []),
              ]}
            />
          )}
        </AsyncView>
      </Card>

      <Card title={t('Expense claims for this activity', 'مطالبات المصروفات لهذا النشاط')}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <Stat label={t('Budget', 'الميزانية')} value={formatMoney(budget)} tone="gray" />
          <Stat label={t('Approved / paid', 'معتمد / مدفوع')} value={formatMoney(spent)} tone={budget && spent > budget ? 'red' : 'emerald'} />
          <Stat
            label={t('Remaining budget', 'الميزانية المتبقية')}
            value={formatMoney(budget - spent)}
            hint={`${t('Including pending claims', 'مع المطالبات المعلقة')}: ${formatMoney(budget - claimed)}`}
            tone={budget - spent < 0 ? 'red' : 'blue'}
          />
        </div>
        <AsyncView state={expenses}>
          {(rows) => (
            <Table
              rows={rows}
              empty={t('No expense claims are tagged to this activity.', 'لا توجد مطالبات مصروفات مرتبطة بهذا النشاط.')}
              columns={[
                { key: 'expense_date', label: t('Date', 'التاريخ'), render: (r) => formatDate(r.expense_date) },
                { key: 'expense_no', label: t('No.', 'الرقم'), render: (r) => r.expense_no || '—' },
                { key: 'payee', label: t('Payee', 'المستفيد') },
                { key: 'description', label: t('Description', 'الوصف') },
                { key: 'status', label: t('Status', 'الحالة'), render: (r) => <StatusBadgeLabel status={r.status} /> },
                { key: 'amount', label: t('Amount', 'المبلغ'), render: (r) => <Num>{formatMoney(r.amount)}</Num>, className: 'text-end' },
              ]}
            />
          )}
        </AsyncView>
      </Card>

      {adding && (
        <AddPeopleModal
          activity={activity}
          team={team.data || []}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            reloadTeam();
          }}
        />
      )}
      <ConfirmModal
        open={Boolean(removing)}
        title={t('Remove from team', 'إزالة من الفريق')}
        message={removing ? `${removing.person?.full_name || ''} · ${pairLabel(ASSIGNEE_ROLES, removing.role, t)}` : ''}
        confirmLabel={t('Remove', 'إزالة')}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          const ok = await runAction(() => removeActivityStaff(activity.id, removing.profile_id), t('Removed from the team', 'تمت الإزالة من الفريق'));
          if (ok) reloadTeam();
          return ok;
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// List (grouped, calendar-style date blocks)
// ---------------------------------------------------------------------------
function DateBlock({ iso }) {
  const d = new Date(iso);
  const valid = !Number.isNaN(d.getTime());
  return (
    <div className="w-14 shrink-0 rounded-xl bg-gray-900 border border-gray-800 text-center py-1.5">
      <div className="text-[10px] uppercase text-emerald-400">{valid ? d.toLocaleDateString('en-GB', { month: 'short' }) : '—'}</div>
      <div className="text-xl font-extrabold text-white leading-6">{valid ? d.getDate() : ''}</div>
      <div className="text-[10px] text-gray-500">{valid ? d.getFullYear() : ''}</div>
    </div>
  );
}

function ActivityRow({ a, onOpen }) {
  const { t } = useLang();
  return (
    <button
      type="button"
      onClick={() => onOpen(a)}
      className="w-full text-start flex gap-3 items-start rounded-xl border border-gray-800 hover:border-emerald-700 bg-gray-950/40 p-3 transition"
    >
      <DateBlock iso={a.starts_at} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-white">{a.title}</span>
          <Badge tone="blue">{pairLabel(ACTIVITY_CATEGORIES, a.category, t)}</Badge>
          <PairBadge map={ACTIVITY_STATUSES} value={a.status} />
        </div>
        <div className="text-xs text-gray-400 mt-1">
          {formatDateTime(a.starts_at)}
          {a.ends_at ? ` → ${formatDateTime(a.ends_at)}` : ''}
          {a.location ? ` · ${a.location}` : ''}
        </div>
        <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-3">
          <span>{t('Team', 'الفريق')}: {a.team.total}</span>
          <span className="text-emerald-300">{t('Accepted', 'مقبول')}: {a.team.accepted + a.team.done}</span>
          <span className="text-amber-300">{t('Awaiting reply', 'بانتظار الرد')}: {a.team.assigned}</span>
          {a.team.declined > 0 && <span className="text-red-300">{t('Declined', 'معتذر')}: {a.team.declined}</span>}
          {num(a.budget) > 0 && <span>{t('Budget', 'الميزانية')}: {formatMoney(a.budget)}</span>}
        </div>
      </div>
    </button>
  );
}

function ActivityList({ state, onOpen }) {
  const { t } = useLang();
  const [filters, setFilters] = useState({ q: '', category: '', status: '', when: '' });
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <AsyncView state={state}>
      {(list) => {
        const needle = filters.q.trim().toLowerCase();
        const shown = list.filter(
          (a) =>
            (!filters.category || a.category === filters.category) &&
            (!filters.status || a.status === filters.status) &&
            (!needle || `${a.title} ${a.location || ''} ${a.description || ''}`.toLowerCase().includes(needle)),
        );
        const groups = splitByTime(shown);
        const sections = [
          { id: 'ongoing', title: t('Happening now', 'جارٍ الآن'), rows: groups.ongoing },
          { id: 'upcoming', title: t('Upcoming', 'القادمة'), rows: groups.upcoming },
          { id: 'past', title: t('Past', 'السابقة'), rows: groups.past },
        ].filter((s) => !filters.when || s.id === filters.when);
        return (
          <>
            <FilterBar>
              <Field label={t('Search', 'بحث')}>
                <Input value={filters.q} onChange={set('q')} placeholder={t('Title or place…', 'العنوان أو المكان…')} />
              </Field>
              <Field label={t('Category', 'الفئة')}>
                <Select value={filters.category} onChange={set('category')} placeholder={t('All', 'الكل')} options={pairOptions(ACTIVITY_CATEGORIES, t)} />
              </Field>
              <Field label={t('Status', 'الحالة')}>
                <Select value={filters.status} onChange={set('status')} placeholder={t('All', 'الكل')} options={pairOptions(ACTIVITY_STATUSES, t)} />
              </Field>
              <Field label={t('When', 'متى')}>
                <Select
                  value={filters.when}
                  onChange={set('when')}
                  placeholder={t('All', 'الكل')}
                  options={[
                    { value: 'ongoing', label: t('Happening now', 'جارٍ الآن') },
                    { value: 'upcoming', label: t('Upcoming', 'القادمة') },
                    { value: 'past', label: t('Past', 'السابقة') },
                  ]}
                />
              </Field>
            </FilterBar>
            <div className="space-y-6">
              {sections.map((s) => (
                <Card key={s.id} title={`${s.title} (${s.rows.length})`}>
                  {s.rows.length ? (
                    <div className="space-y-2">
                      {s.rows.map((a) => (
                        <ActivityRow key={a.id} a={a} onOpen={onOpen} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState text={t('No activities here.', 'لا توجد أنشطة هنا.')} />
                  )}
                </Card>
              ))}
            </div>
          </>
        );
      }}
    </AsyncView>
  );
}

// ---------------------------------------------------------------------------
// My responsibilities (everyone)
// ---------------------------------------------------------------------------
function RespondModal({ item, mode, onClose, onDone }) {
  const { t } = useLang();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const needsNote = mode === 'declined';
  const titles = {
    accepted: t('Accept responsibility', 'قبول المسؤولية'),
    declined: t('Decline responsibility', 'الاعتذار عن المسؤولية'),
    done: t('Mark as done', 'تحديد كمنجز'),
  };
  const save = async () => {
    setBusy(true);
    const ok = await runAction(() => respondActivity(item.activity_id, mode, note.trim()), t('Response sent to the organiser', 'تم إرسال الرد إلى المنظم'));
    setBusy(false);
    if (ok) onDone();
  };
  return (
    <Modal
      open
      title={`${titles[mode]} · ${item.title}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t('Cancel', 'إلغاء')}</Button>
          <Button variant={needsNote ? 'danger' : 'primary'} onClick={save} disabled={busy || (needsNote && !note.trim())}>
            {titles[mode]}
          </Button>
        </>
      }
    >
      <Field label={needsNote ? t('Reason (required)', 'السبب (مطلوب)') : t('Note (optional)', 'ملاحظة (اختياري)')}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}

function MyResponsibilities() {
  const { t, lang } = useLang();
  const [state, reload] = useAsync(() => myResponsibilities(), []);
  const [responding, setResponding] = useState(null);

  useEffect(() => subscribeTable('activity_assignees', () => reload(), 'ops-my-activities'), [reload]);

  return (
    <AsyncView state={state}>
      {(data) => {
        const tasks = data.tasks || {};
        const acts = data.activities || [];
        const duties = data.duties || [];
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label={t('To do', 'للتنفيذ')} value={num(tasks.todo)} tone="gray" />
              <Stat label={t('In progress', 'قيد التنفيذ')} value={num(tasks.in_progress)} tone="blue" />
              <Stat label={t('Review', 'للمراجعة')} value={num(tasks.review)} tone="amber" />
              <Stat label={t('Overdue tasks', 'مهام متأخرة')} value={num(tasks.overdue)} tone={num(tasks.overdue) ? 'red' : 'emerald'} />
            </div>

            <Card title={`${t('My activities', 'أنشطتي')} (${acts.length})`}>
              {acts.length ? (
                <div className="space-y-3">
                  {acts.map((a) => (
                    <div key={a.activity_id} className="rounded-xl border border-gray-800 p-4 flex gap-3">
                      <DateBlock iso={a.starts_at} />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-white">{a.title}</span>
                          <Badge tone="blue">{pairLabel(ACTIVITY_CATEGORIES, a.category, t)}</Badge>
                          <Badge tone="green">{pairLabel(ASSIGNEE_ROLES, a.role, t)}</Badge>
                          <PairBadge map={ASSIGNEE_STATUSES} value={a.my_status} />
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatDateTime(a.starts_at)}
                          {a.ends_at ? ` → ${formatDateTime(a.ends_at)}` : ''}
                          {a.location ? ` · ${a.location}` : ''}
                        </div>
                        {a.responsibilities && (
                          <p className="text-sm text-gray-200">
                            <span className="text-gray-400">{t('My responsibilities', 'مسؤولياتي')}: </span>
                            {a.responsibilities}
                          </p>
                        )}
                        {a.team?.length > 0 && (
                          <div className="text-xs text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
                            <span>{t('Team', 'الفريق')}:</span>
                            {a.team.map((m, i) => (
                              <span key={`${m.name}-${i}`}>
                                {m.name} ({pairLabel(ASSIGNEE_ROLES, m.role, t)} · {pairLabel(ASSIGNEE_STATUSES, m.status, t)})
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {a.my_status === 'assigned' && (
                            <Button size="sm" onClick={() => setResponding({ item: a, mode: 'accepted' })}>{t('Accept', 'قبول')}</Button>
                          )}
                          {a.my_status !== 'done' && (
                            <Button size="sm" variant="secondary" onClick={() => setResponding({ item: a, mode: 'done' })}>{t('Mark done', 'تم الإنجاز')}</Button>
                          )}
                          {a.my_status !== 'done' && (
                            <Button size="sm" variant="danger" onClick={() => setResponding({ item: a, mode: 'declined' })}>{t('Decline', 'اعتذار')}</Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text={t('No open activities assigned to you.', 'لا توجد أنشطة مفتوحة مكلف بها.')} />
              )}
            </Card>

            <Card title={`${t('My duties', 'مسؤولياتي الدائمة')} (${duties.length})`}>
              <Table
                rows={duties}
                rowKey="assignment_id"
                empty={t('No active duties.', 'لا توجد مسؤوليات نشطة.')}
                columns={[
                  { key: 'name', label: t('Duty', 'المسؤولية'), render: (d) => dutyName(d, lang) },
                  { key: 'since', label: t('Since', 'منذ'), render: (d) => formatDate(d.since) },
                  { key: 'is_lead', label: t('Lead holder', 'مسؤول رئيسي'), render: (d) => (d.is_lead ? t('Yes', 'نعم') : t('No', 'لا')) },
                  {
                    key: 'extra',
                    label: t('Includes', 'يشمل'),
                    render: (d) => (
                      <span className="flex flex-wrap gap-1">
                        {d.grants_leave_review && <Badge tone="blue">{t('Leave review', 'مراجعة الإجازات')}</Badge>}
                        {d.petty_fund_id && <Badge tone="green">{t('Petty cash', 'النثرية')}</Badge>}
                        {!d.grants_leave_review && !d.petty_fund_id && '—'}
                      </span>
                    ),
                  },
                ]}
              />
            </Card>

            {responding && (
              <RespondModal
                item={responding.item}
                mode={responding.mode}
                onClose={() => setResponding(null)}
                onDone={() => {
                  setResponding(null);
                  reload();
                }}
              />
            )}
          </div>
        );
      }}
    </AsyncView>
  );
}

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------
export default function ActivitiesPanel() {
  const { t } = useLang();
  const { isGov } = useGovernance();
  const [tab, setTab] = useState('mine');
  const [list, reload] = useAsync(() => listActivities(), []);
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);

  useEffect(() => subscribeTable('activities', () => reload(), 'ops-activities'), [reload]);

  const open = openId ? (list.data || []).find((a) => a.id === openId) : null;

  return (
    <div>
      <PageHeader
        title={t('Activities', 'الأنشطة')}
        subtitle={t('Events, exam duties, trips and programmes with the staff responsible for each.', 'الفعاليات ومراقبة الامتحانات والرحلات والبرامج مع المسؤولين عن كل منها.')}
        actions={
          <>
            <Button variant="secondary" onClick={reload}>{t('Refresh', 'تحديث')}</Button>
            {isGov && <Button onClick={() => setEditing({})}>{t('+ New activity', '+ نشاط جديد')}</Button>}
          </>
        }
      />
      <Tabs
        tabs={[
          { id: 'mine', label: t('My responsibilities', 'مسؤولياتي') },
          { id: 'all', label: t('All activities', 'كل الأنشطة') },
        ]}
        active={tab}
        onChange={(id) => {
          setTab(id);
          setOpenId(null);
        }}
      />
      {tab === 'mine' && <MyResponsibilities />}
      {tab === 'all' &&
        (open ? (
          <ActivityDetail activity={open} isGov={isGov} onBack={() => setOpenId(null)} onEdit={() => setEditing(open)} />
        ) : (
          <ActivityList state={list} onOpen={(a) => setOpenId(a.id)} />
        ))}
      {editing && (
        <ActivityForm
          activity={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={(row) => {
            setEditing(null);
            reload();
            if (row?.id) {
              setTab('all');
              setOpenId(row.id);
            }
          }}
        />
      )}
    </div>
  );
}

function StatusBadgeLabel({ status }) {
  const { t } = useLang();
  const tone = { paid: 'green', approved: 'green', submitted: 'amber', draft: 'amber', rejected: 'red', void: 'red' }[status] || 'gray';
  return <Badge tone={tone}>{labelOf(EXPENSE_STATUSES, status, t)}</Badge>;
}
