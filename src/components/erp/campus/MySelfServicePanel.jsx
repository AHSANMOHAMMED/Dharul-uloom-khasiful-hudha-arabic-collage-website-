import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { AsyncView, Button, Card, Input, PageHeader, Stat, StatusBadge, Table, Tabs, useAsync, useLang } from '../ui';
import { currentMonth, formatDate, formatMoney, query, rpc, today } from '../../../lib/erp/rpc';
import { DAYS, DAYS_AR, monthRange } from '../../../lib/erp/campusApi';
import { useAction } from './hooks';
import SelfLeave from './SelfLeave';
import SelfPayslips from './SelfPayslips';

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
  const { t, ar } = useLang();
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
                      <div className="font-bold text-emerald-300 mb-2">{ar ? DAYS_AR[d] : d}</div>
                      <ul className="space-y-1 text-sm">
                        {items.map((r) => (
                          <li key={r.id} className="flex justify-between gap-2">
                            <span className="text-gray-400 whitespace-nowrap">{String(r.start_time).slice(0, 5)}–{String(r.end_time).slice(0, 5)}</span>
                            <span className="text-gray-100 text-end">
                              {(ar ? r.subjects?.name_ar : r.subjects?.name_en) || r.subject} · {t('Class', 'الصف')} {r.class_number}
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
                { key: 'subject', label: t('Subject', 'المادة'), render: (r) => (ar ? r.subjects?.name_ar || r.subjects?.name_en : r.subjects?.name_en) },
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
        ]}
      />
      {tab === 'attendance' && <AttendanceTab user={user} />}
      {tab === 'leave' && <SelfLeave user={user} />}
      {tab === 'payslips' && <SelfPayslips user={user} />}
      {tab === 'timetable' && <TimetableTab user={user} />}
      {tab === 'claims' && <ClaimsTab user={user} />}
    </div>
  );
}
