import { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { formatDate } from '../lib/format';
import { colors } from '../lib/theme';
import { Screen, Card, Txt, EmptyState, StatusBadge, Row, Button, SectionHeader } from '../components';

const METHODS = ['cash', 'bank_transfer', 'cheque', 'online', 'other'];

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 10,
  padding: 10,
  marginBottom: 8,
  backgroundColor: '#fff',
};

export default function ExpensesScreen() {
  const { t } = useI18n();
  const { profile, caps } = useAuth();
  const canView = caps?.isFinanceViewer || profile?.role === 'super_admin' || caps?.isEmployee;
  const canWrite = caps?.isFinanceStaff || caps?.isEmployee || profile?.role === 'super_admin';
  const canApprove = caps?.isAccountant || caps?.isAdmin || profile?.role === 'super_admin';
  const [tab, setTab] = useState('list');
  const [busy, setBusy] = useState(false);
  const [payee, setPayee] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');

  const q = useAsync(async () => {
    const [rows, accounts] = await Promise.all([
      must(
        supabase
          .from('expenses')
          .select('id, expense_no, expense_date, payee, description, amount, currency, status, payment_method, created_at')
          .order('created_at', { ascending: false })
          .limit(60),
      ),
      must(
        supabase
          .from('accounts')
          .select('id, code, name_en, name_ar')
          .eq('type', 'expense')
          .eq('is_active', true)
          .order('code')
          .limit(80),
      ),
    ]);
    return { rows, accounts };
  }, []);

  if (!profile) return null;
  if (!canView) return <Redirect href="/" />;

  const rows = q.data?.rows || [];
  const accounts = q.data?.accounts || [];

  const submit = async () => {
    const amt = Number(amount);
    if (!accountId || !payee.trim() || !description.trim() || !(amt > 0)) {
      Alert.alert('Expense', 'Fill account, payee, description and amount.');
      return;
    }
    setBusy(true);
    try {
      await must(
        supabase.from('expenses').insert({
          account_id: accountId,
          payee: payee.trim(),
          description: description.trim(),
          amount: Math.round(amt * 100) / 100,
          expense_date: new Date().toISOString().slice(0, 10),
          reference: reference.trim() || null,
          payment_method: method,
          status: 'submitted',
        }).select('id').single(),
      );
      setPayee('');
      setDescription('');
      setAmount('');
      setReference('');
      setTab('list');
      q.reload?.() || q.refresh?.();
    } catch (e) {
      Alert.alert(t('common.error') || 'Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const act = async (id, action) => {
    setBusy(true);
    try {
      if (action === 'approve') {
        await must(supabase.rpc('approve_expense', { p_expense: id, p_approve: true }));
      } else if (action === 'reject') {
        if (!reason.trim()) throw new Error('Reason required');
        await must(supabase.rpc('approve_expense', { p_expense: id, p_approve: false, p_reason: reason.trim() }));
      } else if (action === 'pay') {
        await must(supabase.rpc('pay_expense', { p_expense: id, p_paid_from_code: '1000', p_reference: reference.trim() || null }));
      } else if (action === 'void') {
        if (!reason.trim()) throw new Error('Reason required');
        await must(supabase.rpc('void_expense', { p_expense: id, p_reason: reason.trim() }));
      }
      setReason('');
      q.reload?.() || q.refresh?.();
    } catch (e) {
      Alert.alert(t('common.error') || 'Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Txt variant="title">Expenses</Txt>
      <Row style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <Button title="List" small variant={tab === 'list' ? 'primary' : 'muted'} onPress={() => setTab('list')} />
        {canWrite ? <Button title="Submit" small variant={tab === 'create' ? 'primary' : 'muted'} onPress={() => setTab('create')} /> : null}
      </Row>

      {tab === 'create' && canWrite ? (
        <Card>
          <SectionHeader title="Submit expense claim" />
          <Txt variant="small" style={{ marginBottom: 4 }}>Expense account</Txt>
          <Row style={{ flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {accounts.slice(0, 12).map((a) => (
              <Button
                key={a.id}
                title={`${a.code} ${a.name_en || a.name_ar || ''}`.trim()}
                small
                variant={accountId === a.id ? 'primary' : 'muted'}
                onPress={() => setAccountId(a.id)}
              />
            ))}
          </Row>
          <TextInput style={inputStyle} value={payee} onChangeText={setPayee} placeholder="Payee" />
          <TextInput style={inputStyle} value={description} onChangeText={setDescription} placeholder="Description" />
          <TextInput style={inputStyle} value={amount} onChangeText={setAmount} placeholder="Amount" keyboardType="decimal-pad" />
          <Row style={{ flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {METHODS.map((m) => (
              <Button key={m} title={m} small variant={method === m ? 'primary' : 'muted'} onPress={() => setMethod(m)} />
            ))}
          </Row>
          <TextInput style={inputStyle} value={reference} onChangeText={setReference} placeholder="Reference" />
          <Button title="Submit claim" loading={busy} disabled={busy} onPress={submit} />
        </Card>
      ) : null}

      {tab === 'list' ? (
        <>
          <TextInput style={inputStyle} value={reason} onChangeText={setReason} placeholder="Reason (reject / void)" />
          {!rows.length ? <EmptyState message={t('common.none')} icon="receipt-outline" /> : null}
          {rows.map((r) => (
            <Card key={r.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="strong">{r.expense_no || r.id.slice(0, 8)}</Txt>
                <StatusBadge status={r.status} />
              </Row>
              <Txt variant="muted">{[formatDate(r.expense_date), r.payee, r.payment_method].filter(Boolean).join(' · ')}</Txt>
              <Txt>{r.description}</Txt>
              <Txt variant="strong">{Number(r.amount || 0).toFixed(2)} {r.currency || 'LKR'}</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {canApprove && r.status === 'submitted' ? (
                  <>
                    <Button title="Approve" small disabled={busy} onPress={() => act(r.id, 'approve')} />
                    <Button title="Reject" small variant="danger" disabled={busy} onPress={() => act(r.id, 'reject')} />
                  </>
                ) : null}
                {canWrite && r.status === 'approved' ? (
                  <Button title="Mark paid" small disabled={busy} onPress={() => act(r.id, 'pay')} />
                ) : null}
                {caps?.isAccountant && r.status !== 'void' ? (
                  <Button title="Void" small variant="muted" disabled={busy} onPress={() => act(r.id, 'void')} />
                ) : null}
              </View>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
