import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { formatTime } from '../../lib/format';
import { Screen, ListItem, EmptyState, SectionHeader } from '..';

export const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export async function fetchSchedule({ classNumber, tutorId }) {
  let q = supabase
    .from('class_schedules')
    .select('id, class_number, subject, day_of_week, start_time, end_time, room, tutor_id')
    .order('start_time');
  if (tutorId) q = q.eq('tutor_id', tutorId);
  else q = q.eq('class_number', classNumber);
  return must(q);
}

/** Timetable for a class (students) or for a tutor (teachers). */
export default function TimetableView({ classNumber, tutorId }) {
  const { t } = useI18n();
  const enabled = !!(classNumber || tutorId);
  const q = useAsync(() => fetchSchedule({ classNumber, tutorId }), [classNumber, tutorId], { enabled });
  const rows = q.data || [];

  return (
    <Screen loading={q.loading && enabled} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      {!rows.length ? <EmptyState message={t('timetable.none')} icon="calendar-outline" /> : null}
      {WEEK.map((day) => {
        const items = rows.filter((r) => r.day_of_week === day);
        if (!items.length) return null;
        return [
          <SectionHeader key={`h-${day}`} title={t(`day.${day}`)} />,
          ...items.map((r) => (
            <ListItem
              key={r.id}
              icon="book-outline"
              title={r.subject}
              subtitle={`${formatTime(r.start_time)} – ${formatTime(r.end_time)}${tutorId ? ` · ${t('common.classN', { n: r.class_number })}` : ''}`}
              meta={r.room ? t('timetable.room', { room: r.room }) : undefined}
            />
          )),
        ];
      })}
    </Screen>
  );
}
