import { router } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { Screen, ListItem, EmptyState, SectionHeader, Txt } from '..';

/**
 * Published exams relevant to the student. Exams come from the student's own
 * results (exam_id) plus published exams for their class.
 */
export default function ResultsView({ studentId, classNumber }) {
  const { t } = useI18n();

  const q = useAsync(async () => {
    const results = await must(
      supabase
        .from('student_results')
        .select('id, exam_id, exam_name, subject, marks_obtained, max_marks, grade, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(200),
    );
    const examIds = [...new Set(results.map((r) => r.exam_id).filter(Boolean))];
    let examQuery = supabase
      .from('exams')
      .select('id, name, exam_type, class_number, start_date, end_date, published_at, status')
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false });
    if (examIds.length && classNumber) {
      examQuery = examQuery.or(`id.in.(${examIds.join(',')}),class_number.eq.${classNumber}`);
    } else if (examIds.length) {
      examQuery = examQuery.in('id', examIds);
    } else if (classNumber) {
      examQuery = examQuery.eq('class_number', classNumber);
    } else {
      return { exams: [], legacy: results };
    }
    const exams = await must(examQuery);
    // Results not attached to an exam (older data model)
    const legacy = results.filter((r) => !r.exam_id);
    return { exams, legacy };
  }, [studentId, classNumber], { enabled: !!studentId });

  const exams = q.data?.exams || [];
  const legacy = q.data?.legacy || [];

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <SectionHeader title={t('results.exams')} />
      {!exams.length && !legacy.length ? <EmptyState message={t('results.none')} icon="school-outline" /> : null}
      {exams.map((e) => (
        <ListItem
          key={e.id}
          icon="ribbon-outline"
          iconColor="#d4a017"
          title={e.name}
          subtitle={[e.class_number ? t('common.classN', { n: e.class_number }) : null, formatDate(e.end_date || e.start_date)]
            .filter(Boolean)
            .join(' · ')}
          onPress={() => router.push({ pathname: '/report-card', params: { student: studentId, exam: e.id, name: e.name } })}
        />
      ))}
      {legacy.length ? (
        <>
          <SectionHeader title={t('results.other')} />
          {legacy.map((r) => (
            <ListItem
              key={r.id}
              title={`${r.exam_name} · ${r.subject}`}
              subtitle={`${r.marks_obtained}/${r.max_marks}`}
              right={<Txt variant="strong">{r.grade}</Txt>}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
