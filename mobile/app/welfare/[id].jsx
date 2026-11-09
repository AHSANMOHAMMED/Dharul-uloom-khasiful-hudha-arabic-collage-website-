import { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { colors } from '../../lib/theme';
import { Screen, Card, Txt, EmptyState, StatusBadge, Row, Button, SectionHeader } from '../../components';

const STATUSES = ['open', 'in_progress', 'closed'];

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 10,
  padding: 10,
  marginBottom: 8,
  backgroundColor: '#fff',
};

export default function WelfareDetail() {
  const { id } = useLocalSearchParams();
  const { t } = useI18n();
  const { caps, profile } = useAuth();
  const canWrite = caps?.isAdmin || caps?.isEmployee || profile?.role === 'super_admin';
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

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

  const setStatus = async (status) => {
    setBusy(true);
    try {
      const patch = {
        status,
        closed_at: status === 'closed' ? new Date().toISOString() : null,
      };
      await must(supabase.from('welfare_cases').update(patch).eq('id', String(id)).select('id').single());
      q.reload?.() || q.refresh?.();
    } catch (e) {
      Alert.alert(t('common.error') || 'Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    if (!note.trim() || !r) return;
    setBusy(true);
    try {
      // org_id is typically filled by tenant trigger; fetch from case if needed
      const caseRow = await must(
        supabase.from('welfare_cases').select('org_id').eq('id', String(id)).maybeSingle(),
      );
      await must(
        supabase.from('welfare_notes').insert({
          case_id: String(id),
          org_id: caseRow.org_id,
          note: note.trim(),
        }).select('id').single(),
      );
      setNote('');
      q.reload?.() || q.refresh?.();
    } catch (e) {
      Alert.alert(t('common.error') || 'Error', e.message);
    } finally {
      setBusy(false);
    }
  };

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
            {canWrite ? (
              <View style={{ marginTop: 12 }}>
                <SectionHeader title="Update status" />
                <Row style={{ flexWrap: 'wrap', gap: 6 }}>
                  {STATUSES.map((s) => (
                    <Button
                      key={s}
                      title={s}
                      small
                      variant={r.status === s ? 'primary' : 'muted'}
                      disabled={busy}
                      onPress={() => setStatus(s)}
                    />
                  ))}
                </Row>
              </View>
            ) : null}
          </Card>

          {canWrite ? (
            <Card>
              <SectionHeader title="Add note" />
              <TextInput
                style={[inputStyle, { minHeight: 70, textAlignVertical: 'top' }]}
                value={note}
                onChangeText={setNote}
                placeholder="Confidential note…"
                multiline
              />
              <Button title="Save note" loading={busy} disabled={busy || !note.trim()} onPress={addNote} />
            </Card>
          ) : null}

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
