import { useState } from 'react';
import { Alert, TextInput } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { formatDate } from '../lib/format';
import { colors } from '../lib/theme';
import { Screen, Card, Txt, EmptyState, StatusBadge, Row, Button, SectionHeader } from '../components';

const FUNDS = ['general', 'zakat', 'sadaqah', 'waqf', 'sponsorship', 'building'];
const METHODS = ['cash', 'bank_transfer', 'cheque', 'online', 'other'];

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 10,
  padding: 10,
  marginBottom: 8,
  backgroundColor: '#fff',
};

export default function DonationsScreen() {
  const { t } = useI18n();
  const { profile, caps } = useAuth();
  const canView = caps?.isFinanceViewer || profile?.role === 'super_admin';
  const canWrite = caps?.isFinanceStaff || profile?.role === 'super_admin';
  const [tab, setTab] = useState('list');
  const [busy, setBusy] = useState(false);
  const [donor, setDonor] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [fund, setFund] = useState('general');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const q = useAsync(
    () =>
      must(
        supabase
          .from('donations')
          .select('id, receipt_no, donation_date, donor_name, fund_type, amount, currency, method, status, created_at')
          .order('created_at', { ascending: false })
          .limit(60),
      ),
    [],
  );

  if (!profile) return null;
  if (!canView) return <Redirect href="/" />;

  const save = async () => {
    const amt = Number(amount);
    if (!(amt > 0) || (!donor.trim() && fund !== 'zakat')) {
      Alert.alert('Donation', 'Enter amount and donor name.');
      return;
    }
    setBusy(true);
    try {
      await must(
        supabase.rpc('record_donation', {
          p_amount: Math.round(amt * 100) / 100,
          p_fund_type: fund,
          p_method: method,
          p_donor_name: donor.trim() || null,
          p_donor_phone: phone.trim() || null,
          p_donor_email: null,
          p_is_anonymous: !donor.trim(),
          p_reference: reference.trim() || null,
          p_notes: notes.trim() || null,
          p_sponsored_student: null,
          p_date: new Date().toISOString().slice(0, 10),
        }),
      );
      setDonor('');
      setPhone('');
      setAmount('');
      setReference('');
      setNotes('');
      setTab('list');
      q.reload?.() || q.refresh?.();
    } catch (e) {
      Alert.alert(t('common.error') || 'Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const rows = q.data || [];

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Txt variant="title">Donations</Txt>
      <Row style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <Button title="List" small variant={tab === 'list' ? 'primary' : 'muted'} onPress={() => setTab('list')} />
        {canWrite ? <Button title="Record" small variant={tab === 'create' ? 'primary' : 'muted'} onPress={() => setTab('create')} /> : null}
      </Row>

      {tab === 'create' && canWrite ? (
        <Card>
          <SectionHeader title="Record donation" />
          <TextInput style={inputStyle} value={donor} onChangeText={setDonor} placeholder="Donor name" />
          <TextInput style={inputStyle} value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />
          <TextInput style={inputStyle} value={amount} onChangeText={setAmount} placeholder="Amount" keyboardType="decimal-pad" />
          <Txt variant="small" style={{ marginBottom: 4 }}>Fund</Txt>
          <Row style={{ flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {FUNDS.map((f) => (
              <Button key={f} title={f} small variant={fund === f ? 'primary' : 'muted'} onPress={() => setFund(f)} />
            ))}
          </Row>
          <Txt variant="small" style={{ marginBottom: 4 }}>Method</Txt>
          <Row style={{ flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {METHODS.map((m) => (
              <Button key={m} title={m} small variant={method === m ? 'primary' : 'muted'} onPress={() => setMethod(m)} />
            ))}
          </Row>
          <TextInput style={inputStyle} value={reference} onChangeText={setReference} placeholder="Reference (required if not cash)" />
          <TextInput style={inputStyle} value={notes} onChangeText={setNotes} placeholder="Notes" />
          <Button title="Save donation" loading={busy} disabled={busy} onPress={save} />
        </Card>
      ) : null}

      {tab === 'list' ? (
        <>
          {!rows.length ? <EmptyState message={t('common.none')} icon="heart-outline" /> : null}
          {rows.map((r) => (
            <Card key={r.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="strong">{r.donor_name || 'Anonymous'}</Txt>
                <StatusBadge status={r.status} />
              </Row>
              <Txt variant="muted">
                {[r.receipt_no, r.fund_type, r.method, formatDate(r.donation_date)].filter(Boolean).join(' · ')}
              </Txt>
              <Txt>{Number(r.amount || 0).toFixed(2)} {r.currency || 'LKR'}</Txt>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
