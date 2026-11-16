import { useState } from 'react';
import { Alert } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { Screen, Card, Txt, EmptyState, StatusBadge, Row, Button } from '../../components';
import { useAuth } from '../../lib/auth';
import { Redirect } from 'expo-router';

const STAGES = ['lead', 'submitted', 'interview', 'accepted', 'enrolled', 'rejected'];
const STAGE_STATUS = {
  lead: 'lead',
  submitted: 'pending',
  interview: 'interview',
  accepted: 'approved',
  enrolled: 'enrolled',
  rejected: 'rejected',
};

function AdmissionDetail() {
  const { id } = useLocalSearchParams();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const q = useAsync(
    () =>
      must(
        supabase
          .from('admissions')
          .select('id, student_name, parent_name, phone, email, course, pipeline_stage, status, source, notes, created_at, date_of_birth, address')
          .eq('id', String(id))
          .maybeSingle(),
      ),
    [id],
  );
  const r = q.data;

  const setStage = async (next) => {
    // "enrolled" is only reachable through the enrolment flow (enroll_admission
    // assigns the index number and parent invite); an enrolled lead is final.
    if (!r || next === r.pipeline_stage || next === 'enrolled' || r.pipeline_stage === 'enrolled') return;
    setBusy(true);
    try {
      await must(
        supabase
          .from('admissions')
          .update({
            pipeline_stage: next,
            status: STAGE_STATUS[next] || r.status,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', r.id),
      );
      // same audit trail the web CRM writes
      await supabase
        .from('admission_status_history')
        .insert({ admission_id: r.id, from_stage: r.pipeline_stage || 'submitted', to_stage: next });
      q.reload();
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Stack.Screen options={{ title: r?.student_name || t('admissions.lead') || 'Lead' }} />
      {!r && !q.loading ? <EmptyState message={t('common.none')} /> : null}
      {r ? (
        <>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="title">{r.student_name}</Txt>
              <StatusBadge status={r.pipeline_stage || r.status} />
            </Row>
            <Txt variant="muted">{r.parent_name}</Txt>
            <Txt variant="muted">{r.course}</Txt>
            {r.phone ? <Txt>{r.phone}</Txt> : null}
            {r.email ? <Txt>{r.email}</Txt> : null}
            {r.address ? <Txt variant="muted">{r.address}</Txt> : null}
            <Txt variant="small">{formatDate(r.created_at)}</Txt>
            {r.notes ? <Txt style={{ marginTop: 8 }}>{r.notes}</Txt> : null}
          </Card>
          <Card>
            <Txt variant="h2">{t('admissions.changeStage') || 'Change stage'}</Txt>
            <Row style={{ flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {STAGES.filter((s) => s !== 'enrolled').map((s) => (
                <Button
                  key={s}
                  title={s}
                  small
                  loading={busy}
                  disabled={busy || r.pipeline_stage === 'enrolled'}
                  variant={r.pipeline_stage === s ? 'primary' : 'muted'}
                  onPress={() => setStage(s)}
                />
              ))}
            </Row>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

// Role gate: deep links (kashifulhudha://...) must not open this screen for
// users without the matching role. RLS still enforces access server-side.
export default function GuardedAdmissionDetail() {
  const { profile, caps } = useAuth();
  if (!profile) return null;
  if (!(caps?.isAdmissions || profile.role === 'super_admin')) return <Redirect href="/" />;
  return <AdmissionDetail />;
}
