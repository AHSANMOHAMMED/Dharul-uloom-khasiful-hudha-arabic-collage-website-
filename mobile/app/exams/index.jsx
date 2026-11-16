import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { Screen, Card, Txt, EmptyState, StatusBadge, Row } from '../../components';
import { useAuth } from '../../lib/auth';
import { Redirect } from 'expo-router';

function ExamsList() {
  const { t } = useI18n();
  const q = useAsync(
    () =>
      must(
        supabase
          .from('exams')
          .select('id, name, exam_type, status, class_number, start_date, end_date')
          .order('start_date', { ascending: false })
          .limit(50),
      ),
    [],
  );
  const rows = q.data || [];

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Txt variant="title">{t('exams.title') || 'Exams'}</Txt>
      {!rows.length ? <EmptyState message={t('common.none')} icon="school-outline" /> : null}
      {rows.map((r) => (
        <Pressable key={r.id} onPress={() => router.push(`/exams/${r.id}`)}>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="strong">{r.name}</Txt>
              <StatusBadge status={r.status} />
            </Row>
            <Txt variant="muted">
              {[r.exam_type, r.class_number != null ? `Class ${r.class_number}` : null, formatDate(r.start_date)]
                .filter(Boolean)
                .join(' · ')}
            </Txt>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

// Role gate: deep links (kashifulhudha://...) must not open this screen for
// users without the matching role. RLS still enforces access server-side.
export default function GuardedExamsList() {
  const { profile, caps } = useAuth();
  if (!profile) return null;
  if (!(caps?.isAcademicAdmin || caps?.isEmployee || profile.role === 'super_admin')) return <Redirect href="/" />;
  return <ExamsList />;
}
