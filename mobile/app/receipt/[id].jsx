import { useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { useLiveTable } from '../../lib/live';
import { formatDate, formatDateTime } from '../../lib/format';
import { methodLabel, receiptPdfUrl } from '../../lib/receipts';
import { colors, radius } from '../../lib/theme';
import { Screen, Card, Txt, Button, Badge, Money, useMoney, SectionHeader, Row, KeyValue, EmptyState, LiveIndicator } from '../../components';

export default function ReceiptScreen() {
  const { id } = useLocalSearchParams();
  const receiptId = id ? String(id) : null;
  const { t, lang } = useI18n();
  const money = useMoney();
  const [opening, setOpening] = useState(false);

  const q = useAsync(
    async () => {
      const [receipt, extra] = await Promise.all([
        must(supabase.rpc('fee_receipt_details', { p_receipt: receiptId })),
        // payer_name is not part of the receipt JSON; read it from the row (RLS-scoped).
        supabase.from('fee_receipts').select('payer_name').eq('id', receiptId).maybeSingle(),
      ]);
      return receipt ? { ...receipt, payer_name: extra?.data?.payer_name || null } : null;
    },
    [receiptId],
    { enabled: !!receiptId },
  );

  // A reversal (or late correction) shows up immediately.
  const { live } = useLiveTable({
    table: 'fee_receipts',
    filter: receiptId ? `id=eq.${receiptId}` : undefined,
    enabled: !!receiptId,
    onChange: () => q.reload(),
  });

  const r = q.data;
  const pdfUrl = receiptPdfUrl(r?.public_token);
  const org = r?.organization || {};
  const student = r?.student || {};
  const reversed = r?.status === 'reversed';
  const orgName = (lang === 'ar' && org.name_ar) || org.name_en || org.short_name || t('app.fullName');

  const openPdf = async () => {
    if (!pdfUrl) return;
    setOpening(true);
    try {
      await WebBrowser.openBrowserAsync(pdfUrl);
    } catch (e) {
      Alert.alert(t('common.error'), e?.message || t('common.error'));
    } finally {
      setOpening(false);
    }
  };

  const share = async () => {
    if (!r) return;
    const months = (r.allocations || [])
      .map((a) => `${a.month_label || a.month}: ${money(a.paid_now, r.currency)}`)
      .join('\n');
    const summary = t('receipt.shareText', {
      org: org.short_name || orgName,
      no: r.receipt_no,
      student: student.full_name || '',
      amount: money(r.amount, r.currency),
      date: formatDate(r.paid_at),
      arrears: money(r.arrears_after, r.currency),
    });
    const message = [summary, months, reversed ? t('receipt.reversedBanner') : null, pdfUrl ? `${t('receipt.pdf')}: ${pdfUrl}` : null]
      .filter(Boolean)
      .join('\n\n');
    try {
      await Share.share({ title: t('receipt.titleNo', { no: r.receipt_no }), message, url: pdfUrl || undefined });
    } catch (e) {
      Alert.alert(t('common.error'), e?.message || t('common.error'));
    }
  };

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Stack.Screen options={{ title: r?.receipt_no ? t('receipt.titleNo', { no: r.receipt_no }) : t('receipt.title') }} />
      {!q.loading && !q.error && !r ? <EmptyState message={t('receipt.notFound')} icon="receipt-outline" /> : null}
      {r ? (
        <>
          <LiveIndicator live={live} />
          {reversed ? (
            <View style={styles.reversed}>
              <Txt style={styles.reversedText} center>{t('receipt.reversedBanner')}</Txt>
            </View>
          ) : null}

          <Card accent={reversed ? colors.danger : colors.gold}>
            <Txt variant="title" center>{orgName}</Txt>
            {org.address ? <Txt variant="small" center>{org.address}</Txt> : null}
            {org.phone || org.email ? <Txt variant="small" center>{[org.phone, org.email].filter(Boolean).join(' · ')}</Txt> : null}
            <View style={styles.divider} />
            <Txt variant="h2" center>{t('receipt.heading')}</Txt>
            <KeyValue label={t('receipt.no')} value={r.receipt_no || '—'} strong />
            <KeyValue label={t('common.date')} value={formatDateTime(r.paid_at)} />
            <KeyValue label={t('common.status')} value={<Badge label={t(`status.${r.status}`)} tone={reversed ? 'danger' : 'success'} />} />
          </Card>

          <Card>
            <Txt variant="label">{t('receipt.student')}</Txt>
            <Txt variant="strong">{student.full_name || '—'}</Txt>
            <Txt variant="muted">
              {[student.index_number, student.class_number ? t('common.classN', { n: student.class_number }) : null].filter(Boolean).join(' · ') || '—'}
            </Txt>
            {(student.parents || []).length ? (
              <KeyValue label={t('receipt.parents')} value={student.parents.join(', ')} />
            ) : null}
            {r.payer_name ? <KeyValue label={t('receipt.payer')} value={r.payer_name} /> : null}
          </Card>

          <SectionHeader title={t('receipt.allocations')} />
          {(r.allocations || []).length ? (
            <Card>
              {r.allocations.map((a, i) => (
                <View key={`${a.invoice_no}-${i}`} style={[styles.alloc, i > 0 && styles.allocBorder]}>
                  <Row style={styles.between}>
                    <View style={styles.flex}>
                      <Txt variant="strong">{a.month_label || a.month}</Txt>
                      <Txt variant="small">{t('fees.invoice')} {a.invoice_no || '—'} · {t('fees.totalDue')} {money(a.invoice_total, r.currency)}</Txt>
                    </View>
                    <Money amount={a.paid_now} currency={r.currency} tone="success" />
                  </Row>
                  <KeyValue
                    label={t('receipt.balanceAfter')}
                    value={
                      Number(a.balance_after) > 0 ? (
                        <Money amount={a.balance_after} currency={r.currency} tone="danger" />
                      ) : (
                        <Badge label={t('receipt.fullyPaid')} tone="success" />
                      )
                    }
                  />
                </View>
              ))}
            </Card>
          ) : (
            <EmptyState message={t('receipt.noAllocations')} icon="list-outline" />
          )}

          <Card accent={colors.primary}>
            <KeyValue label={t('receipt.total')} value={<Money amount={r.amount} currency={r.currency} style={styles.total} />} strong />
            <KeyValue label={t('receipt.method')} value={methodLabel(t, r.method)} />
            {r.reference ? <KeyValue label={t('receipt.reference')} value={r.reference} /> : null}
            {r.notes ? <KeyValue label={t('common.note')} value={r.notes} /> : null}
            <KeyValue
              label={t('receipt.arrearsAfter')}
              value={<Money amount={r.arrears_after} currency={r.currency} tone={Number(r.arrears_after) > 0 ? 'danger' : 'success'} />}
              strong
            />
            {r.received_by ? <KeyValue label={t('receipt.receivedBy')} value={r.received_by} /> : null}
          </Card>

          <SectionHeader title={t('receipt.openMonths')} />
          {(r.open_months || []).length ? (
            <Card>
              {r.open_months.map((m) => (
                <KeyValue key={m.month} label={m.month} value={<Money amount={m.balance} currency={r.currency} tone="danger" />} />
              ))}
            </Card>
          ) : (
            <Txt variant="muted">{t('arrears.none')}</Txt>
          )}

          <Row>
            <Button style={styles.flex} title={t('receipt.openPdf')} icon="document-text-outline" loading={opening} disabled={!pdfUrl} onPress={openPdf} />
            <Button style={styles.flex} title={t('receipt.share')} icon="share-social-outline" variant="outline" onPress={share} />
          </Row>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  reversed: { backgroundColor: colors.danger, borderRadius: radius.md, padding: 10 },
  reversedText: { color: colors.white, fontWeight: '800', letterSpacing: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  between: { justifyContent: 'space-between', alignItems: 'flex-start' },
  flex: { flex: 1 },
  alloc: { gap: 4, paddingVertical: 6 },
  allocBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  total: { fontSize: 20 },
});
