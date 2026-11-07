import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { colors } from '../../lib/theme';
import { Screen, Card, Txt, EmptyState, StatusBadge, Row } from '..';

export default function HostelView({ studentId }) {
  const { t } = useI18n();
  const q = useAsync(
    () =>
      must(
        supabase
          .from('hostel_allocations')
          .select('id, bed_no, start_date, end_date, status, notes, room:hostel_rooms(room_no, hostel:hostels(name))')
          .eq('student_id', studentId)
          .order('start_date', { ascending: false }),
      ),
    [studentId],
    { enabled: !!studentId },
  );
  const rows = q.data || [];

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      {!rows.length ? <EmptyState message={t('hostel.none')} icon="bed-outline" /> : null}
      {rows.map((a) => (
        <Card key={a.id} accent={a.status === 'active' ? colors.primary : colors.border}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="h2">{a.room?.hostel?.name || t('hostel.title')}</Txt>
            <StatusBadge status={a.status} />
          </Row>
          <Txt>
            {t('hostel.room', { room: a.room?.room_no || '—' })}
            {a.bed_no ? ` · ${t('hostel.bed', { bed: a.bed_no })}` : ''}
          </Txt>
          <Txt variant="muted">
            {t('hostel.since', { date: formatDate(a.start_date) })}
            {a.end_date ? ` · ${t('hostel.until', { date: formatDate(a.end_date) })}` : ''}
          </Txt>
          {a.notes ? <Txt variant="small">{a.notes}</Txt> : null}
        </Card>
      ))}
    </Screen>
  );
}
