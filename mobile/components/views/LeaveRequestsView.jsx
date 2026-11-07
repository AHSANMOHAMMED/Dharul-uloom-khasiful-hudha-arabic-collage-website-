import { useState } from 'react';
import { Alert } from 'react-native';
import { supabase, must } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { formatDate, isISODate, toISODate, addDays } from '../../lib/format';
import { useLiveReload } from '../../lib/live';
import { Screen, Card, Field, Button, ListItem, EmptyState, StatusBadge, SectionHeader, Row, LiveIndicator } from '..';

/** Parent (or student) creates leave requests for a student and sees history. */
export default function LeaveRequestsView({ studentId }) {
  const { t } = useI18n();
  const { user, profile } = useAuth();
  const [start, setStart] = useState(toISODate());
  const [end, setEnd] = useState(toISODate());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const q = useAsync(
    () =>
      must(
        supabase
          .from('leave_requests')
          .select('id, start_date, end_date, reason, status, response_note, created_at')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false }),
      ),
    [studentId],
    { enabled: !!studentId },
  );

  // Approvals / rejections by the teacher appear without a refresh.
  const live = useLiveReload(['leave_requests'], studentId ? `student_id=eq.${studentId}` : undefined, q.reload, !!studentId);

  const submit = async () => {
    if (!reason.trim()) return Alert.alert(t('common.error'), t('common.required'));
    if (!isISODate(start) || !isISODate(end)) return Alert.alert(t('common.error'), t('common.invalidDate'));
    if (end < start) return Alert.alert(t('common.error'), t('common.dateOrder'));
    setSaving(true);
    try {
      const row = { student_id: studentId, start_date: start, end_date: end, reason: reason.trim() };
      if (profile?.account_type === 'parent') row.parent_id = user.id;
      await must(supabase.from('leave_requests').insert(row));
      setReason('');
      Alert.alert(t('common.success'), t('leave.sent'));
      q.reload();
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  const rows = q.data || [];

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <SectionHeader title={t('leave.new')} />
      <Card>
        <Row>
          <Field style={{ flex: 1 }} label={t('common.from')} value={start} onChangeText={setStart} placeholder={t('common.dateHint')} autoCapitalize="none" />
          <Field style={{ flex: 1 }} label={t('common.to')} value={end} onChangeText={setEnd} placeholder={t('common.dateHint')} autoCapitalize="none" />
        </Row>
        <Row>
          <Button small variant="outline" title={t('common.today')} onPress={() => { setStart(toISODate()); setEnd(toISODate()); }} />
          <Button small variant="outline" title="+1" onPress={() => setEnd(addDays(isISODate(end) ? end : toISODate(), 1))} />
        </Row>
        <Field label={t('common.reason')} placeholder={t('leave.reasonPlaceholder')} value={reason} onChangeText={setReason} multiline />
        <Button title={t('common.submit')} icon="send-outline" loading={saving} onPress={submit} />
      </Card>

      <SectionHeader title={t('leave.history')} />
      <LiveIndicator live={live} />
      {!rows.length ? <EmptyState message={t('leave.none')} icon="calendar-clear-outline" /> : null}
      {rows.map((r) => (
        <ListItem
          key={r.id}
          title={`${formatDate(r.start_date)} → ${formatDate(r.end_date)}`}
          subtitle={r.reason}
          meta={r.response_note ? t('leave.response', { note: r.response_note }) : undefined}
          right={<StatusBadge status={r.status} />}
        />
      ))}
    </Screen>
  );
}
