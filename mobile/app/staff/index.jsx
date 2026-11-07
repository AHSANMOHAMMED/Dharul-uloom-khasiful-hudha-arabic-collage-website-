import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { toISODate, formatTime } from '../../lib/format';
import { colors } from '../../lib/theme';
import { fetchAnnouncements, AnnouncementCard } from '../../components/views/AnnouncementsView';
import { unreadCount } from '../../components/views/NotificationsView';
import { Screen, Card, Txt, Button, Row, StatusBadge, SectionHeader, ListItem, EmptyState, StatTile, TileGrid } from '../../components';

export default function StaffHome() {
  const { t } = useI18n();
  const { user, profile, caps } = useAuth();
  const [busy, setBusy] = useState(null);

  const q = useAsync(async () => {
    const [today, announcements, unread, pendingLeaves] = await Promise.all([
      must(
        supabase.from('staff_attendance').select('id, date, status, check_in, check_out').eq('profile_id', user.id).eq('date', toISODate()).maybeSingle(),
      ),
      fetchAnnouncements(profile, 5),
      unreadCount(user.id),
      caps.canReviewStudentLeave
        ? supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending').then((r) => r.count || 0)
        : Promise.resolve(null),
    ]);
    return { today, announcements, unread, pendingLeaves };
  }, [user?.id, caps.canReviewStudentLeave]);

  const act = async (kind) => {
    setBusy(kind);
    try {
      const row = await must(supabase.rpc(kind === 'in' ? 'staff_check_in' : 'staff_check_out'));
      q.setData({ ...q.data, today: row });
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setBusy(null);
    }
  };

  const today = q.data?.today;

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Txt variant="title">{t('home.greeting', { name: profile?.full_name?.split(' ')[0] || '' })}</Txt>
      <Card accent={colors.gold}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="h2">{`${t('staff.today')} · ${toISODate()}`}</Txt>
          {today ? <StatusBadge status={today.status} /> : null}
        </Row>
        <Txt variant="muted">
          {today?.check_in ? t('staff.checkedIn', { time: formatTime(today.check_in) }) : t('staff.notCheckedIn')}
          {today?.check_out ? ` · ${t('staff.checkedOut', { time: formatTime(today.check_out) })}` : ''}
        </Txt>
        <Row>
          <Button style={{ flex: 1 }} title={t('staff.checkIn')} icon="log-in-outline" loading={busy === 'in'} disabled={!!today?.check_in || !!busy} onPress={() => act('in')} />
          <Button
            style={{ flex: 1 }}
            variant="dark"
            title={t('staff.checkOut')}
            icon="log-out-outline"
            loading={busy === 'out'}
            disabled={!today?.check_in || !!today?.check_out || !!busy}
            onPress={() => act('out')}
          />
        </Row>
      </Card>

      <TileGrid>
        <StatTile label={t('home.unread')} value={String(q.data?.unread ?? 0)} icon="notifications-outline" tone={colors.gold} onPress={() => router.push('/notifications')} />
        {q.data?.pendingLeaves != null ? (
          <StatTile label={t('leave.review')} value={String(q.data.pendingLeaves)} icon="document-text-outline" tone={colors.warning} onPress={() => router.push('/staff/leaves')} />
        ) : null}
      </TileGrid>

      <SectionHeader title={t('home.quickLinks')} />
      {caps.canMarkAttendance ? <ListItem icon="checkbox-outline" title={t('attendance.mark')} onPress={() => router.push('/staff/attendance')} /> : null}
      {caps.isFinanceStaff ? (
        <ListItem icon="cash-outline" iconColor={colors.gold} title={t('counter.title')} subtitle={t('counter.tileHint')} onPress={() => router.push('/receive-payment')} />
      ) : null}
      <ListItem icon="time-outline" title={t('staff.myTimetable')} onPress={() => router.push({ pathname: '/timetable', params: { tutor: 'me' } })} />
      <ListItem icon="calendar-outline" title={t('staff.myAttendance')} onPress={() => router.push('/my-attendance')} />
      <ListItem icon="airplane-outline" title={t('staff.requestLeave')} onPress={() => router.push('/staff-leave')} />

      <SectionHeader title={t('home.announcements')} actionLabel={t('common.viewAll')} onAction={() => router.push('/announcements')} />
      {q.data && !q.data.announcements.length ? <EmptyState message={t('home.noAnnouncements')} icon="megaphone-outline" /> : null}
      {(q.data?.announcements || []).map((a) => (
        <AnnouncementCard key={a.id} a={a} compact />
      ))}
    </Screen>
  );
}
