import { Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { formatDateTime } from '../../lib/format';
import { useLive, useLiveTable } from '../../lib/live';
import { notificationRoute } from '../../lib/push';
import { Screen, ListItem, EmptyState, Button, LiveIndicator } from '..';

// Notifications that carry a deep link (e.g. a fee receipt) open their target.
export function notificationTarget(n) {
  const route = notificationRoute(n);
  return route === '/notifications' ? null : route;
}

export async function unreadCount(userId) {
  if (!userId) return 0;
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return count || 0;
}

export default function NotificationsView() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { refreshUnread } = useLive();
  const q = useAsync(
    () =>
      must(
        supabase
          .from('notifications')
          .select('id, title, message, is_read, created_at, data, link')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100),
      ),
    [user?.id],
    { enabled: !!user },
  );
  const { live } = useLiveTable({
    table: 'notifications',
    filter: user ? `user_id=eq.${user.id}` : undefined,
    enabled: !!user,
    onChange: () => q.reload(),
  });
  const rows = q.data || [];
  const hasUnread = rows.some((n) => !n.is_read);

  const markRead = async (n) => {
    if (n.is_read) return;
    q.setData(rows.map((r) => (r.id === n.id ? { ...r, is_read: true } : r)));
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
    if (error) q.reload();
    refreshUnread();
  };

  const onPress = (n) => {
    const target = notificationTarget(n);
    markRead(n);
    if (target) router.push(target);
  };

  const markAll = async () => {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    if (error) Alert.alert(t('common.error'), error.message);
    q.reload();
    refreshUnread();
  };

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <LiveIndicator live={live} />
      {hasUnread ? <Button title={t('notif.markAll')} variant="outline" icon="checkmark-done-outline" small onPress={markAll} /> : null}
      {!rows.length ? <EmptyState message={t('notif.none')} icon="notifications-off-outline" /> : null}
      {rows.map((n) => (
        <ListItem
          key={n.id}
          icon={n.data?.type === 'fee_receipt' ? 'receipt-outline' : n.is_read ? 'mail-open-outline' : 'mail-unread-outline'}
          unread={!n.is_read}
          title={n.title}
          subtitle={n.message}
          meta={formatDateTime(n.created_at)}
          onPress={!n.is_read || notificationTarget(n) ? () => onPress(n) : undefined}
        />
      ))}
    </Screen>
  );
}
