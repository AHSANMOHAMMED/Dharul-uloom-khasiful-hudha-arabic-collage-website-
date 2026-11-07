import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { AsyncView, Badge, Button, Card, Input, PageHeader, Stat, Table, Tabs, useAsync, useLang } from '../ui';
import { currentMonth, formatDate, formatMoney, query, rpc, today } from '../../../lib/erp/rpc';
import { DAYS, DAYS_AR, monthRange } from '../../../lib/erp/campusApi';
import { useAction } from './hooks';
import SelfLeave from './SelfLeave';
import SelfPayslips from './SelfPayslips';
import { TASK_STATUSES, TASK_STATUS_LABELS, dutyName, listAssignments, listFunds, listTasks, pairLabel } from '../../../lib/erp/governanceApi';

const STATUS_LABELS = {
  present: ['Present', 'حاضر', 'green'],
  half_day: ['Half day', 'نصف يوم', 'amber'],
  late: ['Late', 'متأخر', 'amber'],
  leave: ['Leave', 'إجازة', 'blue'],
  absent: ['Absent', 'غائب', 'red'],
  holiday: ['Holiday', 'عطلة', 'gray'],
  submitted: ['Submitted', 'مقدَّم', 'amber'],
  approved: ['Approved', 'معتمد', 'blue'],
  rejected: ['Rejected', 'مرفوض', 'red'],
  paid: ['Paid', 'مدفوع', 'green'],
  void: ['Void', 'ملغى', 'red'],
  draft: ['Draft', 'مسودة', 'amber'],
};

function StatusBadge({ status }) {
  const { t } = useLang();
  const s = STATUS_LABELS[status];
  return <Badge tone={s?.[2] || 'gray'}>{s ? t(s[0], s[1]) : String(status ?? '—').replace(/_/g, ' ')}</Badge>;
}

const subjectName = (s, lang) => (lang === 'ar' && s?.name_ar) || s?.name_en || '';

function AttendanceTab({ user }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [month, setMonth] = useState(currentMonth());
  const [state, reload] = useAsync(() => {
    const { start, end } = monthRange(month);
    return query('staff_attendance', (q) =>
      q.select('*').eq('profile_id', user.id).gte('date', start).lte('date', end).order('date', { ascending: false })
    );
  }, [user.id, month]);

  const rows = state.data || [];
  const todayRow = month === currentMonth() ? rows.find((r) => r.date === today()) : null;
  const count = (s) => rows.filter((r) => r.status === s).length;

  const checkIn = async () => {
    const res = await run(() => rpc('staff_check_in'), (r) => `${t('Checked in at', 'تم تسجيل الحضور في')} ${r?.check_in || ''}`);
    if (res.ok) reload();
  };
  const checkOut = async () => {
    const res = await run(() => rpc('staff_check_out'), (r) => `${t('Checked out at', 'تم تسجيل الانصراف في')} ${r?.check_out || ''}`);
    if (res.ok) reload();
  };

  return (
    <div className="space-y-6">
      <Card title={t('Today', 'اليوم')} actions={<span className="text-sm text-gray-400">{formatDate(today())}</span>}>
        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={checkIn} disabled={busy || Boolean(todayRow?.check_in)}>{t('Check in', 'تسجيل الحضور')}</Button>
          <Button variant="secondary" onClick={checkOut} disabled={busy || !todayRow?.check_in}>{t('Check out', 'تسجيل الانصراف')}</Button>
          <div className="text-sm text-gray-300">
            {todayRow ? (
              <>
                <StatusBadge status={todayRow.status} />
                <span className="ms-3">{t('In', 'دخول')}: {todayRow.check_in || '—'}</span>
                <span className="ms-3">{t('Out', 'خروج')}: {todayRow.check_out || '—'}</span>
              </>
            ) : (
              <span className="text-gray-500">{t('Not checked in yet today.', 'لم تسجل الحضور اليوم بعد.')}</span>
            )}
          </div>
        </div>
      </Card>
      <Card
        title={t('My attendance', 'حضوري')}
        actions={
          <div className="w-44">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value || currentMonth())} />
          </div>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Stat label={t('Present', 'حاضر')} value={count('present')} />
          <Stat label={t('Half day', 'نصف يوم')} value={count('half_day')} tone="amber" />
          <Stat label={t('Leave', 'إجازة')} value={count('leave')} tone="blue" />
          <Stat label={t('Absent', 'غائب')} value={count('absent')} tone="red" />
          <Stat label={t('Holiday', 'عطلة')} value={count('holiday')} tone="gray" />
        </div>
        <AsyncView state={state}>
          {(list) => (
            <Table
              rows={list}
              empty={t('No attendance records this month.', 'لا توجد سجلات لهذا الشهر.')}
              columns={[
                { key: 'date', label: t('Date', 'التاريخ'), render: (r) => formatDate(r.date) },
                { key: 'status', label: t('Status', 'الحالة'), render: (r) => <StatusBadge status={r.status} /> },
                { key: 'check_in', label: t('Check in', 'الحضور') },
                { key: 'check_out', label: t('Check out', 'الانصراف') },
                { key: 'note', label: t('Note', 'ملاحظة') },
              ]}
            />
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
function TimetableTab({ user }) {
  const { t, lang } = useLang();
  const [state] = useAsync(
    () =>
      query('class_schedules', (q) =>
        q.select('*, subjects(name_en, name_ar, code)').eq('tutor_id', user.id).order('start_time')
      ),
    [user.id]
  );
  const [classes] = useAsync(
    () => query('class_subjects', (q) => q.select('id, class_number, weekly_periods, subjects(name_en, name_ar, code)').eq('tutor_id', user.id).order('class_number')),
    [user.id]
  );
  return (
    <div className="space-y-6">
      <Card title={t('My weekly timetable', 'جدولي الأسبوعي')}>
        <AsyncView state={state}>
          {(rows) =>
            rows.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {DAYS.map((d) => {
                  const items = rows.filter((r) => r.day_of_week === d);
                  if (!items.length) return null;
                  return (
                    <div key={d} className="rounded-xl border border-gray-800 p-3">
                      <div className="font-bold text-emerald-300 mb-2">{t(d, DAYS_AR[d])}</div>
                      <ul className="space-y-1 text-sm">
                        {items.map((r) => (
                          <li key={r.id} className="flex justify-between gap-2">
                            <span className="text-gray-400 whitespace-nowrap">{String(r.start_time).slice(0, 5)}–{String(r.end_time).slice(0, 5)}</span>
                            <span className="text-gray-100 text-end">
                              {subjectName(r.subjects, lang) || r.subject} · {t('Class', 'الصف')} {r.class_number}
                              {r.room ? ` · ${r.room}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-6 text-center">{t('No timetable periods assigned to you.', 'لا توجد حصص مسندة إليك.')}</p>
            )
          }
        </AsyncView>
      </Card>
      <Card title={t('My subject assignments', 'المواد المسندة إلي')}>
        <AsyncView state={classes}>
          {(rows) => (
            <Table
              rows={rows}
              empty={t('No subjects assigned.', 'لا توجد مواد مسندة.')}
              columns={[
                { key: 'class_number', label: t('Class', 'الصف') },
                { key: 'subject', label: t('Subject', 'المادة'), render: (r) => subjectName(r.subjects, lang) },
                { key: 'weekly_periods', label: t('Periods / week', 'حصص أسبوعية') },
              ]}
            />
          )}
        </AsyncView>
      </Card>
    </div>
  );
}

function ClaimsTab({ user }) {
  const { t } = useLang();
  const [, setParams] = useSearchParams();
  const [state] = useAsync(
    () =>
      query('expenses', (q) =>
        q.select('id, expense_no, expense_date, payee, description, amount, status, rejection_reason')
          .eq('submitted_by', user.id).order('expense_date', { ascending: false }).limit(100)
      ),
    [user.id]
  );
  return (
    <Card
      title={t('My expense claims', 'مطالباتي بالمصروفات')}
      actions={<Button size="sm" onClick={() => setParams({ module: 'expenses' })}>{t('New claim in Expenses', 'مطالبة جديدة')} →</Button>}
    >
      <AsyncView state={state}>
        {(rows) => (
          <Table
            rows={rows}
            empty={t('No claims submitted.', 'لا توجد مطالبات.')}
            columns={[
              { key: 'expense_no', label: t('No.', 'الرقم') },
              { key: 'expense_date', label: t('Date', 'التاريخ'), render: (r) => formatDate(r.expense_date) },
              { key: 'description', label: t('Description', 'الوصف') },
              { key: 'amount', label: t('Amount', 'المبلغ'), render: (r) => formatMoney(r.amount) },
              { key: 'status', label: t('Status', 'الحالة'), render: (r) => <StatusBadge status={r.status} /> },
              { key: 'rejection_reason', label: t('Note', 'ملاحظة') },
            ]}
          />
        )}
      </AsyncView>
    </Card>
  );
}

function DutiesTab({ user }) {
  const { t, lang } = useLang();
  const [, setParams] = useSearchParams();
  const [state] = useAsync(async () => {
    const [active, past, funds, tasks] = await Promise.all([
      listAssignments({ status: 'active', assigneeId: user.id }),
      listAssignments({ status: 'ended', assigneeId: user.id }),
      listFunds().catch(() => []),
      listTasks({ assigneeId: user.id }).catch(() => []),
    ]);
    return { active, past, funds: funds.filter((f) => f.holders.some((h) => h.assignee_id === user.id)), tasks };
  }, [user.id]);

  return (
    <AsyncView state={state}>
      {({ active, past, funds, tasks }) => (
        <div className="space-y-6">
          <Card title={t('My duties', 'مسؤولياتي')} actions={<Button size="sm" variant="secondary" onClick={() => setParams({ module: 'duties' })}>{t('All duties', 'كل المسؤوليات')} →</Button>}>
            {active.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {active.map((a) => (
                  <div key={a.id} className="rounded-xl border border-gray-800 p-3">
                    <div className="font-bold text-emerald-300">{dutyName(a.duty, lang)}</div>
                    <div className="text-xs text-gray-400">
                      {t('Since', 'منذ')} {formatDate(a.start_date)}
                      {a.year?.name ? ` · ${a.year.name}` : ''}
                    </div>
                    {a.meeting && (
                      <div className="text-xs text-gray-500">
                        {t('Decided at', 'تقرر في')}: {a.meeting.title} · {formatDate(a.meeting.meeting_date)}
                      </div>
                    )}
                    {!a.is_lead && <Badge>{t('Co-holder', 'مشارك')}</Badge>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-4 text-center">{t('You hold no duty at the moment.', 'لا تتولى أي مسؤولية حاليًا.')}</p>
            )}
          </Card>
          <Card title={t('My petty cash', 'نثريتي')}>
            <Table
              rows={funds}
              empty={t('No petty cash funds for your duties.', 'لا توجد صناديق نثرية لمسؤولياتك.')}
              columns={[
                { key: 'duty', label: t('Duty', 'المسؤولية'), render: (f) => dutyName(f.duty, lang) },
                { key: 'balance', label: t('Balance', 'الرصيد'), render: (f) => formatMoney(f.balance.posted_balance) },
                { key: 'pending', label: t('Pending approval', 'بانتظار الاعتماد'), render: (f) => formatMoney(f.balance.pending_spend) },
                { key: 'available', label: t('Available', 'المتاح'), render: (f) => <b>{formatMoney(f.balance.available)}</b> },
                {
                  key: 'act',
                  label: '',
                  render: (f) =>
                    f.is_active && (
                      <Button size="sm" onClick={() => setParams({ module: 'pettycash', spend: f.id })}>
                        {t('Record spend', 'تسجيل صرف')}
                      </Button>
                    ),
                },
              ]}
            />
          </Card>
          <Card title={t('My tasks', 'مهامي')} actions={<Button size="sm" onClick={() => setParams({ module: 'tasks' })}>{t('Open task board', 'فتح لوحة المهام')} →</Button>}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {TASK_STATUSES.map((s) => (
                <Stat
                  key={s}
                  label={pairLabel(TASK_STATUS_LABELS, s, t)}
                  value={tasks.filter((x) => x.status === s).length}
                  tone={{ todo: 'gray', in_progress: 'blue', review: 'amber', done: 'emerald' }[s]}
                />
              ))}
            </div>
            {tasks.some((x) => x.status !== 'done' && x.due_date && x.due_date < today()) && (
              <p className="text-sm text-red-400 mt-3">
                {t('Overdue tasks', 'مهام متأخرة')}: {tasks.filter((x) => x.status !== 'done' && x.due_date && x.due_date < today()).length}
              </p>
            )}
          </Card>
          <Card title={t('My past duties', 'مسؤولياتي السابقة')}>
            <Table
              rows={past}
              empty={t('No past duties.', 'لا توجد مسؤوليات سابقة.')}
              columns={[
                { key: 'duty', label: t('Duty', 'المسؤولية'), render: (a) => dutyName(a.duty, lang) },
                { key: 'period', label: t('Period', 'الفترة'), render: (a) => `${formatDate(a.start_date)} → ${formatDate(a.end_date)}` },
                { key: 'year', label: t('Academic year', 'العام الدراسي'), render: (a) => a.year?.name || '—' },
                { key: 'meeting', label: t('Decided at', 'تقرر في'), render: (a) => a.meeting?.title || '—' },
                { key: 'end_reason', label: t('Note', 'ملاحظة') },
              ]}
            />
          </Card>
        </div>
      )}
    </AsyncView>
  );
}

export default function MySelfServicePanel() {
  const { t } = useLang();
  const { user } = useAuth();
  const [tab, setTab] = useState('attendance');
  if (!user) return null;
  return (
    <div>
      <PageHeader
        title={t('My workspace', 'مساحتي')}
        subtitle={`${user.username || ''}${user.staffRoles?.length ? ` · ${user.staffRoles.join(', ')}` : ''}`}
      />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'attendance', label: t('Attendance', 'الحضور') },
          { id: 'leave', label: t('Leave', 'الإجازات') },
          { id: 'payslips', label: t('Payslips', 'قسائم الراتب') },
          { id: 'timetable', label: t('My classes', 'حصصي') },
          { id: 'claims', label: t('Expense claims', 'المطالبات') },
          { id: 'duties', label: t('My duties', 'مسؤولياتي') },
        ]}
      />
      {tab === 'attendance' && <AttendanceTab user={user} />}
      {tab === 'leave' && <SelfLeave user={user} />}
      {tab === 'payslips' && <SelfPayslips user={user} />}
      {tab === 'timetable' && <TimetableTab user={user} />}
      {tab === 'claims' && <ClaimsTab user={user} />}
      {tab === 'duties' && <DutiesTab user={user} />}
    </div>
  );
}
