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

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 10,
  padding: 10,
  marginBottom: 8,
  backgroundColor: '#fff',
};

export default function ChequesScreen() {
  const { t } = useI18n();
  const { profile, caps } = useAuth();
  const canView = caps?.isFinanceViewer || profile?.role === 'super_admin';
  const canWrite = caps?.isFinanceStaff || profile?.role === 'super_admin';
  const [tab, setTab] = useState('list');
  const [busy, setBusy] = useState(false);
  const [direction, setDirection] = useState('received');
  const [chequeNo, setChequeNo] = useState('');
  const [bank, setBank] = useState('');
  const [amount, setAmount] = useState('');
  const [party, setParty] = useState('');
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().slice(0, 10));
  const [purpose, setPurpose] = useState('');
  const [note, setNote] = useState('');

  const q = useAsync(
    () =>
      must(
        supabase
          .from('cheques')
          .select('id, direction, cheque_no, bank_name, amount, currency, cheque_date, party_name, purpose, status, created_at')
          .order('created_at', { ascending: false })
          .limit(60),
      ),
    [],
  );

  if (!profile) return null;
  if (!canView) return <Redirect href="/" />;

  const rows = q.data || [];

  const save = async () => {
    const amt = Number(amount);
    if (!chequeNo.trim() || !party.trim() || !(amt > 0) || !chequeDate) {
      Alert.alert('Cheque', 'Fill cheque no, party, amount and date.');
      return;
    }
    setBusy(true);
    try {
      await must(
        supabase.from('cheques').insert({
          direction,
          cheque_no: chequeNo.trim(),
          bank_name: bank.trim() || null,
          amount: Math.round(amt * 100) / 100,
          cheque_date: chequeDate,
          party_name: party.trim(),
          purpose: purpose.trim() || null,
          status: 'pending',
        }).select('id').single(),
      );
      setChequeNo('');
      setBank('');
      setAmount('');
      setParty('');
      setPurpose('');
      setTab('list');
      q.reload?.() || q.refresh?.();
    } catch (e) {
      Alert.alert(t('common.error') || 'Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id, status) => {
    setBusy(true);
    try {
      await must(
        supabase.rpc('update_cheque_status', {
          p_cheque: id,
          p_status: status,
          p_on: new Date().toISOString().slice(0, 10),
          p_note: note.trim() || null,
        }),
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
      <Txt variant="title">Cheque register</Txt>
      <Row style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <Button title="List" small variant={tab === 'list' ? 'primary' : 'muted'} onPress={() => setTab('list')} />
        {canWrite ? <Button title="Add" small variant={tab === 'create' ? 'primary' : 'muted'} onPress={() => setTab('create')} /> : null}
      </Row>

      {tab === 'create' && canWrite ? (
        <Card>
          <SectionHeader title="Register cheque" />
          <Row style={{ gap: 6, marginBottom: 8 }}>
            <Button title="Received" small variant={direction === 'received' ? 'primary' : 'muted'} onPress={() => setDirection('received')} />
            <Button title="Issued" small variant={direction === 'issued' ? 'primary' : 'muted'} onPress={() => setDirection('issued')} />
          </Row>
          <TextInput style={inputStyle} value={chequeNo} onChangeText={setChequeNo} placeholder="Cheque number" />
          <TextInput style={inputStyle} value={bank} onChangeText={setBank} placeholder="Bank" />
          <TextInput style={inputStyle} value={party} onChangeText={setParty} placeholder="Drawer / payee" />
          <TextInput style={inputStyle} value={amount} onChangeText={setAmount} placeholder="Amount" keyboardType="decimal-pad" />
          <TextInput style={inputStyle} value={chequeDate} onChangeText={setChequeDate} placeholder="YYYY-MM-DD on cheque" />
          <TextInput style={inputStyle} value={purpose} onChangeText={setPurpose} placeholder="Purpose" />
          <Button title="Save cheque" loading={busy} disabled={busy} onPress={save} />
        </Card>
      ) : null}

      {tab === 'list' ? (
        <>
          <TextInput style={inputStyle} value={note} onChangeText={setNote} placeholder="Optional note for status change" />
          {!rows.length ? <EmptyState message={t('common.none')} icon="card-outline" /> : null}
          {rows.map((r) => (
            <Card key={r.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="strong">{r.cheque_no}</Txt>
                <StatusBadge status={r.status} />
              </Row>
              <Txt variant="muted">
                {[r.direction, r.bank_name, r.party_name, formatDate(r.cheque_date)].filter(Boolean).join(' · ')}
              </Txt>
              <Txt>{Number(r.amount || 0).toFixed(2)} {r.currency || 'LKR'}</Txt>
              {r.purpose ? <Txt variant="small">{r.purpose}</Txt> : null}
              {canWrite ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {r.status === 'pending' ? (
                    <Button title={r.direction === 'received' ? 'Deposit' : 'Presented'} small disabled={busy} onPress={() => setStatus(r.id, 'deposited')} />
                  ) : null}
                  {['pending', 'deposited'].includes(r.status) ? (
                    <>
                      <Button title="Cleared" small disabled={busy} onPress={() => setStatus(r.id, 'cleared')} />
                      <Button title="Bounced" small variant="danger" disabled={busy} onPress={() => setStatus(r.id, 'bounced')} />
                    </>
                  ) : null}
                  {r.status === 'bounced' ? (
                    <Button title="Re-present" small variant="muted" disabled={busy} onPress={() => setStatus(r.id, 'deposited')} />
                  ) : null}
                </View>
              ) : null}
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
