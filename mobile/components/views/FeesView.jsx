import { useState } from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { payFee } from '../../lib/payments';
import { formatDate } from '../../lib/format';
import { useLiveReload } from '../../lib/live';
import { methodLabel } from '../../lib/receipts';
import { colors } from '../../lib/theme';
import {
  Screen, Card, Txt, Button, StatusBadge, Badge, EmptyState, Money, useMoney, SectionHeader, Row, KeyValue, ListItem, LiveIndicator,
} from '..';

export default function FeesView({ studentId }) {
  const { t } = useI18n();
  const money = useMoney();
  const [paying, setPaying] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const q = useAsync(
    async () => {
      const [statement, arrears, receipts] = await Promise.all([
        must(supabase.rpc('student_fee_statement', { p_student: studentId })),
        must(supabase.rpc('student_arrears', { p_student: studentId })),
        must(
          supabase
            .from('fee_receipts')
            .select('id, receipt_no, amount, currency, method, reference, paid_at, status, arrears_after')
            .eq('student_id', studentId)
            .order('paid_at', { ascending: false })
            .limit(50),
        ),
      ]);
      return { ...(statement || {}), arrears: arrears || {}, receiptList: receipts || [] };
    },
    [studentId],
    { enabled: !!studentId },
  );

  // A parent sees the payment the moment the accountant records it.
  const live = useLiveReload(['student_fees', 'fee_receipts'], studentId ? `student_id=eq.${studentId}` : undefined, q.reload, !!studentId);

  const onPay = async (inv) => {
    setPaying(inv.id);
    try {
      const outcome = await payFee(inv.id);
      if (outcome === 'dismissed') Alert.alert(t('fees.title'), t('fees.payCancelled'));
    } catch (e) {
      Alert.alert(t('fees.payFailed'), e?.message || t('common.error'));
    } finally {
      setPaying(null);
      q.reload();
    }
  };

  const invoices = q.data?.invoices || [];
  const outstanding = Number(q.data?.total_outstanding || 0);
  const arrears = q.data?.arrears || {};
  const arrearsTotal = Number(arrears.total || 0);
  const arrearsOverdue = Number(arrears.overdue || 0);
  const openMonths = arrears.months || [];
  const receiptList = q.data?.receiptList || [];

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <LiveIndicator live={live} />
      <Card accent={outstanding > 0 ? colors.gold : colors.primary}>
        <Txt variant="label">{t('fees.outstanding')}</Txt>
        <Money amount={outstanding} tone={outstanding > 0 ? 'danger' : 'success'} style={styles.big} />
        {q.data?.student?.full_name ? (
          <Txt variant="muted">
            {q.data.student.full_name}
            {q.data.student.index_number ? ` · ${q.data.student.index_number}` : ''}
          </Txt>
        ) : null}
        <Txt variant="small">{t('fees.payNote')}</Txt>
      </Card>

      <SectionHeader title={t('arrears.title')} />
      <Card accent={arrearsOverdue > 0 ? colors.danger : colors.primary}>
        <KeyValue label={t('arrears.total')} value={<Money amount={arrearsTotal} tone={arrearsTotal > 0 ? 'danger' : 'success'} />} strong />
        <KeyValue label={t('arrears.overdue')} value={<Money amount={arrearsOverdue} tone={arrearsOverdue > 0 ? 'danger' : 'success'} />} />
        {openMonths.length ? (
          <View style={styles.details}>
            <Txt variant="label">{t('arrears.openMonths')}</Txt>
            {openMonths.map((m) => (
              <Row key={m.fee_id || m.month} style={[styles.between, m.overdue && styles.overdueRow]}>
                <View style={styles.flex}>
                  <Txt variant="strong" style={m.overdue ? styles.overdueText : null}>{m.month}</Txt>
                  <Txt variant="small">
                    {t('fees.dueDate')} {formatDate(m.due_date)} · {t('fees.paid')} {money(m.paid)} / {money(m.total_due)}
                  </Txt>
                </View>
                <View style={styles.badges}>
                  <Money amount={m.balance} tone="danger" />
                  {m.overdue ? <Badge label={t('fees.overdue')} tone="danger" /> : null}
                </View>
              </Row>
            ))}
          </View>
        ) : (
          <Txt variant="muted">{t('arrears.none')}</Txt>
        )}
      </Card>

      <SectionHeader title={t('receipt.list')} />
      {!receiptList.length ? <EmptyState message={t('fees.noReceipts')} icon="receipt-outline" /> : null}
      {receiptList.map((r) => (
        <ListItem
          key={r.id}
          icon="receipt-outline"
          iconColor={r.status === 'reversed' ? colors.muted : colors.primary}
          title={r.receipt_no}
          subtitle={`${formatDate(r.paid_at)} · ${methodLabel(t, r.method)}${r.reference ? ` · ${r.reference}` : ''}`}
          meta={t('receipt.arrearsAfterShort', { amount: money(r.arrears_after, r.currency) })}
          right={
            <View style={styles.badges}>
              <Money amount={r.amount} currency={r.currency} />
              {r.status === 'reversed' ? <StatusBadge status="reversed" /> : null}
            </View>
          }
          onPress={() => router.push(`/receipt/${r.id}`)}
        />
      ))}

      <SectionHeader title={t('fees.statement')} />
      {!invoices.length ? <EmptyState message={t('fees.none')} icon="receipt-outline" /> : null}
      {invoices.map((inv) => {
        const balance = Number(inv.balance ?? Number(inv.total_due) - Number(inv.paid_amount));
        const payable = (inv.status === 'unpaid' || inv.status === 'partial') && balance > 0;
        const open = expanded === inv.id;
        return (
          <Card key={inv.id} onPress={() => setExpanded(open ? null : inv.id)}>
            <Row style={styles.between}>
              <View style={styles.flex}>
                <Txt variant="strong">{inv.month}</Txt>
                <Txt variant="small">
                  {t('fees.invoice')} {inv.invoice_no || '—'} · {t('fees.dueDate')} {formatDate(inv.due_date)}
                </Txt>
              </View>
              <View style={styles.badges}>
                <StatusBadge status={inv.status} />
                {inv.overdue ? <Badge label={t('fees.overdue')} tone="danger" /> : null}
              </View>
            </Row>
            <KeyValue label={t('fees.totalDue')} value={money(inv.total_due)} />
            <KeyValue label={t('fees.paid')} value={money(inv.paid_amount)} />
            <KeyValue label={t('fees.balance')} value={<Money amount={balance} tone={balance > 0 ? 'danger' : 'success'} />} strong />

            {open ? (
              <View style={styles.details}>
                <Txt variant="label">{t('fees.lines')}</Txt>
                {(inv.lines || []).map((l, i) => (
                  <KeyValue key={`l${i}`} label={l.description} value={money(l.amount)} />
                ))}
                <Txt variant="label" style={styles.mt}>{t('fees.receipts')}</Txt>
                {(inv.payments || []).length ? (
                  inv.payments.map((p, i) => (
                    <Row key={`p${i}`} style={styles.between}>
                      <View style={styles.flex}>
                        <Txt>{p.receipt_no}</Txt>
                        <Txt variant="small">{formatDate(p.paid_at)} · {p.method}</Txt>
                      </View>
                      <Money amount={p.amount} />
                      {p.status === 'reversed' ? <StatusBadge status="reversed" /> : null}
                    </Row>
                  ))
                ) : (
                  <Txt variant="muted">{t('fees.noReceipts')}</Txt>
                )}
              </View>
            ) : null}

            {payable ? (
              <Button
                title={paying === inv.id ? t('fees.paying') : t('fees.pay', { amount: money(balance) })}
                icon="card-outline"
                variant="gold"
                loading={paying === inv.id}
                disabled={!!paying}
                onPress={() => onPay(inv)}
              />
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 26 },
  between: { justifyContent: 'space-between', alignItems: 'flex-start' },
  flex: { flex: 1, gap: 2 },
  badges: { gap: 4, alignItems: 'flex-end' },
  details: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 6 },
  mt: { marginTop: 6 },
  overdueRow: { backgroundColor: colors.dangerLight, borderRadius: 8, padding: 6 },
  overdueText: { color: colors.danger },
});
