import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';
import { AsyncView, Badge, Button, Card, EmptyState, PageHeader, Stat, Table, Tabs, useAsync, useLang } from '../ui';
import { Num } from '../finance/shared';
import { formatDate, formatMoney } from '../../../lib/erp/rpc';
import { PAYMENT_METHODS, labelOf, runAction } from '../../../lib/erp/financeApi';
import { CRM_STAGES } from '../../../lib/erp/campusApi';
import { dutyName } from '../../../lib/erp/governanceApi';
import {
  academicAnalytics, ageingRows, financeAnalytics, methodRows, monthRows, n, pct, sendFeeReminder, shortMonth, sumBy,
} from '../../../lib/erp/opsApi';
import { AXIS, CURSOR, ChartCard, ChartTooltip, GRID, Legend, RateBar, SERIES, TotalLine, axisProps, compact, moneyTooltip } from './common';

const TOTAL = '__total';
/** Append a bold totals row to a Table's rows. */
const withTotal = (rows, total) => (rows.length ? [...rows, { id: TOTAL, __total: true, ...total }] : rows);
const bold = (r, node) => (r.__total ? <strong className="text-white">{node}</strong> : node);
const money = (key) => (r) => bold(r, <Num>{formatMoney(r[key])}</Num>);

function PeriodPicker({ value, onChange, options }) {
  return (
    <div className="flex gap-1 rounded-xl bg-gray-900 border border-gray-800 p-1" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded-lg text-xs font-semibold ${value === o.value ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const pctTooltip = (props) => <ChartTooltip {...props} format={(v) => pct(v)} />;

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------
function FinanceView({ data, months, canRemind }) {
  const { t, lang } = useLang();
  const rows = monthRows(data.months);
  const chartRows = rows.map((r) => ({ ...r, label: shortMonth(r.month) }));
  const ageing = ageingRows(data.aging);
  const methods = methodRows(data.by_method);
  const byClass = data.by_class || [];
  const expenses = data.expenses_by_account || [];
  const petty = data.petty_cash_by_duty || [];
  const expTotal = sumBy(expenses, 'amount');

  const tot = {
    invoiced: sumBy(rows, 'invoiced'),
    collected_for_month: sumBy(rows, 'collected_for_month'),
    cash_received: sumBy(rows, 'cash_received'),
    donations: sumBy(rows, 'donations'),
    expenses: sumBy(rows, 'expenses'),
    petty_cash: sumBy(rows, 'petty_cash'),
    payroll: sumBy(rows, 'payroll'),
    outgoing: sumBy(rows, 'outgoing'),
    net: sumBy(rows, 'net'),
  };
  const periodLabel = `${t('Last', 'آخر')} ${months} ${t('months', 'أشهر')}`;
  const classLabel = (c) => (c === null || c === undefined ? t('No class', 'بلا صف') : `${t('Class', 'الصف')} ${c}`);

  const remind = async (r) => {
    const res = await runAction(() => sendFeeReminder(r.student_id));
    if (res?.ok) toast.success(`${t('Reminder sent', 'أُرسل التذكير')}: ${r.full_name || ''}`);
    else if (res) toast.info(t('This student has no arrears — no reminder sent.', 'لا توجد متأخرات على هذا الطالب — لم يُرسل تذكير.'));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Stat label={t('Invoiced', 'المفوتر')} value={formatMoney(tot.invoiced)} hint={periodLabel} tone="gray" />
        <Stat label={t('Collected for these months', 'المحصّل لهذه الأشهر')} value={formatMoney(tot.collected_for_month)} hint={periodLabel} />
        <Stat
          label={t('Collection rate', 'نسبة التحصيل')}
          value={pct(data.collection_rate)}
          hint={t('Collected ÷ invoiced, same months', 'المحصّل ÷ المفوتر، للأشهر نفسها')}
          tone={n(data.collection_rate) >= 90 ? 'emerald' : n(data.collection_rate) >= 70 ? 'amber' : 'red'}
        />
        <Stat label={t('Cash received', 'النقد المستلم')} value={formatMoney(tot.cash_received)} hint={periodLabel} tone="blue" />
        <Stat
          label={t('Outgoings', 'المدفوعات')}
          value={formatMoney(tot.outgoing)}
          hint={t('Expenses + petty cash + payroll', 'المصروفات + النثرية + الرواتب')}
          tone="amber"
        />
        <Stat
          label={t('Outstanding now', 'المتبقي حاليًا')}
          value={formatMoney(ageing.total)}
          hint={`${ageing.students} ${t('students', 'طلاب')}`}
          tone="red"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard
          title={t('Invoiced vs collected, by fee month', 'المفوتر مقابل المحصّل حسب شهر الرسوم')}
          subtitle={t('Collected = payments allocated to that month’s invoices, whenever they were paid.', 'المحصّل = المدفوعات المخصصة لفواتير ذلك الشهر، أيًّا كان وقت الدفع.')}
          legend={<Legend items={[{ label: t('Invoiced', 'المفوتر'), color: SERIES[0] }, { label: t('Collected', 'المحصّل'), color: SERIES[1] }]} />}
          table={
            <Table
              rows={withTotal(rows, { month: t('Total', 'الإجمالي'), invoiced: tot.invoiced, collected_for_month: tot.collected_for_month })}
              rowKey="month"
              columns={[
                { key: 'month', label: t('Month', 'الشهر'), render: (r) => bold(r, r.month) },
                { key: 'invoiced', label: t('Invoiced', 'المفوتر'), render: money('invoiced'), className: 'text-end' },
                { key: 'collected_for_month', label: t('Collected', 'المحصّل'), render: money('collected_for_month'), className: 'text-end' },
                {
                  key: 'rate',
                  label: t('Rate', 'النسبة'),
                  render: (r) => bold(r, <Num>{r.invoiced ? pct((r.collected_for_month * 100) / r.invoiced) : '—'}</Num>),
                  className: 'text-end',
                },
              ]}
            />
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="20%">
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={compact} width={44} />
              <Tooltip cursor={CURSOR} content={moneyTooltip} />
              <Bar dataKey="invoiced" name={t('Invoiced', 'المفوتر')} fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="collected_for_month" name={t('Collected', 'المحصّل')} fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={t('Cash received vs outgoings, by calendar month', 'النقد المستلم مقابل المدفوعات حسب الشهر')}
          subtitle={t('Outgoings = paid expenses + posted petty cash + approved payroll.', 'المدفوعات = المصروفات المدفوعة + النثرية المرحّلة + الرواتب المعتمدة.')}
          legend={<Legend line items={[{ label: t('Cash received', 'النقد المستلم'), color: SERIES[0] }, { label: t('Outgoings', 'المدفوعات'), color: SERIES[1] }]} />}
          table={
            <Table
              rows={withTotal(rows, { month: t('Total', 'الإجمالي'), ...tot })}
              rowKey="month"
              columns={[
                { key: 'month', label: t('Month', 'الشهر'), render: (r) => bold(r, r.month) },
                { key: 'cash_received', label: t('Cash received', 'النقد المستلم'), render: money('cash_received'), className: 'text-end' },
                { key: 'donations', label: t('Donations', 'التبرعات'), render: money('donations'), className: 'text-end' },
                { key: 'expenses', label: t('Expenses', 'المصروفات'), render: money('expenses'), className: 'text-end' },
                { key: 'petty_cash', label: t('Petty cash', 'النثرية'), render: money('petty_cash'), className: 'text-end' },
                { key: 'payroll', label: t('Payroll', 'الرواتب'), render: money('payroll'), className: 'text-end' },
                { key: 'outgoing', label: t('Outgoings', 'المدفوعات'), render: money('outgoing'), className: 'text-end' },
                { key: 'net', label: t('Net (cash + donations − outgoings)', 'الصافي (النقد + التبرعات − المدفوعات)'), render: money('net'), className: 'text-end' },
              ]}
            />
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} tickFormatter={compact} width={44} />
              <Tooltip cursor={{ stroke: AXIS, strokeWidth: 1 }} content={moneyTooltip} />
              <Line type="monotone" dataKey="cash_received" name={t('Cash received', 'النقد المستلم')} stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2 }} />
              <Line type="monotone" dataKey="outgoing" name={t('Outgoings', 'المدفوعات')} stroke={SERIES[1]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard
          title={t('Arrears ageing', 'أعمار المتأخرات')}
          subtitle={t('Days past the due date of each open invoice.', 'الأيام بعد تاريخ استحقاق كل فاتورة مفتوحة.')}
          height={220}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ageing.rows.map((r) => ({ name: t(r.label[0], r.label[1]), amount: r.amount }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="name" {...axisProps} interval={0} tick={{ fontSize: 10 }} />
              <YAxis {...axisProps} tickFormatter={compact} width={44} />
              <Tooltip cursor={CURSOR} content={moneyTooltip} />
              <Bar dataKey="amount" name={t('Outstanding', 'المتبقي')} fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <Card title={t('Ageing buckets add up to the total', 'مجموع فئات الأعمار يساوي الإجمالي')}>
          {ageing.rows.map((r) => (
            <TotalLine key={r.key} label={t(r.label[0], r.label[1])} value={formatMoney(r.amount)} />
          ))}
          <TotalLine strong label={t('Sum of buckets', 'مجموع الفئات')} value={formatMoney(ageing.sum)} />
          <TotalLine label={t('Total outstanding', 'إجمالي المتبقي')} value={formatMoney(ageing.total)} tone="text-white font-bold" />
          <div className="mt-2">
            {ageing.balanced ? (
              <Badge tone="green">✓ {t('Balanced', 'متوازن')}</Badge>
            ) : (
              <Badge tone="red">⚠ {t('Buckets differ from total — refresh', 'الفئات تختلف عن الإجمالي — حدّث')}</Badge>
            )}
          </div>
        </Card>
        <Card title={t('Payments by method', 'المدفوعات حسب الطريقة')}>
          <p className="text-xs text-gray-400 -mt-2 mb-2">{periodLabel}</p>
          {methods.rows.length ? (
            <>
              {methods.rows.map((r) => (
                <TotalLine
                  key={r.method}
                  label={`${labelOf(PAYMENT_METHODS, r.method, t)} · ${methods.total ? ((r.amount * 100) / methods.total).toFixed(1) : 0}%`}
                  value={formatMoney(r.amount)}
                />
              ))}
              <TotalLine strong label={t('Total', 'الإجمالي')} value={formatMoney(methods.total)} />
            </>
          ) : (
            <EmptyState text={t('No payments in this period.', 'لا توجد مدفوعات في هذه الفترة.')} />
          )}
        </Card>
      </div>

      <Card title={t('Collection by class', 'التحصيل حسب الصف')}>
        <Table
          rows={withTotal(
            byClass.map((c) => ({ ...c, id: String(c.class_number) })),
            {
              class_number: TOTAL,
              invoiced: sumBy(byClass, 'invoiced'),
              paid: sumBy(byClass, 'paid'),
              outstanding: sumBy(byClass, 'outstanding'),
              rate: sumBy(byClass, 'invoiced') ? (sumBy(byClass, 'paid') * 100) / sumBy(byClass, 'invoiced') : null,
            },
          )}
          empty={t('No invoices in this period.', 'لا توجد فواتير في هذه الفترة.')}
          columns={[
            { key: 'class_number', label: t('Class', 'الصف'), render: (r) => bold(r, r.__total ? t('All classes', 'كل الصفوف') : classLabel(r.class_number)) },
            { key: 'invoiced', label: t('Invoiced', 'المفوتر'), render: money('invoiced'), className: 'text-end' },
            { key: 'paid', label: t('Paid', 'المدفوع'), render: money('paid'), className: 'text-end' },
            { key: 'outstanding', label: t('Outstanding', 'المتبقي'), render: money('outstanding'), className: 'text-end' },
            { key: 'rate', label: t('Collection rate', 'نسبة التحصيل'), render: (r) => <RateBar value={r.rate} /> },
          ]}
        />
      </Card>

      <Card title={t('Top arrears', 'أعلى المتأخرات')}>
        <Table
          rows={data.top_arrears || []}
          rowKey="student_id"
          empty={t('No arrears.', 'لا توجد متأخرات.')}
          columns={[
            {
              key: 'full_name',
              label: t('Student', 'الطالب'),
              render: (r) => (
                <span>
                  {r.full_name}
                  {r.index_number && <span className="block text-xs text-gray-500">{r.index_number}</span>}
                </span>
              ),
            },
            { key: 'class_number', label: t('Class', 'الصف'), render: (r) => classLabel(r.class_number) },
            { key: 'oldest_due', label: t('Oldest due', 'أقدم استحقاق'), render: (r) => formatDate(r.oldest_due) },
            { key: 'balance', label: t('Balance', 'الرصيد'), render: (r) => <Num>{formatMoney(r.balance)}</Num>, className: 'text-end' },
            ...(canRemind
              ? [{ key: 'actions', label: '', render: (r) => <Button size="sm" variant="ghost" onClick={() => remind(r)}>{t('Remind', 'تذكير')}</Button> }]
              : []),
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title={t('Expenses by account', 'المصروفات حسب الحساب')}>
          <Table
            rows={withTotal(
              expenses.map((e) => ({ ...e, id: e.code })),
              { code: '', name: t('Total', 'الإجمالي'), amount: expTotal },
            )}
            empty={t('No paid expenses in this period.', 'لا توجد مصروفات مدفوعة في هذه الفترة.')}
            columns={[
              { key: 'name', label: t('Account', 'الحساب'), render: (r) => bold(r, r.__total ? r.name : `${r.code} · ${r.name}`) },
              { key: 'share', label: t('Share', 'الحصة'), render: (r) => (r.__total ? '' : <RateBar value={expTotal ? (n(r.amount) * 100) / expTotal : 0} />) },
              { key: 'amount', label: t('Amount', 'المبلغ'), render: money('amount'), className: 'text-end' },
            ]}
          />
        </Card>
        <Card title={t('Petty cash spent by duty', 'النثرية المصروفة حسب المسؤولية')}>
          <Table
            rows={withTotal(
              petty.map((p, i) => ({ ...p, id: `${p.duty}-${i}` })),
              { duty: t('Total', 'الإجمالي'), spent: sumBy(petty, 'spent') },
            )}
            empty={t('No petty cash spent in this period.', 'لا توجد نثرية مصروفة في هذه الفترة.')}
            columns={[
              { key: 'duty', label: t('Duty', 'المسؤولية'), render: (r) => bold(r, r.__total ? r.duty : dutyName({ name_en: r.duty, name_ar: r.name_ar, name_ta: r.name_ta }, lang)) },
              { key: 'spent', label: t('Spent', 'المصروف'), render: money('spent'), className: 'text-end' },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Academic
// ---------------------------------------------------------------------------
function AcademicView({ data }) {
  const { t } = useLang();
  const classLabel = (c) => (c === null || c === undefined ? t('No class', 'بلا صف') : `${t('Class', 'الصف')} ${c}`);
  const attMonths = (data.attendance_by_month || []).map((m) => ({ ...m, label: shortMonth(m.month), rate: m.rate === null ? null : n(m.rate) }));
  const attClass = (data.attendance_by_class || []).map((c) => ({ ...c, label: classLabel(c.class_number), rate: n(c.rate) }));
  const exam = data.latest_exam;
  const subjects = (exam?.subjects || []).map((s) => ({ ...s, average: n(s.average), pass_rate: n(s.pass_rate) }));
  const funnel = data.admissions_funnel || {};
  const funnelRows = [
    ...CRM_STAGES.map((s) => ({ stage: s.value, name: t(s.en, s.ar), count: n(funnel[s.value]) })),
    ...Object.keys(funnel)
      .filter((k) => !CRM_STAGES.some((s) => s.value === k))
      .map((k) => ({ stage: k, name: k.replace(/_/g, ' '), count: n(funnel[k]) })),
  ];
  const funnelTotal = sumBy(funnelRows, 'count');
  const funnelMax = Math.max(1, ...funnelRows.map((r) => r.count));
  const enrol = (data.enrolment_by_class || []).map((c) => ({ ...c, id: String(c.class_number), label: classLabel(c.class_number), students: n(c.students) }));
  const enrolTotal = sumBy(enrol, 'students');
  const leave = Object.entries(data.staff_leave_days || {}).map(([code, days]) => ({ id: code, code, days: n(days) }));
  const tasks = data.tasks || {};
  const overallAtt = (() => {
    const marked = sumBy(attMonths, 'marked');
    return marked ? attMonths.reduce((s, m) => s + n(m.rate) * n(m.marked), 0) / marked : null;
  })();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Stat label={t('Attendance rate', 'نسبة الحضور')} value={pct(overallAtt)} hint={t('Present or late ÷ marked', 'الحاضرون أو المتأخرون ÷ المسجَّلون')} />
        <Stat label={t('Enrolled students', 'الطلاب المسجلون')} value={enrolTotal} tone="blue" />
        <Stat label={t('Admissions conversion', 'نسبة تحويل القبول')} value={pct(data.admissions_conversion)} hint={`${funnelTotal} ${t('applications', 'طلبات')}`} tone="gray" />
        <Stat label={t('Open tasks', 'المهام المفتوحة')} value={n(tasks.open)} tone="gray" />
        <Stat label={t('Overdue tasks', 'مهام متأخرة')} value={n(tasks.overdue)} tone={n(tasks.overdue) ? 'red' : 'emerald'} />
        <Stat label={t('Tasks done (30 days)', 'مهام منجزة (30 يومًا)')} value={n(tasks.done_30d)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard
          title={t('Attendance trend', 'اتجاه الحضور')}
          table={
            <Table
              rows={attMonths}
              rowKey="month"
              empty={t('No attendance marked.', 'لا يوجد حضور مسجل.')}
              columns={[
                { key: 'month', label: t('Month', 'الشهر') },
                { key: 'marked', label: t('Marked', 'المسجَّل'), render: (r) => <Num>{n(r.marked)}</Num>, className: 'text-end' },
                { key: 'rate', label: t('Rate', 'النسبة'), render: (r) => <RateBar value={r.rate} /> },
              ]}
            />
          }
        >
          {attMonths.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attMonths} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} domain={[0, 100]} unit="%" width={44} />
                <Tooltip cursor={{ stroke: AXIS, strokeWidth: 1 }} content={pctTooltip} />
                <Line type="monotone" dataKey="rate" name={t('Attendance', 'الحضور')} stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text={t('No attendance marked.', 'لا يوجد حضور مسجل.')} />
          )}
        </ChartCard>

        <ChartCard
          title={t('Attendance by class (last 30 days)', 'الحضور حسب الصف (آخر 30 يومًا)')}
          table={
            <Table
              rows={attClass.map((c) => ({ ...c, id: String(c.class_number) }))}
              empty={t('No attendance marked.', 'لا يوجد حضور مسجل.')}
              columns={[
                { key: 'label', label: t('Class', 'الصف') },
                { key: 'marked', label: t('Marked', 'المسجَّل'), render: (r) => <Num>{n(r.marked)}</Num>, className: 'text-end' },
                { key: 'rate', label: t('Rate', 'النسبة'), render: (r) => <RateBar value={r.rate} /> },
              ]}
            />
          }
        >
          {attClass.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attClass} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} domain={[0, 100]} unit="%" width={44} />
                <Tooltip cursor={CURSOR} content={pctTooltip} />
                <Bar dataKey="rate" name={t('Attendance', 'الحضور')} fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text={t('No attendance marked.', 'لا يوجد حضور مسجل.')} />
          )}
        </ChartCard>
      </div>

      <Card title={t('Chronic absentees (below 75%, last 30 days)', 'الغياب المزمن (أقل من 75%، آخر 30 يومًا)')}>
        <Table
          rows={data.chronic_absentees || []}
          rowKey="student_id"
          empty={t('No students below 75% attendance.', 'لا يوجد طلاب حضورهم أقل من 75%.')}
          columns={[
            { key: 'full_name', label: t('Student', 'الطالب') },
            { key: 'class_number', label: t('Class', 'الصف'), render: (r) => classLabel(r.class_number) },
            { key: 'marked', label: t('Days marked', 'الأيام المسجلة'), render: (r) => <Num>{n(r.marked)}</Num>, className: 'text-end' },
            { key: 'rate', label: t('Attendance', 'الحضور'), render: (r) => <RateBar value={r.rate} /> },
          ]}
        />
      </Card>

      <ChartCard
        title={exam ? `${t('Latest published exam', 'آخر امتحان منشور')}: ${exam.name}${exam.class_number ? ` · ${classLabel(exam.class_number)}` : ''}` : t('Latest published exam', 'آخر امتحان منشور')}
        subtitle={t('Pass = 40% or more.', 'النجاح = 40% أو أكثر.')}
        legend={subjects.length ? <Legend items={[{ label: t('Average', 'المتوسط'), color: SERIES[0] }, { label: t('Pass rate', 'نسبة النجاح'), color: SERIES[1] }]} /> : null}
        table={
          <Table
            rows={subjects}
            rowKey="subject"
            empty={t('No published exam yet.', 'لا يوجد امتحان منشور بعد.')}
            columns={[
              { key: 'subject', label: t('Subject', 'المادة') },
              { key: 'entries', label: t('Entries', 'المشاركات'), render: (r) => <Num>{n(r.entries)}</Num>, className: 'text-end' },
              { key: 'average', label: t('Average', 'المتوسط'), render: (r) => <RateBar value={r.average} /> },
              { key: 'pass_rate', label: t('Pass rate', 'نسبة النجاح'), render: (r) => <RateBar value={r.pass_rate} /> },
            ]}
          />
        }
      >
        {subjects.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subjects} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="subject" {...axisProps} interval={0} tick={{ fontSize: 10 }} />
              <YAxis {...axisProps} domain={[0, 100]} unit="%" width={44} />
              <Tooltip cursor={CURSOR} content={pctTooltip} />
              <Bar dataKey="average" name={t('Average', 'المتوسط')} fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="pass_rate" name={t('Pass rate', 'نسبة النجاح')} fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState text={t('No published exam yet.', 'لا يوجد امتحان منشور بعد.')} />
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={t('Admissions funnel', 'مسار القبول')}>
          <div className="space-y-2">
            {funnelRows.map((r) => (
              <div key={r.stage} className="text-sm">
                <div className="flex justify-between text-gray-300">
                  <span>{r.name}</span>
                  <span className="tabular-nums font-semibold text-gray-100">{r.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden mt-1">
                  <div className="h-full rounded-full" style={{ width: `${(r.count * 100) / funnelMax}%`, background: SERIES[0] }} />
                </div>
              </div>
            ))}
          </div>
          <TotalLine strong label={t('Applications in period', 'الطلبات في الفترة')} value={funnelTotal} />
          <TotalLine label={t('Conversion (enrolled ÷ applications)', 'التحويل (المسجلون ÷ الطلبات)')} value={pct(data.admissions_conversion)} tone="text-emerald-300" />
        </Card>
        <Card title={t('Enrolment by class', 'التسجيل حسب الصف')}>
          <Table
            rows={withTotal(enrol, { label: t('All classes', 'كل الصفوف'), students: enrolTotal })}
            empty={t('No enrolled students.', 'لا يوجد طلاب مسجلون.')}
            columns={[
              { key: 'label', label: t('Class', 'الصف'), render: (r) => bold(r, r.label) },
              { key: 'students', label: t('Students', 'الطلاب'), render: (r) => bold(r, <Num>{r.students}</Num>), className: 'text-end' },
            ]}
          />
        </Card>
        <Card title={t('Staff leave days (this year, approved)', 'أيام إجازات الموظفين (هذا العام، المعتمدة)')}>
          <Table
            rows={withTotal(leave, { code: t('Total', 'الإجمالي'), days: sumBy(leave, 'days') })}
            empty={t('No approved leave this year.', 'لا توجد إجازات معتمدة هذا العام.')}
            columns={[
              { key: 'code', label: t('Leave type', 'نوع الإجازة'), render: (r) => bold(r, r.code) },
              { key: 'days', label: t('Days', 'الأيام'), render: (r) => bold(r, <Num>{r.days}</Num>), className: 'text-end' },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------
export default function AnalyticsPanel() {
  const { t } = useLang();
  const auth = useAuth();
  const canFinance = Boolean(auth.isFinanceViewer);
  const canAcademic = Boolean(auth.isAdmin || auth.isAcademicAdmin || auth.isAdmissionsStaff || auth.isHrStaff);
  const [tab, setTab] = useState(canFinance ? 'finance' : 'academic');
  const [months, setMonths] = useState(12);
  const [days, setDays] = useState(180);
  const [fin, reloadFin] = useAsync(() => (canFinance ? financeAnalytics(months) : Promise.resolve(null)), [canFinance, months]);
  const [acad, reloadAcad] = useAsync(() => (canAcademic && tab === 'academic' ? academicAnalytics(days) : Promise.resolve(null)), [canAcademic, tab, days]);

  const tabs = [
    ...(canFinance ? [{ id: 'finance', label: t('Finance', 'المالية') }] : []),
    ...(canAcademic ? [{ id: 'academic', label: t('Academic', 'الأكاديمي') }] : []),
  ];
  const asOf = (tab === 'finance' ? fin.data : acad.data)?.as_of;

  return (
    <div>
      <PageHeader
        title={t('Analytics', 'التحليلات')}
        subtitle={asOf ? `${t('As of', 'حتى تاريخ')} ${formatDate(asOf)}` : t('Trends and totals from the ledger and registers.', 'الاتجاهات والمجاميع من السجلات.')}
        actions={
          <>
            {tab === 'finance' ? (
              <PeriodPicker
                value={months}
                onChange={setMonths}
                options={[6, 12, 24].map((m) => ({ value: m, label: `${m} ${t('months', 'أشهر')}` }))}
              />
            ) : (
              <PeriodPicker
                value={days}
                onChange={setDays}
                options={[90, 180, 365].map((d) => ({ value: d, label: `${d} ${t('days', 'أيام')}` }))}
              />
            )}
            <Button variant="secondary" onClick={tab === 'finance' ? reloadFin : reloadAcad}>{t('Refresh', 'تحديث')}</Button>
          </>
        }
      />
      {tabs.length > 1 && <Tabs tabs={tabs} active={tab} onChange={setTab} />}
      {!tabs.length && <EmptyState text={t('You do not have access to analytics.', 'ليست لديك صلاحية للتحليلات.')} />}
      {tab === 'finance' && canFinance && (
        <AsyncView state={fin}>{(d) => <FinanceView data={d || {}} months={months} canRemind={Boolean(auth.isFinanceStaff)} />}</AsyncView>
      )}
      {tab === 'academic' && canAcademic && <AsyncView state={acad}>{(d) => <AcademicView data={d || {}} />}</AsyncView>}
    </div>
  );
}
