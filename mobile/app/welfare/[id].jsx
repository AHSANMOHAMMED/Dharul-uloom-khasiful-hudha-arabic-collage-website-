import { Stack, useLocalSearchParams } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { Screen, Card, Txt, EmptyState, StatusBadge, Row } from '../../components';

export default function WelfareDetail() {
  const { id } = useLocalSearchParams();
  const { t } = useI18n();
  const q = useAsync(
    async () => {
      const row = await must(
        supabase
          .from('welfare_cases')
          .select(
            'id, case_type, status, created_at, closed_at, summary, details, student:profiles!student_id(full_name, index_number, class_number)',
          )
          .eq('id', String(id))
          .maybeSingle(),
      );
      let notes = [];
      try {
        notes = await must(
          supabase
            .from('welfare_notes')
            .select('id, note, created_at, author:profiles!author_id(full_name)')
            .eq('case_id', String(id))
            .order('created_at', { ascending: false }),
        );
      } catch {
        notes = [];
      }
      return { row, notes: notes || [] };
    },
    [id],
  );
  const r = q.data?.row;
  const notes = q.data?.notes || [];

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Stack.Screen options={{ title: t('welfare.case') || 'Case' }} />
      {!r && !q.loading ? <EmptyState message={t('common.none')} /> : null}
      {r ? (
        <>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="title">{r.student?.full_name || '—'}</Txt>
              <StatusBadge status={r.status} />
            </Row>
            <Txt variant="muted">
              {[r.case_type, r.student?.index_number, formatDate(r.created_at)].filter(Boolean).join(' · ')}
            </Txt>
            {r.summary ? <Txt style={{ marginTop: 8 }}>{r.summary}</Txt> : null}
            {r.details ? <Txt variant="muted">{r.details}</Txt> : null}
          </Card>
          <Txt variant="h2">{t('welfare.notes') || 'Notes'}</Txt>
          {!notes.length ? <EmptyState message={t('common.none')} /> : null}
          {notes.map((n) => (
            <Card key={n.id}>
              <Txt variant="muted">{[n.author?.full_name, formatDate(n.created_at)].filter(Boolean).join(' · ')}</Txt>
              <Txt>{n.note}</Txt>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
