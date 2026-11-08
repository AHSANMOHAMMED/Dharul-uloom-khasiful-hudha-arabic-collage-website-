import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase, must } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { useAsync } from '../../../lib/useAsync';
import { useLiveReload } from '../../../lib/live';
import { useI18n } from '../../../lib/i18n';
import { formatDate, formatDateTime } from '../../../lib/format';
import { methodLabel } from '../../../lib/receipts';
import { CHANNEL_ICON, MESSAGE_STATUS_TONE, STUDENT_COLUMNS, resendReceipt, reverseReceipt, sendReminder } from '../../../lib/finance';
import { labelOr } from '../../../lib/activities';
import { colors, radius } from '../../../lib/theme';
import {
  Screen, Card, Txt, Button, Badge, StatusBadge, Money, SectionHeader, Row, KeyValue, EmptyState, ListItem, LiveIndicator, Chips,
  PromptModal, useMoney,
} from '../../../components';

const CHANNELS = ['sms', 'whatsapp', 'email', 'push'];

function MessageRow({ m }) {
  const { t, row } = useI18n();
  const [open, setOpen] = useState(false);
  const icon = CHANNEL_ICON[m.channel] || 'chatbubble-outline';
  return (
    <Pressable onPress={() => setOpen(!open)} style={styles.msg} accessibilityRole="button">
      <View style={[row, styles.msgHead]}>
        <View style={styles.msgIcon}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Txt variant="strong" numberOfLines={1}>{m.subject || labelOr(t, `msg.channel.${m.channel}`, m.channel)}</Txt>
          <Txt variant="small" numberOfLines={1}>
            {[labelOr(t, `msg.channel.${m.channel}`, m.channel), m.recipient, m.to_address].filter(Boolean).join(' · ')}
          </Txt>
        </View>
        <Badge label={labelOr(t, `msg.status.${m.status}`, m.status)} tone={MESSAGE_STATUS_TONE[m.status] || 'neutral'} />
      </View>
      <Txt variant="muted" numberOfLines={open ? undefined : 2}>{m.body}</Txt>
      {m.error ? <Txt style={styles.err}>{`${t('msg.error')}: ${m.error}`}</Txt> : null}
      <Txt variant="small">
        {m.sent_at ? t('msg.sentAt', { at: formatDateTime(m.sent_at) }) : t('msg.queuedAt', { at: formatDateTime(m.created_at) })}
      </Txt>
    </Pressable>
  );
}

/** One student's fees from the finance desk: arrears, receipts, reminders and message log. */
export default function FinanceStudent() {
  const { id } = useLocalSearchParams();
  const studentId = id ? String(id) : null;
  const { t } = useI18n();
  const money = useMoney();
  const { caps } = useAuth();
  const [channel, setChannel] = useState('all');
  const [remindOpen, setRemindOpen] = useState(false);
  const [reverseFor, setReverseFor] = useState(null);
  const [busy, setBusy] = useState(null);

  const q = useAsync(
    async () => {
      const [student, arrears, receipts, log] = await Promise.all([
        must(supabase.from('profiles').select(STUDENT_COLUMNS).eq('id', studentId).maybeSingle()),
        must(supabase.rpc('student_arrears', { p_student: studentId })),
        must(
          supabase
            .from('fee_receipts')
            .select('id, receipt_no, amount, currency, method, reference, paid_at, status, arrears_after')
            .eq('student_id', studentId)
            .order('paid_at', { ascending: false })
            .limit(30),
        ),
        // The log is optional: a failure here should not hide the fees.
        supabase.rpc('student_message_log', { p_student: studentId, p_limit: 60 }).then((r) => (r.error ? { error: r.error.message } : { rows: r.data || [] })),
      ]);
      return { student, arrears: arrears || {}, receipts: receipts || [], log };
    },
    [studentId],
    { enabled: !!studentId && caps.isFinanceViewer },
  );
  const live = useLiveReload(['student_fees', 'fee_receipts'], studentId ? `student_id=eq.${studentId}` : undefined, q.reload, !!studentId && caps.isFinanceViewer);

  if (!caps.isFinanceViewer) {
    return (
      <Screen>
        <EmptyState message={t('admin.forbidden')} icon="lock-closed-outline" />
      </Screen>
    );
  }

  const s = q.data?.student;
  const a = q.data?.arrears || {};
  const months = a.months || [];
  const total = Number(a.total || 0);
  const log = q.data?.log || {};
  const messages = (log.rows || []).filter((m) => channel === 'all' || m.channel === channel);

  const remind = async (note) => {
    const r = await sendReminder(studentId, note);
    if (r?.ok === false) Alert.alert(t('fin.remind'), t('fin.noArrears'));
    else Alert.alert(t('fin.remind'), t('fin.remindDone', { n: r?.recipients ?? 0 }));
    q.reload();
  };

  const resend = (r) => {
    Alert.alert(t('fin.resend'), t('fin.resendConfirm', { no: r.receipt_no }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('fin.send'),
        onPress: async () => {
          setBusy(`resend:${r.id}`);
          try {
            const out = await resendReceipt(r.id);
            Alert.alert(t('fin.resend'), t('fin.resendDone', { n: out?.families ?? 0 }));
            q.reload();
          } catch (e) {
            Alert.alert(t('common.error'), e?.message || t('common.error'));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const reverse = async (reason) => {
    await reverseReceipt(reverseFor.id, reason);
    Alert.alert(t('fin.reverse'), t('fin.reverseDone', { no: reverseFor.receipt_no }));
    q.reload();
  };

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Stack.Screen options={{ title: s?.full_name || t('fin.studentTitle') }} />
      {!q.loading && !q.error && !s ? <EmptyState message={t('counter.noStudents')} icon="person-outline" /> : null}
      {s ? (
        <>
          <Card accent={total > 0 ? colors.danger : colors.primary}>
            <Row style={styles.between}>
              <View style={styles.flex}>
                <Txt variant="h2">{s.full_name}</Txt>
                <Txt variant="muted">
                  {[s.index_number, s.class_number ? t('common.classN', { n: s.class_number }) : null].filter(Boolean).join(' · ') || '—'}
                </Txt>
              </View>
              <LiveIndicator live={live} />
            </Row>
            <KeyValue label={t('arrears.total')} value={<Money amount={total} tone={total > 0 ? 'danger' : 'success'} />} strong />
            <KeyValue label={t('arrears.overdue')} value={<Money amount={a.overdue} tone="danger" />} />
          </Card>

          {caps.isFinanceStaff ? (
            <Row>
              <Button
                style={styles.flex}
                variant="gold"
                icon="cash-outline"
                title={t('fin.receive')}
                disabled={!(total > 0)}
                onPress={() => router.push({ pathname: '/receive-payment', params: { student: studentId } })}
              />
              <Button
                style={styles.flex}
                variant="outline"
                icon="notifications-outline"
                title={t('fin.remind')}
                disabled={!(total > 0)}
                onPress={() => setRemindOpen(true)}
              />
            </Row>
          ) : null}
          {caps.isFinanceStaff ? <Txt variant="small">{t('fin.remindRule')}</Txt> : null}

          <SectionHeader title={t('arrears.openMonths')} />
          {!months.length ? <Txt variant="muted">{t('arrears.none')}</Txt> : null}
          {months.map((m) => (
            <ListItem
              key={m.fee_id}
              icon="calendar-outline"
              iconColor={m.overdue ? colors.danger : colors.primary}
              title={m.month}
              subtitle={`${t('fees.invoice')} ${m.invoice_no || '—'} · ${t('fees.dueDate')} ${formatDate(m.due_date)}`}
              meta={`${t('fees.totalDue')} ${money(m.total_due)} · ${t('fees.paid')} ${money(m.paid)}`}
              right={
                <View style={styles.right}>
                  <Money amount={m.balance} tone="danger" />
                  {m.overdue ? <Badge label={t('fees.overdue')} tone="danger" /> : null}
                </View>
              }
            />
          ))}

          <SectionHeader title={t('fees.receipts')} />
          {!q.data.receipts.length ? <EmptyState message={t('fees.noReceipts')} icon="receipt-outline" /> : null}
          {q.data.receipts.map((r) => {
            const posted = r.status === 'posted';
            return (
              <ListItem
                key={r.id}
                icon="receipt-outline"
                iconColor={posted ? colors.primary : colors.muted}
                title={r.receipt_no}
                subtitle={`${formatDateTime(r.paid_at)} · ${methodLabel(t, r.method)}`}
                meta={t('receipt.arrearsAfterShort', { amount: money(r.arrears_after, r.currency) })}
                right={
                  <View style={styles.right}>
                    <Money amount={r.amount} currency={r.currency} tone={posted ? 'success' : undefined} />
                    <StatusBadge status={r.status} />
                  </View>
                }
                onPress={() => router.push(`/receipt/${r.id}`)}
              >
                {posted && (caps.isFinanceStaff || caps.isAccountant) ? (
                  <Row>
                    {caps.isFinanceStaff ? (
                      <Button small variant="outline" icon="paper-plane-outline" title={t('fin.resend')} loading={busy === `resend:${r.id}`} onPress={() => resend(r)} />
                    ) : null}
                    {caps.isAccountant ? (
                      <Button small variant="danger" icon="arrow-undo-outline" title={t('fin.reverse')} onPress={() => setReverseFor(r)} />
                    ) : null}
                  </Row>
                ) : null}
              </ListItem>
            );
          })}

          <SectionHeader title={t('msg.log')} />
          <Chips
            options={[{ value: 'all', label: t('msg.all') }, ...CHANNELS.map((c) => ({ value: c, label: t(`msg.channel.${c}`) }))]}
            value={channel}
            onChange={setChannel}
          />
          {log.error ? <Txt style={styles.err}>{log.error}</Txt> : null}
          {!log.error && !messages.length ? <EmptyState message={t('msg.none')} icon="chatbubbles-outline" /> : null}
          {messages.map((m) => (
            <MessageRow key={m.id} m={m} />
          ))}
        </>
      ) : null}

      <PromptModal
        visible={remindOpen}
        title={t('fin.remind')}
        message={t('fin.remindHint', { amount: money(total) })}
        label={t('fin.noteOptional')}
        placeholder={t('fin.notePlaceholder')}
        confirmLabel={t('fin.send')}
        onClose={() => setRemindOpen(false)}
        onSubmit={remind}
      />
      <PromptModal
        visible={!!reverseFor}
        title={t('fin.reverseTitle', { no: reverseFor?.receipt_no || '' })}
        message={t('fin.reverseHint')}
        label={t('common.reason')}
        required
        requiredMessage={t('fin.reasonRequired')}
        confirmLabel={t('fin.reverse')}
        confirmVariant="danger"
        onClose={() => setReverseFor(null)}
        onSubmit={reverse}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between', alignItems: 'flex-start' },
  flex: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  err: { color: colors.danger, fontSize: 13 },
  msg: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
  },
  msgHead: { alignItems: 'center', gap: 10 },
  msgIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
});
