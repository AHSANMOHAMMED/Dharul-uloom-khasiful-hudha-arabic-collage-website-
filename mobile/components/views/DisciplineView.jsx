import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { Screen, Card, Txt, EmptyState, StatusBadge, Row } from '..';

export default function DisciplineView({ studentId }) {
  const { t } = useI18n();
  const q = useAsync(
    () =>
      must(
        supabase
          .from('discipline_incidents')
          .select('id, incident_date, category, severity, description, action_taken, status')
          .eq('student_id', studentId)
          .order('incident_date', { ascending: false }),
      ),
    [studentId],
    { enabled: !!studentId },
  );
  const rows = q.data || [];
  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      {!rows.length ? <EmptyState message={t('child.noDiscipline')} icon="shield-checkmark-outline" /> : null}
      {rows.map((d) => (
        <Card key={d.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="strong">{formatDate(d.incident_date)}</Txt>
            <Row gap={6}>
              <StatusBadge status={d.severity} />
              <StatusBadge status={d.status} />
            </Row>
          </Row>
          <Txt>{d.description}</Txt>
          {d.action_taken ? <Txt variant="muted">{d.action_taken}</Txt> : null}
        </Card>
      ))}
    </Screen>
  );
}
