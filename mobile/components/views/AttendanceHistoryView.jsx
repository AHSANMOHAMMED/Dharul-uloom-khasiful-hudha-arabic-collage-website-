import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { colors } from '../../lib/theme';
import { formatDate } from '../../lib/format';
import { useLiveReload } from '../../lib/live';
import { Screen, ListItem, EmptyState, StatusBadge, StatTile, TileGrid, SectionHeader, LiveIndicator } from '..';

export default function AttendanceHistoryView({ studentId }) {
  const { t } = useI18n();
  const q = useAsync(async () => {
    const [summary, rows] = await Promise.all([
      must(supabase.rpc('attendance_summary', { p_student: studentId, p_from: null, p_to: null })),
      must(
        supabase
          .from('attendance')
          .select('id, date, status, excuse_note')
          .eq('student_id', studentId)
          .order('date', { ascending: false })
          .limit(120),
      ),
    ]);
    return { summary: summary || {}, rows };
  }, [studentId], { enabled: !!studentId });
  const live = useLiveReload(['attendance'], studentId ? `student_id=eq.${studentId}` : undefined, q.reload, !!studentId);

  const s = q.data?.summary || {};
  const rows = q.data?.rows || [];

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <LiveIndicator live={live} />
      <TileGrid>
        <StatTile label={t('attendance.rate')} value={s.rate != null ? `${s.rate}%` : '—'} icon="stats-chart-outline" tone={colors.gold} />
        <StatTile label={t('status.present')} value={String(s.present ?? 0)} icon="checkmark-circle-outline" />
        <StatTile label={t('status.absent')} value={String(s.absent ?? 0)} icon="close-circle-outline" tone={colors.danger} />
        <StatTile label={t('status.late')} value={String(s.late ?? 0)} icon="time-outline" tone={colors.warning} />
      </TileGrid>
      <SectionHeader title={t('attendance.history')} />
      {!rows.length ? <EmptyState message={t('attendance.none')} icon="calendar-outline" /> : null}
      {rows.map((r) => (
        <ListItem key={r.id} title={formatDate(r.date)} subtitle={r.excuse_note || undefined} right={<StatusBadge status={r.status} />} />
      ))}
    </Screen>
  );
}
