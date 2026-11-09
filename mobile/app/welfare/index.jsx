import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { Screen, Card, Txt, EmptyState, StatusBadge, Row } from '../../components';

export default function WelfareList() {
  const { t } = useI18n();
  const q = useAsync(
    () =>
      must(
        supabase
          .from('welfare_cases')
          .select('id, case_type, status, created_at, summary, student:profiles!student_id(full_name, index_number, class_number)')
          .order('created_at', { ascending: false })
          .limit(100),
      ),
    [],
  );
  const rows = q.data || [];

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Txt variant="title">{t('welfare.title') || 'Welfare cases'}</Txt>
      {!rows.length ? <EmptyState message={t('common.none')} icon="heart-outline" /> : null}
      {rows.map((r) => (
        <Pressable key={r.id} onPress={() => router.push(`/welfare/${r.id}`)}>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="strong">{r.student?.full_name || '—'}</Txt>
              <StatusBadge status={r.status} />
            </Row>
            <Txt variant="muted">
              {[r.case_type, r.student?.index_number, formatDate(r.created_at)].filter(Boolean).join(' · ')}
            </Txt>
            {r.summary ? <Txt numberOfLines={2}>{r.summary}</Txt> : null}
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
