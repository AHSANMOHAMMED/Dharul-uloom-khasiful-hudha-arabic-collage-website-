import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { useLiveReload } from '../lib/live';
import { formatDate } from '../lib/format';
import { PAYMENT_METHODS, methodLabel } from '../lib/receipts';
import { colors } from '../lib/theme';
import {
  Screen, Card, Txt, Button, Field, Chips, ListItem, EmptyState, Badge, Money, useMoney, SectionHeader, Row, KeyValue, Loading, LiveIndicator,
} from '../components';

const STUDENT_COLUMNS = 'id, full_name, index_number, class_number';

// PostgREST `or` filters use , ( ) as syntax; strip them from user input.
const cleanTerm = (s) => s.replace(/[,()*%\\]/g, ' ').trim();

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

/** Accountant / treasurer counter: receive a payment against a student's arrears. */
export default function ReceivePayment() {
  const { t } = useI18n();
  const money = useMoney();
  const { caps } = useAuth();
  const params = useLocalSearchParams();

  const [term, setTerm] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [student, setStudent] = useState(null);

  const [amount, setAmount] = useState('');
  const [feeId, setFeeId] = useState(null);
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [payer, setPayer] = useState('');
  // One idempotency key per screen visit + payment details: a retry after a
  // network timeout returns the same receipt instead of charging twice.
  const nonce = useRef(`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Optional preselect: /receive-payment?student=<uuid>
  const preset = params.student ? String(params.student) : null;
  useEffect(() => {
    if (!preset || !supabase || !caps.isFinanceStaff) return;
    supabase
      .from('profiles')
      .select(STUDENT_COLUMNS)
      .eq('id', preset)
      .eq('account_type', 'student')
      .maybeSingle()
      .then(({ data }) => data && setStudent(data));
  }, [preset, caps.isFinanceStaff]);

  const arrearsQ = useAsync(() => must(supabase.rpc('student_arrears', { p_student: student.id })), [student?.id], {
    enabled: !!student,
  });
  const live = useLiveReload(['student_fees'], student ? `student_id=eq.${student.id}` : undefined, arrearsQ.reload, !!student);

  if (!caps.isFinanceStaff) {
    return (
      <Screen>
        <EmptyState message={t('admin.forbidden')} icon="lock-closed-outline" />
      </Screen>
    );
  }

  const search = async () => {
    const q = cleanTerm(term);
    if (q.length < 2) {
      Alert.alert(t('counter.title'), t('counter.searchMin'));
      return;
    }
    setSearching(true);
    try {
      const rows = await must(
        supabase
          .from('profiles')
          .select(STUDENT_COLUMNS)
          .eq('account_type', 'student')
          .or(`full_name.ilike.%${q}%,index_number.ilike.%${q}%`)
          .order('full_name')
          .limit(25),
      );
      setResults(rows || []);
    } catch (e) {
      Alert.alert(t('common.error'), e?.message || t('common.error'));
    } finally {
      setSearching(false);
    }
  };

  const pick = (s) => {
    arrearsQ.setData(null);
    setStudent(s);
    setAmount('');
    setFeeId(null);
    setReference('');
    setPayer('');
    setNotes('');
  };

  const arrears = arrearsQ.data || {};
  const months = arrears.months || [];
  const total = round2(arrears.total);
  const amountNum = round2(String(amount).replace(/,/g, ''));
  const needsReference = method !== 'cash';

  const validate = () => {
    if (!student) return t('counter.pickStudent');
    if (!(amountNum > 0)) return t('counter.amountInvalid');
    if (amountNum > total) return t('counter.amountTooHigh', { total: money(total) });
    if (needsReference && !reference.trim()) return t('counter.referenceRequired');
    return null;
  };

  const submit = async () => {
    const idemKey = `${nonce.current}:${student.id}:${amountNum}:${feeId || ''}:${method}`;
    setSaving(true);
    try {
      const receipt = await must(
        supabase.rpc('receive_student_payment', {
          p_student: student.id,
          p_amount: amountNum,
          p_method: method,
          p_reference: reference.trim() || null,
          p_notes: notes.trim() || null,
          p_paid_at: new Date().toISOString(),
          p_fee: feeId,
          p_payer_name: payer.trim() || null,
          p_idempotency_key: idemKey,
        }),
      );
      if (receipt?.id) router.replace(`/receipt/${receipt.id}`);
      else Alert.alert(t('common.success'), t('counter.recorded'));
    } catch (e) {
      Alert.alert(t('counter.failed'), e?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const confirm = () => {
    const problem = validate();
    if (problem) {
      Alert.alert(t('common.error'), problem);
      return;
    }
    const lines = [
      `${t('receipt.student')}: ${student.full_name}${student.index_number ? ` (${student.index_number})` : ''}`,
      `${t('counter.amount')}: ${money(amountNum)}`,
      `${t('receipt.method')}: ${methodLabel(t, method)}`,
      reference.trim() ? `${t('receipt.reference')}: ${reference.trim()}` : null,
      payer.trim() ? `${t('receipt.payer')}: ${payer.trim()}` : null,
      `${t('receipt.arrearsAfter')}: ${money(round2(total - amountNum))}`,
    ].filter(Boolean);
    Alert.alert(t('counter.confirmTitle'), lines.join('\n'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('counter.confirm'), onPress: submit },
    ]);
  };

  return (
    <Screen>
      {!student ? (
        <>
          <Card>
            <Field
              label={t('counter.searchLabel')}
              placeholder={t('counter.searchPlaceholder')}
              value={term}
              onChangeText={setTerm}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={search}
            />
            <Button title={t('counter.search')} icon="search-outline" loading={searching} onPress={search} />
          </Card>
          {results && !results.length ? <EmptyState message={t('counter.noStudents')} icon="person-outline" /> : null}
          {(results || []).map((s) => (
            <ListItem
              key={s.id}
              icon="person-circle-outline"
              title={s.full_name}
              subtitle={[s.index_number, s.class_number ? t('common.classN', { n: s.class_number }) : null].filter(Boolean).join(' · ')}
              onPress={() => pick(s)}
            />
          ))}
        </>
      ) : (
        <>
          <Card accent={colors.gold}>
            <Row style={styles.between}>
              <View style={styles.flex}>
                <Txt variant="h2">{student.full_name}</Txt>
                <Txt variant="muted">
                  {[student.index_number, student.class_number ? t('common.classN', { n: student.class_number }) : null].filter(Boolean).join(' · ')}
                </Txt>
              </View>
              <Button small variant="outline" title={t('counter.change')} onPress={() => setStudent(null)} />
            </Row>
            <LiveIndicator live={live} />
          </Card>

          <SectionHeader title={t('arrears.title')} />
          {arrearsQ.loading ? <Loading inline /> : null}
          {arrearsQ.error ? <Txt style={styles.error}>{arrearsQ.error}</Txt> : null}
          {arrearsQ.data ? (
            <Card accent={Number(arrears.overdue) > 0 ? colors.danger : colors.primary}>
              <KeyValue label={t('arrears.total')} value={<Money amount={total} tone={total > 0 ? 'danger' : 'success'} />} strong />
              <KeyValue label={t('arrears.overdue')} value={<Money amount={arrears.overdue} tone="danger" />} />
              {!months.length ? <Txt variant="muted">{t('arrears.none')}</Txt> : null}
              {months.map((m) => {
                const selected = feeId === m.fee_id;
                return (
                  <ListItem
                    key={m.fee_id}
                    icon={selected ? 'radio-button-on' : 'radio-button-off'}
                    iconColor={m.overdue ? colors.danger : colors.primary}
                    title={m.month}
                    subtitle={`${t('fees.invoice')} ${m.invoice_no || '—'} · ${t('fees.dueDate')} ${formatDate(m.due_date)}`}
                    right={
                      <View style={styles.right}>
                        <Money amount={m.balance} tone="danger" />
                        {m.overdue ? <Badge label={t('fees.overdue')} tone="danger" /> : null}
                      </View>
                    }
                    onPress={() => {
                      setFeeId(selected ? null : m.fee_id);
                      if (!selected) setAmount(String(round2(m.balance)));
                    }}
                  />
                );
              })}
              {months.length ? <Txt variant="small">{t('counter.allocationNote')}</Txt> : null}
            </Card>
          ) : null}

          {total > 0 ? (
            <Card>
              <Field
                label={t('counter.amount')}
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9.,]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
              <Row>
                <Button
                  small
                  variant="outline"
                  title={t('counter.oldestMonth')}
                  disabled={!months.length}
                  onPress={() => {
                    setFeeId(null);
                    setAmount(String(round2(months[0]?.balance)));
                  }}
                />
                <Button
                  small
                  variant="outline"
                  title={t('counter.allArrears')}
                  onPress={() => {
                    setFeeId(null);
                    setAmount(String(total));
                  }}
                />
              </Row>

              <Txt variant="label">{t('receipt.method')}</Txt>
              <Chips options={PAYMENT_METHODS.map((m) => ({ value: m, label: methodLabel(t, m) }))} value={method} onChange={setMethod} />

              <Field
                label={needsReference ? `${t('receipt.reference')} *` : t('receipt.reference')}
                placeholder={t('counter.referencePlaceholder')}
                value={reference}
                onChangeText={setReference}
                autoCapitalize="characters"
              />
              <Field label={t('receipt.payer')} placeholder={t('counter.payerPlaceholder')} value={payer} onChangeText={setPayer} />
              <Field label={t('common.note')} value={notes} onChangeText={setNotes} multiline />

              <Button title={t('counter.receive', { amount: amountNum > 0 ? money(amountNum) : '' })} icon="cash-outline" variant="gold" loading={saving} onPress={confirm} />
            </Card>
          ) : arrearsQ.data ? (
            <EmptyState message={t('counter.nothingDue')} icon="checkmark-circle-outline" />
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between', alignItems: 'flex-start' },
  flex: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  error: { color: colors.danger },
});
