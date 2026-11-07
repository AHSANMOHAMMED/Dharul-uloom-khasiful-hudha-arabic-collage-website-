import { useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { isISODate, toISODate } from '../lib/format';
import { colors } from '../lib/theme';
import { accountName } from '../lib/governance';
import { Button, Card, Chips, EmptyState, Field, KeyValue, Money, Screen, Txt, useMoney } from '../components';

/** Duty holder records a petty cash spend (petty_cash_spend); accounts approve it later. */
export default function PettyCashSpend() {
  const { fund, duty } = useLocalSearchParams();
  const { t, lang } = useI18n();
  const { caps } = useAuth();
  const money = useMoney();
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(null);
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState(toISODate());
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);

  const q = useAsync(
    async () => {
      const [balance, accounts] = await Promise.all([
        must(supabase.rpc('petty_cash_balance', { p_fund: fund })),
        must(supabase.from('accounts').select('id, code, name, name_ar').eq('type', 'expense').eq('is_active', true).order('code')),
      ]);
      return { balance, accounts };
    },
    [fund],
    { enabled: !!fund && caps.isEmployee },
  );

  if (!fund || !caps.isEmployee) {
    return (
      <Screen>
        <EmptyState message={t('admin.forbidden')} icon="lock-closed-outline" />
      </Screen>
    );
  }

  const available = Number(q.data?.balance?.available || 0);
  const needle = filter.trim().toLowerCase();
  const accounts = (q.data?.accounts || []).filter(
    (a) => !needle || a.id === accountId || [a.code, a.name, a.name_ar].some((v) => (v || '').toLowerCase().includes(needle)),
  );

  const submit = async () => {
    const n = Number(String(amount).replace(/,/g, ''));
    if (!(n > 0)) return Alert.alert(t('common.error'), t('counter.amountInvalid'));
    if (n > available) return Alert.alert(t('common.error'), t('petty.overAvailable', { amount: money(available) }));
    if (!accountId) return Alert.alert(t('common.error'), t('petty.pickAccount'));
    if (!description.trim()) return Alert.alert(t('common.error'), t('petty.descriptionRequired'));
    if (!isISODate(date)) return Alert.alert(t('common.error'), t('common.invalidDate'));
    setSaving(true);
    try {
      await must(
        supabase.rpc('petty_cash_spend', {
          p_fund: fund,
          p_amount: n,
          p_expense_account: accountId,
          p_description: description.trim(),
          p_vendor: vendor.trim() || null,
          p_receipt_url: null,
          p_date: date,
        }),
      );
      Alert.alert(t('common.success'), t('petty.recorded'), [{ text: t('common.close'), onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Card accent={colors.gold}>
        {duty ? <Txt variant="h2">{String(duty)}</Txt> : null}
        <KeyValue label={t('petty.available')} value={<Money amount={available} tone="success" />} strong />
        <KeyValue label={t('petty.pending')} value={<Money amount={q.data?.balance?.pending_spend || 0} />} />
        <Txt variant="small">{t('petty.approvalNote')}</Txt>
      </Card>

      <Card>
        <Field label={t('counter.amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
        <Txt variant="label">{t('petty.account')}</Txt>
        {(q.data?.accounts || []).length > 8 ? (
          <Field value={filter} onChangeText={setFilter} placeholder={t('petty.accountSearch')} autoCapitalize="none" />
        ) : null}
        {!accounts.length ? <Txt variant="small">{t('petty.noAccounts')}</Txt> : null}
        <Chips options={accounts.map((a) => ({ value: a.id, label: `${a.code} · ${accountName(a, lang)}` }))} value={accountId} onChange={setAccountId} />
        <Field label={t('petty.description')} value={description} onChangeText={setDescription} placeholder={t('petty.descriptionPlaceholder')} multiline />
        <Field label={t('petty.vendor')} value={vendor} onChangeText={setVendor} placeholder={t('petty.vendorPlaceholder')} hint={t('common.optional')} />
        <Field label={t('common.date')} value={date} onChangeText={setDate} placeholder={t('common.dateHint')} autoCapitalize="none" />
        <Button title={t('petty.submit')} icon="send-outline" loading={saving} onPress={submit} />
      </Card>
    </Screen>
  );
}
