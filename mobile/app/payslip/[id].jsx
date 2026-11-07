import { Stack, useLocalSearchParams } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { colors } from '../../lib/theme';
import { Screen, Card, Txt, KeyValue, StatusBadge, Row, useMoney } from '../../components';

export default function PayslipDetail() {
  const { id } = useLocalSearchParams();
  const { t } = useI18n();
  const money = useMoney();
  const q = useAsync(() => must(supabase.from('payslips').select('*').eq('id', id).maybeSingle()), [id], { reloadOnFocus: false });
  const p = q.data;

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      {p ? (
        <>
          <Stack.Screen options={{ title: t('staff.payslip', { period: p.period }) }} />
          <Card accent={colors.gold}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="title">{p.staff_name || ''}</Txt>
              <StatusBadge status={p.status} />
            </Row>
            {p.employee_no ? <Txt variant="muted">{p.employee_no}</Txt> : null}
            <Txt variant="muted">{p.period}</Txt>
            {p.paid_at ? <Txt variant="small">{t('staff.paidOn', { date: formatDate(p.paid_at) })}</Txt> : null}
          </Card>
          <Card>
            <Txt variant="h2">{t('staff.earnings')}</Txt>
            <KeyValue label={t('staff.basic')} value={money(p.basic)} />
            {(p.earnings || []).map((e, i) => (
              <KeyValue key={`e${i}`} label={e.name || e.code} value={money(e.amount)} />
            ))}
            <KeyValue label={t('staff.gross')} value={money(p.gross)} strong />
          </Card>
          <Card>
            <Txt variant="h2">{t('staff.deductions')}</Txt>
            {(p.deductions || []).map((d, i) => (
              <KeyValue key={`d${i}`} label={d.name || d.code} value={money(d.amount)} />
            ))}
            <KeyValue label={t('staff.totalDeductions')} value={money(p.total_deductions)} strong />
            {Number(p.unpaid_days) > 0 ? <KeyValue label={t('staff.unpaidDays')} value={String(p.unpaid_days)} /> : null}
          </Card>
          <Card accent={colors.primary}>
            <KeyValue label={t('staff.net')} value={<Txt variant="title">{money(p.net)}</Txt>} strong />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
