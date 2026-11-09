import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { Screen, Card, Txt, EmptyState, StatusBadge, Row, Button } from '../../components';
import { useState } from 'react';

const STAGES = ['lead', 'submitted', 'interview', 'accepted', 'enrolled', 'rejected'];

export default function AdmissionsPipeline() {
  const { t } = useI18n();
  const [stage, setStage] = useState('');
  const q = useAsync(
    () =>
      must(
        (() => {
          let b = supabase
            .from('admissions')
            .select('id, student_name, parent_name, phone, email, course, pipeline_stage, status, created_at, source')
            .order('created_at', { ascending: false })
            .limit(100);
          if (stage) b = b.eq('pipeline_stage', stage);
          return b;
        })(),
      ),
    [stage],
  );
  const rows = q.data || [];

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Txt variant="title">{t('admissions.pipeline') || 'Admissions pipeline'}</Txt>
      <Row style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <Button title={t('common.all') || 'All'} small variant={!stage ? 'primary' : 'muted'} onPress={() => setStage('')} />
        {STAGES.map((s) => (
          <Button key={s} title={s} small variant={stage === s ? 'primary' : 'muted'} onPress={() => setStage(s)} />
        ))}
      </Row>
      {!rows.length ? <EmptyState message={t('common.none')} icon="people-outline" /> : null}
      {rows.map((r) => (
        <Pressable key={r.id} onPress={() => router.push(`/admissions/${r.id}`)}>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="strong">{r.student_name}</Txt>
              <StatusBadge status={r.pipeline_stage || r.status} />
            </Row>
            <Txt variant="muted">{[r.course, r.phone, formatDate(r.created_at)].filter(Boolean).join(' · ')}</Txt>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
