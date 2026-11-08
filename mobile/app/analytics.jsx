import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { formatDate } from '../lib/format';
import { methodLabel } from '../lib/receipts';
import { colors } from '../lib/theme';
import {
  Screen, Card, Txt, Chips, SectionHeader, KeyValue, EmptyState, ListItem, Money, StatTile, TileGrid, HBar, Legend, ColumnChart, useMoney,
} from '../components';

const sum = (rows, key) => (rows || []).reduce((s, r) => s + Number(r?.[key] || 0), 0);
const pctText = (v) => (v == null ? '—' : `${Number(v).toFixed(1).replace(/\.0$/, '')}%`);
const FUNNEL = ['lead', 'submitted', 'interview', 'accepted', 'enrolled', 'rejected'];

// Short compact money for chart scales: 1.2M / 350K.
function compact(n) {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(Math.round(v));
}

function monthLabel(t, ym) {
  const m = Number(String(ym || '').slice(5, 7));
  return m >= 1 && m <= 12 ? t(`month.short.${m}`) : String(ym || '');
}

function FinanceTab() {
  const { t } = useI18n();
  const money = useMoney();
  const [months, setMonths] = useState(12);
  const q = useAsync(() => must(supabase.rpc('finance_analytics', { p_months: months })), [months]);
  const d = q.data || {};
  const rows = d.months || [];
  const aging = d.aging || {};
  const byClass = d.by_class || [];
  const methods = Object.entries(d.by_method || {}).sort((a, b) => Number(b[1]) - Number(a[1]));
  const expenses = (d.expenses_by_account || []).slice(0, 8);

  const invoiced = sum(rows, 'invoiced');
  const collected = sum(rows, 'collected_for_month');
  const cash = sum(rows, 'cash_received');
  const spent = sum(rows, 'expenses') + sum(rows, 'petty_cash');
  const agingRows = [
    ['not_due', colors.info],
    ['d0_30', colors.gold],
    ['d31_60', '#d97706'],
    ['d61_90', '#c2410c'],
    ['d90_plus', colors.danger],
  ];
  const agingMax = Math.max(0, ...agingRows.map(([k]) => Number(aging[k] || 0)));
  const methodMax = Math.max(0, ...methods.map(([, v]) => Number(v || 0)));
  const expenseMax = Math.max(0, ...expenses.map((e) => Number(e.amount || 0)));

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Chips
        options={[6, 12, 24].map((n) => ({ value: n, label: t('analytics.lastMonths', { n }) }))}
        value={months}
        onChange={setMonths}
      />
      {q.data ? (
        <>
          <Txt variant="small">{t('analytics.asOf', { date: formatDate(d.as_of) })}</Txt>
          <Card accent={colors.gold}>
            <Txt variant="label">{t('analytics.totalsFor', { n: months })}</Txt>
            <KeyValue label={t('analytics.invoiced')} value={<Money amount={invoiced} />} />
            <KeyValue label={t('analytics.collectedForMonths')} value={<Money amount={collected} tone="success" />} />
            <KeyValue label={t('analytics.cashReceived')} value={<Money amount={cash} tone="success" />} />
            <KeyValue label={t('analytics.collectionRate')} value={pctText(d.collection_rate)} strong />
            <KeyValue label={t('analytics.spent')} value={<Money amount={spent} tone="danger" />} />
          </Card>

          <SectionHeader title={t('analytics.trend')} />
          <Card>
            <Legend
              items={[
                { label: t('analytics.invoiced'), color: colors.gold },
                { label: t('analytics.collected'), color: colors.primary },
              ]}
            />
            {rows.length ? (
              <ColumnChart
                data={rows.map((r) => ({ key: r.month, label: monthLabel(t, r.month), title: r.month, values: [r.invoiced, r.collected_for_month] }))}
                seriesColors={[colors.gold, colors.primary]}
                seriesLabels={[t('analytics.invoiced'), t('analytics.collected')]}
                format={compact}
              />
            ) : (
              <EmptyState message={t('analytics.noData')} icon="bar-chart-outline" />
            )}
            <Txt variant="small">{t('analytics.tapColumn')}</Txt>
          </Card>

          <SectionHeader title={t('analytics.aging')} />
          <Card>
            <KeyValue label={t('analytics.totalOutstanding')} value={<Money amount={aging.total} tone="danger" />} strong />
            <KeyValue label={t('analytics.studentsOwing')} value={String(aging.students ?? 0)} />
            {agingRows.map(([k, c]) => (
              <HBar key={k} label={t(`analytics.age.${k}`)} value={Number(aging[k] || 0)} max={agingMax} display={money(aging[k])} color={c} />
            ))}
          </Card>

          <SectionHeader title={t('analytics.byClass')} />
          <Card>
            <Txt variant="small">{t('analytics.byClassHint')}</Txt>
            {!byClass.length ? <Txt variant="muted">{t('analytics.noData')}</Txt> : null}
            {byClass.map((c) => (
              <HBar
                key={String(c.class_number)}
                label={c.class_number != null ? t('common.classN', { n: c.class_number }) : t('analytics.noClass')}
                value={Number(c.rate || 0)}
                max={100}
                display={pctText(c.rate)}
                sub={`${t('analytics.invoiced')} ${money(c.invoiced)} · ${t('analytics.outstanding')} ${money(c.outstanding)}`}
                color={Number(c.rate || 0) >= 80 ? colors.primary : Number(c.rate || 0) >= 50 ? colors.gold : colors.danger}
              />
            ))}
          </Card>

          {methods.length ? (
            <>
              <SectionHeader title={t('analytics.byMethod')} />
              <Card>
                {methods.map(([m, v]) => (
                  <HBar key={m} label={methodLabel(t, m)} value={Number(v)} max={methodMax} display={money(v)} color={colors.info} />
                ))}
              </Card>
            </>
          ) : null}

          <SectionHeader title={t('analytics.topArrears')} />
          {!(d.top_arrears || []).length ? <EmptyState message={t('admin.noOutstanding')} icon="checkmark-circle-outline" /> : null}
          {(d.top_arrears || []).map((s, i) => (
            <ListItem
              key={s.student_id}
              icon="person-circle-outline"
              iconColor={colors.danger}
              title={`${i + 1}. ${s.full_name}`}
              subtitle={[s.index_number, s.class_number ? t('common.classN', { n: s.class_number }) : null].filter(Boolean).join(' · ')}
              meta={t('analytics.oldestDue', { date: formatDate(s.oldest_due) })}
              right={<Money amount={s.balance} tone="danger" />}
              onPress={() => router.push(`/finance/student/${s.student_id}`)}
            />
          ))}

          {expenses.length ? (
            <>
              <SectionHeader title={t('analytics.expensesByAccount')} />
              <Card>
                {expenses.map((e) => (
                  <HBar key={e.code || e.name} label={e.name || e.code} value={Number(e.amount)} max={expenseMax} display={money(e.amount)} color={colors.primaryDark} />
                ))}
              </Card>
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function AcademicTab() {
  const { t } = useI18n();
  const [days, setDays] = useState(180);
  const q = useAsync(() => must(supabase.rpc('academic_analytics', { p_days: days })), [days]);
  const d = q.data || {};
  const att = d.attendance_by_month || [];
  const byClass = d.attendance_by_class || [];
  const exam = d.latest_exam;
  const funnel = d.admissions_funnel || {};
  const funnelMax = Math.max(0, ...FUNNEL.map((k) => Number(funnel[k] || 0)));
  const funnelTotal = Object.values(funnel).reduce((s, n) => s + Number(n || 0), 0);
  const enrol = d.enrolment_by_class || [];
  const enrolMax = Math.max(0, ...enrol.map((e) => Number(e.students || 0)));
  const enrolTotal = sum(enrol, 'students');
  const marked = sum(att, 'marked');
  const tasks = d.tasks || {};
  const rateTone = (r) => (Number(r || 0) >= 90 ? colors.primary : Number(r || 0) >= 75 ? colors.gold : colors.danger);

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Chips
        options={[90, 180, 365].map((n) => ({ value: n, label: t('analytics.lastDays', { n }) }))}
        value={days}
        onChange={setDays}
      />
      {q.data ? (
        <>
          <Txt variant="small">{t('analytics.asOf', { date: formatDate(d.as_of) })}</Txt>

          <SectionHeader title={t('analytics.attendanceTrend')} />
          <Card>
            <Txt variant="small">{t('analytics.attendanceMarked', { n: marked })}</Txt>
            {att.length ? (
              <ColumnChart
                data={att.map((r) => ({ key: r.month, label: monthLabel(t, r.month), title: r.month, values: [r.rate] }))}
                seriesColors={[colors.primary]}
                seriesLabels={[t('analytics.presentRate')]}
                format={pctText}
                max={100}
              />
            ) : (
              <EmptyState message={t('analytics.noData')} icon="bar-chart-outline" />
            )}
          </Card>

          <SectionHeader title={t('analytics.classAttendance')} />
          <Card>
            <Txt variant="small">{t('analytics.last30')}</Txt>
            {!byClass.length ? <Txt variant="muted">{t('analytics.noData')}</Txt> : null}
            {byClass.map((c) => (
              <HBar
                key={String(c.class_number)}
                label={c.class_number != null ? t('common.classN', { n: c.class_number }) : t('analytics.noClass')}
                value={Number(c.rate || 0)}
                max={100}
                display={pctText(c.rate)}
                sub={t('analytics.markedN', { n: c.marked ?? 0 })}
                color={rateTone(c.rate)}
              />
            ))}
          </Card>

          {(d.chronic_absentees || []).length ? (
            <>
              <SectionHeader title={t('analytics.chronic')} />
              {(d.chronic_absentees || []).map((s) => (
                <ListItem
                  key={s.student_id}
                  icon="alert-circle-outline"
                  iconColor={colors.danger}
                  title={s.full_name}
                  subtitle={s.class_number ? t('common.classN', { n: s.class_number }) : undefined}
                  right={<Txt variant="strong" style={{ color: colors.danger }}>{pctText(s.rate)}</Txt>}
                />
              ))}
            </>
          ) : null}

          <SectionHeader title={t('analytics.latestExam')} />
          {exam ? (
            <Card>
              <Txt variant="strong">{[exam.name, exam.class_number ? t('common.classN', { n: exam.class_number }) : null].filter(Boolean).join(' · ')}</Txt>
              <Txt variant="small">{t('analytics.subjectAvgHint')}</Txt>
              {!(exam.subjects || []).length ? <Txt variant="muted">{t('analytics.noData')}</Txt> : null}
              {(exam.subjects || []).map((s) => (
                <HBar
                  key={s.subject}
                  label={s.subject}
                  value={Number(s.average || 0)}
                  max={100}
                  display={pctText(s.average)}
                  sub={t('analytics.passRate', { rate: pctText(s.pass_rate), n: s.entries ?? 0 })}
                  color={rateTone(Number(s.average || 0) + 15)}
                />
              ))}
            </Card>
          ) : (
            <EmptyState message={t('analytics.noExam')} icon="school-outline" />
          )}

          <SectionHeader title={t('analytics.funnel')} />
          <Card>
            <KeyValue label={t('analytics.applications')} value={String(funnelTotal)} strong />
            <KeyValue label={t('analytics.conversion')} value={pctText(d.admissions_conversion)} />
            {FUNNEL.map((k) => (
              <HBar
                key={k}
                label={t(`analytics.stage.${k}`)}
                value={Number(funnel[k] || 0)}
                max={funnelMax}
                display={String(funnel[k] || 0)}
                color={k === 'rejected' ? colors.danger : k === 'enrolled' ? colors.primary : colors.info}
              />
            ))}
          </Card>

          <SectionHeader title={t('analytics.enrolment')} />
          <Card>
            <KeyValue label={t('analytics.totalStudents')} value={String(enrolTotal)} strong />
            {enrol.map((e) => (
              <HBar
                key={String(e.class_number)}
                label={e.class_number != null ? t('common.classN', { n: e.class_number }) : t('analytics.noClass')}
                value={Number(e.students || 0)}
                max={enrolMax}
                display={String(e.students ?? 0)}
                color={colors.gold}
              />
            ))}
          </Card>

          <SectionHeader title={t('analytics.tasks')} />
          <TileGrid>
            <StatTile label={t('analytics.tasksOpen')} value={String(tasks.open ?? 0)} icon="list-outline" tone={colors.info} />
            <StatTile label={t('analytics.tasksOverdue')} value={String(tasks.overdue ?? 0)} icon="alarm-outline" tone={colors.danger} />
            <StatTile label={t('analytics.tasksDone30')} value={String(tasks.done_30d ?? 0)} icon="checkmark-done-outline" />
          </TileGrid>
        </>
      ) : null}
    </Screen>
  );
}

/** Finance / Academic analytics with native bar visualisations. */
export default function Analytics() {
  const { t } = useI18n();
  const { caps } = useAuth();
  const tabs = [
    caps.canViewFinanceAnalytics ? { value: 'finance', label: t('analytics.finance') } : null,
    caps.canViewAcademicAnalytics ? { value: 'academic', label: t('analytics.academic') } : null,
  ].filter(Boolean);
  const [tab, setTab] = useState(tabs[0]?.value || null);

  if (!tabs.length) {
    return (
      <Screen>
        <EmptyState message={t('admin.forbidden')} icon="lock-closed-outline" />
      </Screen>
    );
  }
  const current = tabs.some((x) => x.value === tab) ? tab : tabs[0].value;

  return (
    <View style={styles.wrap}>
      {tabs.length > 1 ? (
        <View style={styles.tabs}>
          <Chips options={tabs} value={current} onChange={setTab} />
        </View>
      ) : null}
      {current === 'finance' ? <FinanceTab /> : <AcademicTab />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  tabs: { paddingHorizontal: 16, paddingTop: 12 },
});
