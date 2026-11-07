import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { formatDate, formatTime } from '../lib/format';
import { Screen, ListItem, EmptyState, StatusBadge } from '../components';

export default function MyAttendance() {
  const { t } = useI18n();
  const { user } = useAuth();
  const q = useAsync(
    () =>
      must(
        supabase
          .from('staff_attendance')
          .select('id, date, status, check_in, check_out, note')
          .eq('profile_id', user.id)
          .order('date', { ascending: false })
          .limit(90),
      ),
    [user?.id],
  );
  const rows = q.data || [];
  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      {!rows.length ? <EmptyState message={t('attendance.none')} icon="calendar-outline" /> : null}
      {rows.map((r) => (
        <ListItem
          key={r.id}
          title={formatDate(r.date)}
          subtitle={[r.check_in ? `${t('staff.checkIn')} ${formatTime(r.check_in)}` : null, r.check_out ? `${t('staff.checkOut')} ${formatTime(r.check_out)}` : null]
            .filter(Boolean)
            .join(' · ') || undefined}
          meta={r.note || undefined}
          right={<StatusBadge status={r.status} />}
        />
      ))}
    </Screen>
  );
}
