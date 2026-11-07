import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { formatDate, isISODate, toISODate, daysInclusive } from '../lib/format';
import { Screen, Card, Txt, Field, Button, Row, Chips, SectionHeader, ListItem, EmptyState, StatusBadge } from '../components';

export default function StaffLeave() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [typeId, setTypeId] = useState(null);
  const [start, setStart] = useState(toISODate());
  const [end, setEnd] = useState(toISODate());
  const [days, setDays] = useState('1');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const q = useAsync(async () => {
    const [types, balance, requests] = await Promise.all([
      must(supabase.from('staff_leave_types').select('id, code, name, is_paid').eq('is_active', true).order('code')),
      must(supabase.rpc('staff_leave_balance', { p_profile: null, p_year: new Date().getFullYear() })),
      must(
        supabase
          .from('staff_leave_requests')
          .select('id, start_date, end_date, days, reason, status, review_note, leave_type:staff_leave_types(name)')
          .eq('profile_id', user.id)
          .order('start_date', { ascending: false }),
      ),
    ]);
    return { types, balance, requests };
  }, [user?.id]);

  useEffect(() => {
    if (!typeId && q.data?.types?.length) setTypeId(q.data.types[0].id);
  }, [q.data, typeId]);

  useEffect(() => {
    const n = daysInclusive(start, end);
    if (n > 0) setDays(String(n));
  }, [start, end]);

  const submit = async () => {
    if (!typeId || !reason.trim()) return Alert.alert(t('common.error'), t('common.required'));
    if (!isISODate(start) || !isISODate(end)) return Alert.alert(t('common.error'), t('common.invalidDate'));
    if (end < start) return Alert.alert(t('common.error'), t('common.dateOrder'));
    const n = Number(days);
    if (!(n > 0)) return Alert.alert(t('common.error'), t('common.required'));
    setSaving(true);
    try {
      await must(supabase.from('staff_leave_requests').insert({ leave_type_id: typeId, start_date: start, end_date: end, days: n, reason: reason.trim() }));
      setReason('');
      Alert.alert(t('common.success'), t('leave.sent'));
      q.reload();
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (r) => {
    const { error } = await supabase.from('staff_leave_requests').update({ status: 'cancelled' }).eq('id', r.id);
    if (error) Alert.alert(t('common.error'), error.message);
    q.reload();
  };

  const types = q.data?.types || [];
  const balance = Object.fromEntries((q.data?.balance || []).map((b) => [b.leave_type_id, b]));
  const requests = q.data?.requests || [];

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Card>
        <Txt variant="label">{t('staff.leaveType')}</Txt>
        <Chips
          options={types.map((ty) => ({
            value: ty.id,
            label: balance[ty.id] ? `${ty.name} (${Number(balance[ty.id].remaining)})` : ty.name,
          }))}
          value={typeId}
          onChange={setTypeId}
        />
        <Row>
          <Field style={{ flex: 1 }} label={t('common.from')} value={start} onChangeText={setStart} placeholder={t('common.dateHint')} autoCapitalize="none" />
          <Field style={{ flex: 1 }} label={t('common.to')} value={end} onChangeText={setEnd} placeholder={t('common.dateHint')} autoCapitalize="none" />
          <Field style={{ width: 70 }} label={t('staff.days')} value={days} onChangeText={setDays} keyboardType="decimal-pad" />
        </Row>
        <Field label={t('common.reason')} value={reason} onChangeText={setReason} multiline placeholder={t('leave.reasonPlaceholder')} />
        <Button title={t('common.submit')} icon="send-outline" loading={saving} onPress={submit} />
      </Card>

      <SectionHeader title={t('staff.myLeaves')} />
      {!requests.length ? <EmptyState message={t('leave.none')} icon="calendar-clear-outline" /> : null}
      {requests.map((r) => (
        <ListItem
          key={r.id}
          title={`${r.leave_type?.name || ''} · ${formatDate(r.start_date)} → ${formatDate(r.end_date)}`}
          subtitle={`${t('common.days', { n: Number(r.days) })} · ${r.reason}`}
          meta={r.review_note || undefined}
          right={<StatusBadge status={r.status} />}
        >
          {r.status === 'pending' ? <Button small variant="outline" title={t('staff.cancelLeave')} onPress={() => cancel(r)} /> : null}
        </ListItem>
      ))}
    </Screen>
  );
}
