import { router } from 'expo-router';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { Screen, ListItem, EmptyState, StatusBadge, useMoney } from '../components';

export default function Payslips() {
  const { t } = useI18n();
  const money = useMoney();
  const { user } = useAuth();
  const q = useAsync(
    () => must(supabase.from('payslips').select('id, period, gross, net, status, paid_at').eq('staff_id', user.id).order('period', { ascending: false })),
    [user?.id],
  );
  const rows = q.data || [];
  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      {!rows.length ? <EmptyState message={t('staff.noPayslips')} icon="document-outline" /> : null}
      {rows.map((p) => (
        <ListItem
          key={p.id}
          icon="cash-outline"
          title={t('staff.payslip', { period: p.period })}
          subtitle={`${t('staff.net')}: ${money(p.net)}`}
          right={<StatusBadge status={p.status} />}
          onPress={() => router.push(`/payslip/${p.id}`)}
        />
      ))}
    </Screen>
  );
}
