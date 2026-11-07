import { router } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { Screen, Card, Txt, Row, Button, SectionHeader, ListItem, EmptyState, StatusBadge, useMoney } from '../../components';

export default function MyHr() {
  const { t } = useI18n();
  const money = useMoney();
  const { user } = useAuth();
  const q = useAsync(async () => {
    const [balance, payslips] = await Promise.all([
      must(supabase.rpc('staff_leave_balance', { p_profile: null, p_year: new Date().getFullYear() })),
      must(supabase.from('payslips').select('id, period, net, status').eq('staff_id', user.id).order('period', { ascending: false }).limit(3)),
    ]);
    return { balance, payslips };
  }, [user?.id]);

  const balance = q.data?.balance || [];
  const payslips = q.data?.payslips || [];

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <SectionHeader title={t('staff.leaveBalance')} />
      {!balance.length ? <EmptyState message={t('common.none')} /> : null}
      {balance.map((b) => (
        <Card key={b.leave_type_id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="strong" style={{ flex: 1 }}>{b.name}</Txt>
            <Txt variant="h2">{t('staff.remaining', { n: Number(b.remaining) })}</Txt>
          </Row>
          <Txt variant="small">
            {[t('staff.entitled', { n: Number(b.entitled) }), t('staff.used', { n: Number(b.used) }), t('staff.pendingDays', { n: Number(b.pending) })].join(' · ')}
          </Txt>
        </Card>
      ))}
      <Button title={t('staff.requestLeave')} icon="airplane-outline" variant="gold" onPress={() => router.push('/staff-leave')} />

      <SectionHeader title={t('staff.payslips')} actionLabel={t('common.viewAll')} onAction={() => router.push('/payslips')} />
      {!payslips.length ? <EmptyState message={t('staff.noPayslips')} icon="document-outline" /> : null}
      {payslips.map((p) => (
        <ListItem
          key={p.id}
          icon="cash-outline"
          title={t('staff.payslip', { period: p.period })}
          subtitle={money(p.net)}
          right={<StatusBadge status={p.status} />}
          onPress={() => router.push(`/payslip/${p.id}`)}
        />
      ))}

      <SectionHeader title={t('common.more')} />
      <ListItem icon="calendar-outline" title={t('staff.myAttendance')} onPress={() => router.push('/my-attendance')} />
      <ListItem icon="time-outline" title={t('staff.myTimetable')} onPress={() => router.push({ pathname: '/timetable', params: { tutor: 'me' } })} />
    </Screen>
  );
}
