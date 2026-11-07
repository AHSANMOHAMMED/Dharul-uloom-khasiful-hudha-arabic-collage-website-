import * as WebBrowser from 'expo-web-browser';
import { supabase, must, WEB_URL } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { colors } from '../../lib/theme';
import { Screen, Card, Txt, Button, StatTile, TileGrid, SectionHeader, useMoney } from '..';

export default function DashboardView() {
  const { t } = useI18n();
  const money = useMoney();
  const q = useAsync(() => must(supabase.rpc('org_dashboard_stats')), []);
  const s = q.data || {};
  const fm = s.fees_month || {};
  const att = s.attendance_today || {};

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      {q.data ? (
        <>
          <TileGrid>
            <StatTile label={t('admin.students')} value={String(s.students ?? 0)} icon="people-outline" />
            <StatTile label={t('admin.employees')} value={String(s.employees ?? 0)} icon="briefcase-outline" />
            <StatTile label={t('admin.parents')} value={String(s.parents ?? 0)} icon="home-outline" />
            <StatTile
              label={t('admin.pendingApprovals')}
              value={String(s.pending_approvals ?? 0)}
              icon="hourglass-outline"
              tone={s.pending_approvals ? colors.warning : colors.primary}
            />
            <StatTile label={t('admin.pendingLinks')} value={String(s.pending_parent_links ?? 0)} icon="link-outline" tone={colors.warning} />
            <StatTile
              label={t('admin.attendanceToday')}
              value={att.rate != null ? `${att.rate}%` : '—'}
              sub={att.marked ? `${att.present}/${att.marked}` : undefined}
              icon="checkmark-done-outline"
              tone={colors.gold}
            />
          </TileGrid>

          <SectionHeader title={t('tabs.finance')} />
          <TileGrid>
            <StatTile label={`${t('admin.feesMonth')} · ${t('admin.collected')}`} value={money(fm.collected)} sub={`${t('admin.invoiced')} ${money(fm.invoiced)}`} icon="cash-outline" />
            <StatTile label={t('admin.outstandingTotal')} value={money(s.fees_outstanding_total)} icon="alert-circle-outline" tone={colors.danger} />
            <StatTile label={t('admin.collections30')} value={money(s.collections_30d)} icon="trending-up-outline" />
            <StatTile label={t('admin.expensesMonth')} value={money(s.expenses_month)} icon="wallet-outline" tone={colors.primaryDark} />
          </TileGrid>

          <SectionHeader title={t('staff.management')} />
          <TileGrid>
            <StatTile label={t('admin.studentLeave')} value={String(s.student_leave_pending ?? 0)} icon="document-outline" tone={colors.warning} />
            <StatTile label={t('admin.staffLeave')} value={String(s.staff_leave_pending ?? 0)} icon="airplane-outline" tone={colors.warning} />
            <StatTile label={t('admin.discipline')} value={String(s.discipline_open ?? 0)} icon="shield-outline" tone={colors.danger} />
            <StatTile label={t('admin.docRequests')} value={String(s.document_requests_pending ?? 0)} icon="folder-open-outline" />
            <StatTile
              label={t('admin.hostel')}
              value={s.hostel ? `${s.hostel.occupied ?? 0}/${s.hostel.beds ?? 0}` : '—'}
              icon="bed-outline"
            />
            <StatTile
              label={t('admin.lastPayroll')}
              value={s.last_payroll ? money(s.last_payroll.net) : '—'}
              sub={s.last_payroll ? `${s.last_payroll.period} · ${t(`status.${s.last_payroll.status}`)}` : undefined}
              icon="card-outline"
            />
          </TileGrid>
        </>
      ) : null}

      <Card accent={colors.gold}>
        <Txt variant="muted">{t('admin.erpNote')}</Txt>
        <Button title={t('admin.openErp')} icon="open-outline" onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/erp`)} />
      </Card>
    </Screen>
  );
}
