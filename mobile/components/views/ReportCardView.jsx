import { View, StyleSheet } from 'react-native';
import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { colors } from '../../lib/theme';
import { Screen, Card, Txt, EmptyState, Row, StatTile, TileGrid } from '..';

export default function ReportCardView({ studentId, examId }) {
  const { t } = useI18n();
  const q = useAsync(
    () => must(supabase.rpc('student_report_card', { p_student: studentId, p_exam: examId })),
    [studentId, examId],
    { enabled: !!studentId && !!examId, reloadOnFocus: false },
  );
  const rc = q.data;
  const subjects = rc?.subjects || [];

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      {rc ? (
        <>
          <Card accent={colors.gold}>
            <Txt variant="title">{rc.exam?.name}</Txt>
            <Txt variant="muted">
              {rc.student?.full_name}
              {rc.student?.index_number ? ` · ${rc.student.index_number}` : ''}
              {rc.student?.class_number ? ` · ${t('common.classN', { n: rc.student.class_number })}` : ''}
            </Txt>
          </Card>
          <TileGrid>
            <StatTile label={t('results.overall')} value={rc.overall_grade || '—'} icon="trophy-outline" tone={colors.gold} />
            <StatTile label={t('results.percentage')} value={rc.percentage != null ? `${rc.percentage}%` : '—'} icon="pie-chart-outline" />
            <StatTile label={t('common.total')} value={`${rc.total ?? 0}/${rc.max_total ?? 0}`} icon="calculator-outline" />
            <StatTile
              label={t('results.rank')}
              value={rc.rank ? t('results.rankOf', { rank: rc.rank, size: rc.class_size }) : '—'}
              icon="podium-outline"
              tone={colors.primaryDark}
            />
          </TileGrid>
          <Card>
            <Row style={styles.head}>
              <Txt variant="label" style={styles.subject}>{t('results.subject')}</Txt>
              <Txt variant="label" style={styles.num}>{t('results.marks')}</Txt>
              <Txt variant="label" style={styles.grade}>{t('results.grade')}</Txt>
            </Row>
            {!subjects.length ? <EmptyState message={t('results.noSubjects')} /> : null}
            {subjects.map((s, i) => (
              <View key={`${s.subject}-${i}`} style={styles.line}>
                <Row>
                  <Txt style={styles.subject}>{s.subject}</Txt>
                  <Txt style={styles.num}>{`${s.marks}/${s.max}`}</Txt>
                  <Txt variant="strong" style={styles.grade}>{s.grade}</Txt>
                </Row>
                {s.remarks ? <Txt variant="small">{s.remarks}</Txt> : null}
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 6 },
  line: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 2 },
  subject: { flex: 2 },
  num: { flex: 1, textAlign: 'center' },
  grade: { width: 48, textAlign: 'center' },
});
