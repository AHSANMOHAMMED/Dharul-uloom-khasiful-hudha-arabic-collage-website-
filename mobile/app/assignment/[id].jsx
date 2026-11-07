import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { formatDate, formatDateTime } from '../../lib/format';
import { colors } from '../../lib/theme';
import { Screen, Card, Txt, Field, Button, Badge, KeyValue, SectionHeader } from '../../components';

export default function AssignmentDetail() {
  const { id } = useLocalSearchParams();
  const { t } = useI18n();
  const { user } = useAuth();
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);

  const q = useAsync(async () => {
    const [assignment, sub] = await Promise.all([
      must(supabase.from('lms_assignments').select('id, subject, title, description, due_date, class_number').eq('id', id).maybeSingle()),
      must(
        supabase
          .from('lms_submissions')
          .select('id, content, grade, feedback, submitted_at, updated_at')
          .eq('assignment_id', id)
          .eq('student_id', user.id)
          .maybeSingle(),
      ),
    ]);
    return { assignment, sub };
  }, [id, user?.id], { reloadOnFocus: false });

  useEffect(() => {
    if (q.data?.sub?.content != null) setAnswer(q.data.sub.content);
  }, [q.data?.sub?.content]);

  const a = q.data?.assignment;
  const sub = q.data?.sub;
  const graded = !!(sub?.grade || sub?.feedback);

  const submit = async () => {
    if (!answer.trim()) return Alert.alert(t('common.error'), t('common.required'));
    setSaving(true);
    try {
      await must(
        supabase
          .from('lms_submissions')
          .upsert(
            { assignment_id: id, student_id: user.id, content: answer.trim(), submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { onConflict: 'assignment_id,student_id' },
          ),
      );
      Alert.alert(t('common.success'), t('lms.saved'));
      q.reload();
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      {a ? (
        <>
          <Card accent={colors.primary}>
            <Txt variant="title">{a.title}</Txt>
            <Txt variant="small">{`${a.subject}${a.due_date ? ` · ${t('lms.dueOn', { date: formatDate(a.due_date) })}` : ''}`}</Txt>
            {a.description ? <Txt>{a.description}</Txt> : null}
          </Card>

          {graded ? (
            <Card accent={colors.gold}>
              {sub.grade ? <KeyValue label={t('lms.grade')} value={sub.grade} strong /> : null}
              {sub.feedback ? (
                <>
                  <Txt variant="label">{t('lms.feedback')}</Txt>
                  <Txt>{sub.feedback}</Txt>
                </>
              ) : null}
            </Card>
          ) : null}

          <SectionHeader title={t('lms.yourAnswer')} />
          {sub ? <Badge label={`${t('lms.submitted')} · ${formatDateTime(sub.updated_at || sub.submitted_at)}`} tone="success" /> : null}
          <Field multiline placeholder={t('lms.answerPlaceholder')} value={answer} onChangeText={setAnswer} editable={!graded} inputStyle={{ minHeight: 180 }} />
          {graded ? (
            <Txt variant="muted">{t('lms.lockedGraded')}</Txt>
          ) : (
            <Button title={sub ? t('lms.update') : t('lms.submit')} icon="cloud-upload-outline" loading={saving} onPress={submit} />
          )}
        </>
      ) : null}
    </Screen>
  );
}
