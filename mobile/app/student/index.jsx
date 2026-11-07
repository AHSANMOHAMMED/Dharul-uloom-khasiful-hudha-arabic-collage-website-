import { router } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { DAYS, formatTime } from '../../lib/format';
import { colors } from '../../lib/theme';
import { fetchSchedule, WEEK } from '../../components/views/TimetableView';
import { fetchAnnouncements, AnnouncementCard } from '../../components/views/AnnouncementsView';
import { unreadCount } from '../../components/views/NotificationsView';
import { Screen, Txt, StatTile, TileGrid, SectionHeader, ListItem, EmptyState, useMoney } from '../../components';

// Upcoming classes: rest of today, then following days.
function upcoming(rows, limit = 4) {
  const now = new Date();
  const today = DAYS[now.getDay()];
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const start = WEEK.indexOf(today);
  const out = [];
  for (let i = 0; i < 7 && out.length < limit; i += 1) {
    const day = WEEK[(start + i) % 7];
    rows
      .filter((r) => r.day_of_week === day && (i > 0 || formatTime(r.end_time) >= hhmm))
      .sort((a, b) => (a.start_time < b.start_time ? -1 : 1))
      .forEach((r) => out.length < limit && out.push({ ...r, isToday: i === 0 }));
  }
  return out;
}

export default function StudentHome() {
  const { t } = useI18n();
  const money = useMoney();
  const { profile, user } = useAuth();

  const q = useAsync(async () => {
    const [summary, statement, schedule, announcements, unread] = await Promise.all([
      must(supabase.rpc('attendance_summary', { p_student: user.id, p_from: null, p_to: null })),
      must(supabase.rpc('student_fee_statement', { p_student: user.id })),
      profile?.class_number ? fetchSchedule({ classNumber: profile.class_number }) : Promise.resolve([]),
      fetchAnnouncements(profile, 5),
      unreadCount(user.id),
    ]);
    return { summary: summary || {}, outstanding: Number(statement?.total_outstanding || 0), schedule, announcements, unread };
  }, [user?.id, profile?.class_number]);

  const d = q.data;
  const next = d ? upcoming(d.schedule) : [];

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Txt variant="title">{t('home.greeting', { name: profile?.full_name?.split(' ')[0] || '' })}</Txt>
      <Txt variant="muted">
        {[profile?.index_number, profile?.class_number ? t('common.classN', { n: profile.class_number }) : null].filter(Boolean).join(' · ')}
      </Txt>
      {d ? (
        <TileGrid>
          <StatTile
            label={t('home.attendanceRate')}
            value={d.summary.rate != null ? `${d.summary.rate}%` : '—'}
            icon="checkmark-done-outline"
            onPress={() => router.push({ pathname: '/attendance-history', params: { student: user.id } })}
          />
          <StatTile
            label={t('home.outstanding')}
            value={d.outstanding > 0 ? money(d.outstanding) : t('home.allPaid')}
            icon="wallet-outline"
            tone={d.outstanding > 0 ? colors.danger : colors.primary}
            onPress={() => router.push('/student/fees')}
          />
          <StatTile
            label={t('home.unread')}
            value={String(d.unread)}
            icon="notifications-outline"
            tone={colors.gold}
            onPress={() => router.push('/notifications')}
          />
        </TileGrid>
      ) : null}

      <SectionHeader
        title={t('home.nextClasses')}
        actionLabel={t('common.viewAll')}
        onAction={() => router.push({ pathname: '/timetable', params: { class: profile?.class_number } })}
      />
      {!next.length ? <EmptyState message={t('home.noClasses')} icon="calendar-outline" /> : null}
      {next.map((c) => (
        <ListItem
          key={`${c.id}`}
          icon="time-outline"
          title={c.subject}
          subtitle={`${c.isToday ? t('common.today') : t(`day.${c.day_of_week}`)} · ${formatTime(c.start_time)}–${formatTime(c.end_time)}`}
          meta={c.room ? t('timetable.room', { room: c.room }) : undefined}
        />
      ))}

      <SectionHeader title={t('home.announcements')} actionLabel={t('common.viewAll')} onAction={() => router.push('/announcements')} />
      {d && !d.announcements.length ? <EmptyState message={t('home.noAnnouncements')} icon="megaphone-outline" /> : null}
      {(d?.announcements || []).map((a) => (
        <AnnouncementCard key={a.id} a={a} compact />
      ))}
    </Screen>
  );
}
