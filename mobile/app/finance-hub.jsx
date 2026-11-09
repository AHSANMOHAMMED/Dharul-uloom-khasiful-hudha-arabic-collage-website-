import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, Text, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { Button, Card, EmptyState, ErrorBanner, Loading, Screen, SectionHeader } from '../components';

const WEB = process.env.EXPO_PUBLIC_WEB_URL || 'https://dharul-uloom-kashiful-hudha.vercel.app';

export default function FinanceHubMobile() {
  const { profile, caps } = useAuth();
  const [docs, setDocs] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [partyName, setPartyName] = useState('');
  const [amount, setAmount] = useState('');
  const [docType, setDocType] = useState('donation');

  const canFinance = caps?.isFinanceViewer || caps?.isAdmin || profile?.role === 'super_admin';

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [{ data: d, error: e1 }, { data: j, error: e2 }] = await Promise.all([
        supabase.from('finance_documents').select('*').order('created_at', { ascending: false }).limit(30),
        supabase.from('billing_jobs').select('*').order('created_at', { ascending: false }).limit(15),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setDocs(d || []);
      setJobs(j || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (canFinance) load();
  }, [canFinance, load]);

  if (!profile) return <Loading />;
  if (!canFinance) return <Redirect href="/" />;

  const createQuick = async () => {
    setBusy(true);
    setError('');
    try {
      const { data, error: err } = await supabase.rpc('create_finance_document', {
        p_doc_type: docType,
        p_party_type: 'donor',
        p_party_id: null,
        p_party_name: partyName.trim(),
        p_party_phone: null,
        p_notes: 'Created from mobile',
        p_letterhead_id: null,
        p_lines: [{ line_type: docType === 'sadaqah' ? 'sadaqah' : 'donation', description: docType, qty: 1, unit_amount: Number(amount) || 0 }],
      });
      if (err) throw err;
      if (data?.id) await supabase.rpc('issue_finance_document', { p_id: data.id });
      setPartyName('');
      setAmount('');
      await load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.primaryDark }}>Finance Hub</Text>
        {error ? <ErrorBanner message={error} /> : null}

        <Card>
          <SectionHeader title="Quick donation / sadaqah" />
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <Button title="Donation" variant={docType === 'donation' ? undefined : 'muted'} onPress={() => setDocType('donation')} />
            <Button title="Sadaqah" variant={docType === 'sadaqah' ? undefined : 'muted'} onPress={() => setDocType('sadaqah')} />
          </View>
          <TextInput value={partyName} onChangeText={setPartyName} placeholder="Donor name" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginBottom: 8 }} />
          <TextInput value={amount} onChangeText={setAmount} placeholder="Amount" keyboardType="decimal-pad" style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginBottom: 8 }} />
          <Button title="Create & issue" disabled={busy || !partyName.trim()} onPress={createQuick} />
        </Card>

        <Card>
          <SectionHeader title="Billing jobs" />
          <Button
            title="Run monthly fees"
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                const month = new Date().toISOString().slice(0, 7);
                const { error: err } = await supabase.rpc('create_billing_job', {
                  p_kind: 'monthly_fees', p_month: month, p_default_tuition: null,
                });
                if (err) throw err;
                await load();
              } catch (e) {
                setError(e.message || String(e));
              } finally {
                setBusy(false);
              }
            }}
          />
          {!jobs.length ? <EmptyState title="No jobs" /> : jobs.map((j) => (
            <View key={j.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontWeight: '700' }}>{j.kind} · {j.status}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{j.period_month || '—'}</Text>
            </View>
          ))}
        </Card>

        <Card>
          <SectionHeader title="Recent documents" />
          {!docs.length ? <EmptyState title="No documents" /> : docs.map((d) => (
            <View key={d.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontWeight: '700' }}>{d.doc_type} · {d.party_name || '—'}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{d.status} · {Number(d.total || 0).toFixed(2)}</Text>
              {d.public_token && d.status !== 'draft' ? (
                <Button
                  title="Share link"
                  variant="muted"
                  onPress={() => {
                    const path = d.doc_type === 'quotation' ? `/q/${d.public_token}` : `/b/${d.public_token}`;
                    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`${WEB}${path}`)}`);
                  }}
                />
              ) : null}
            </View>
          ))}
        </Card>

        <Button title="Full A4 quotations on web" variant="muted" onPress={() => Linking.openURL(`${WEB}/erp?module=financehub`)} />
      </ScrollView>
    </Screen>
  );
}
