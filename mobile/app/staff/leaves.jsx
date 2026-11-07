import { useState } from 'react';
import { Alert } from 'react-native';
import { supabase, must } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { formatDate, daysInclusive } from '../../lib/format';
import { Screen, Card, Txt, Field, Button, Row, EmptyState, Chips, StatusBadge } from '../../components';

export default function ReviewLeaves() {
  const { t } = useI18n();
  const { user, caps } = useAuth();
  const [filter, setFilter] = useState('pending');
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);

  const q = useAsync(
    () =>
      must(
        supabase
          .from('leave_requests')
          .select('id, start_date, end_date, reason, status, response_note, created_at, student:profiles!leave_requests_student_id_fkey(full_name, index_number, class_number)')
          .eq('status', filter)
          .order('created_at', { ascending: false })
          .limit(100),
      ),
    [filter],
    { enabled: caps.canReviewStudentLeave },
  );

  if (!caps.canReviewStudentLeave) {
    return (
      <Screen>
        <EmptyState message={t('admin.forbidden')} icon="lock-closed-outline" />
      </Screen>
    );
  }

  const review = async (r, status) => {
    setBusy(r.id + status);
    try {
      await must(
        supabase
          .from('leave_requests')
          .update({ status, response_note: notes[r.id]?.trim() || null, reviewed_by: user.id, updated_at: new Date().toISOString() })
          .eq('id', r.id),
      );
      Alert.alert(t('common.success'), t('leave.reviewed', { status: t(`status.${status}`) }));
      q.reload();
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setBusy(null);
    }
  };

  const rows = q.data || [];
  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Chips
        options={['pending', 'approved', 'rejected'].map((s) => ({ value: s, label: t(`status.${s}`) }))}
        value={filter}
        onChange={setFilter}
      />
      {!rows.length ? <EmptyState message={t('leave.noPending')} icon="checkmark-circle-outline" /> : null}
      {rows.map((r) => (
        <Card key={r.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="strong" style={{ flex: 1 }}>{r.student?.full_name || '—'}</Txt>
            <StatusBadge status={r.status} />
          </Row>
          <Txt variant="small">
            {[r.student?.index_number, r.student?.class_number ? t('common.classN', { n: r.student.class_number }) : null].filter(Boolean).join(' · ')}
          </Txt>
          <Txt>{`${formatDate(r.start_date)} → ${formatDate(r.end_date)} · ${t('common.days', { n: daysInclusive(r.start_date, r.end_date) })}`}</Txt>
          <Txt variant="muted">{r.reason}</Txt>
          {r.status === 'pending' ? (
            <>
              <Field placeholder={t('leave.responseNote')} value={notes[r.id] || ''} onChangeText={(v) => setNotes({ ...notes, [r.id]: v })} />
              <Row>
                <Button style={{ flex: 1 }} title={t('leave.approve')} icon="checkmark" loading={busy === r.id + 'approved'} disabled={!!busy} onPress={() => review(r, 'approved')} />
                <Button style={{ flex: 1 }} variant="danger" title={t('leave.reject')} icon="close" loading={busy === r.id + 'rejected'} disabled={!!busy} onPress={() => review(r, 'rejected')} />
              </Row>
            </>
          ) : r.response_note ? (
            <Txt variant="small">{t('leave.response', { note: r.response_note })}</Txt>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
