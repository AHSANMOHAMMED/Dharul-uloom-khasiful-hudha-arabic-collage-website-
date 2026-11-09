import { useState } from 'react';
import { Alert } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { Screen, Card, Txt, EmptyState, Row, Button, Field } from '../../components';

/** Lite marks entry via student_results upsert. */
export default function ExamMarksLite() {
  const { id } = useLocalSearchParams();
  const { t } = useI18n();
  const [paperId, setPaperId] = useState('');
  const [indexNo, setIndexNo] = useState('');
  const [marks, setMarks] = useState('');
  const [busy, setBusy] = useState(false);

  const q = useAsync(
    async () => {
      const exam = await must(
        supabase.from('exams').select('id, name, status, class_number').eq('id', String(id)).maybeSingle(),
      );
      const papers = await must(
        supabase
          .from('exam_subjects')
          .select('id, subject_id, max_marks, subjects(code, name_en)')
          .eq('exam_id', String(id))
          .order('exam_date'),
      );
      return { exam, papers: papers || [] };
    },
    [id],
  );

  const save = async () => {
    const paper = (q.data?.papers || []).find((p) => p.id === paperId);
    if (!paper || !indexNo.trim() || marks === '') {
      Alert.alert(t('common.required'));
      return;
    }
    setBusy(true);
    try {
      const student = await must(
        supabase
          .from('profiles')
          .select('id')
          .eq('index_number', indexNo.trim().toUpperCase())
          .eq('account_type', 'student')
          .maybeSingle(),
      );
      if (!student?.id) throw new Error(t('exams.studentNotFound') || 'Student not found');
      const max = Number(paper.max_marks) || 100;
      await must(
        supabase.from('student_results').upsert(
          {
            exam_id: String(id),
            subject_id: paper.subject_id,
            student_id: student.id,
            marks_obtained: Number(marks),
            max_marks: max,
          },
          { onConflict: 'exam_id,subject_id,student_id' },
        ),
      );
      Alert.alert(t('common.success'));
      setMarks('');
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setBusy(false);
    }
  };

  const exam = q.data?.exam;
  const papers = q.data?.papers || [];

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Stack.Screen options={{ title: exam?.name || t('exams.marks') || 'Marks' }} />
      {!exam && !q.loading ? <EmptyState message={t('common.none')} /> : null}
      {exam ? (
        <>
          <Card>
            <Txt variant="title">{exam.name}</Txt>
            <Txt variant="muted">{exam.status}</Txt>
          </Card>
          <Card>
            <Txt variant="h2">{t('exams.liteEntry') || 'Lite marks entry'}</Txt>
            <Row style={{ flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
              {papers.map((p) => (
                <Button
                  key={p.id}
                  small
                  title={p.subjects?.code || p.subjects?.name_en || p.id.slice(0, 6)}
                  variant={paperId === p.id ? 'primary' : 'muted'}
                  onPress={() => setPaperId(p.id)}
                />
              ))}
            </Row>
            {!papers.length ? <Txt variant="muted">{t('common.none')}</Txt> : null}
            <Field
              label={t('common.index')}
              value={indexNo}
              onChangeText={setIndexNo}
              autoCapitalize="characters"
            />
            <Field
              label={t('exams.marks') || 'Marks'}
              value={marks}
              onChangeText={setMarks}
              keyboardType="decimal-pad"
            />
            <Button title={t('common.save')} loading={busy} onPress={save} />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
