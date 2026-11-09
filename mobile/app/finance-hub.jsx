import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { Button, Card, EmptyState, ErrorBanner, Loading, Screen, SectionHeader } from '../components';

const WEB = process.env.EXPO_PUBLIC_WEB_URL || 'https://dharul-uloom-kashiful-hudha.vercel.app';

const DOC_TYPES = [
  { id: 'donation', label: 'Donation', line: 'donation' },
  { id: 'sadaqah', label: 'Sadaqah', line: 'sadaqah' },
  { id: 'quotation', label: 'Quotation', line: 'item' },
  { id: 'bill', label: 'Bill', line: 'item' },
  { id: 'sale', label: 'Sale / item', line: 'item' },
  { id: 'fee_invoice', label: 'Fee invoice', line: 'tuition' },
];

function publicPath(doc) {
  if (!doc?.public_token) return null;
  if (doc.doc_type === 'quotation') return `/q/${doc.public_token}`;
  if (doc.doc_type === 'receipt') return `/r/${doc.public_token}`;
  return `/b/${doc.public_token}`;
}

export default function FinanceHubMobile() {
  const { profile, caps } = useAuth();
  const [tab, setTab] = useState('create');
  const [docs, setDocs] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [qty, setQty] = useState('1');
  const [docType, setDocType] = useState('donation');
  const [reason, setReason] = useState('');

  const canFinance = caps?.isFinanceViewer || caps?.isAdmin || profile?.role === 'super_admin';
  const canWrite = caps?.isFinanceStaff || caps?.isAdmin || profile?.role === 'super_admin' || caps?.isAccountant;

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [{ data: d, error: e1 }, { data: j, error: e2 }] = await Promise.all([
        supabase.from('finance_documents').select('*').order('created_at', { ascending: false }).limit(40),
        supabase.from('billing_jobs').select('*').order('created_at', { ascending: false }).limit(20),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setDocs(d || []);
      setJobs(j || []);
      if (selected?.id) {
        const next = (d || []).find((x) => x.id === selected.id);
        if (next) setSelected(next);
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [selected?.id]);

  useEffect(() => {
    if (canFinance) load();
  }, [canFinance, load]);

  if (!profile) return <Loading />;
  if (!canFinance) return <Redirect href="/" />;

  const typeMeta = DOC_TYPES.find((d) => d.id === docType) || DOC_TYPES[0];

  const createDoc = async (issueAfter = false) => {
    if (!partyName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: err } = await supabase.rpc('create_finance_document', {
        p_doc_type: docType,
        p_party_type: docType === 'fee_invoice' ? 'student' : docType.includes('donat') || docType === 'sadaqah' ? 'donor' : 'external',
        p_party_id: null,
        p_party_name: partyName.trim(),
        p_party_phone: partyPhone.trim() || null,
        p_notes: 'Created from mobile Finance Hub',
        p_letterhead_id: null,
        p_lines: [{
          line_type: typeMeta.line,
          description: description.trim() || typeMeta.label,
          qty: Number(qty) || 1,
          unit_amount: Number(amount) || 0,
        }],
      });
      if (err) throw err;
      if (issueAfter && data?.id) {
        const { error: iss } = await supabase.rpc('issue_finance_document', { p_id: data.id });
        if (iss) throw iss;
      }
      setPartyName('');
      setPartyPhone('');
      setDescription('');
      setAmount('');
      setQty('1');
      await load();
      setTab('docs');
      if (data) setSelected(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const runJob = async (kind) => {
    setBusy(true);
    setError('');
    try {
      const month = new Date().toISOString().slice(0, 7);
      const { error: err } = await supabase.rpc('create_billing_job', {
        p_kind: kind,
        p_month: kind === 'monthly_fees' ? month : null,
        p_default_tuition: null,
      });
      if (err) throw err;
      await load();
      setTab('jobs');
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const shareDoc = async (doc, channel) => {
    const path = publicPath(doc);
    if (!path) return;
    const url = `${WEB}${path}`;
    const msg = `Kashiful Hudha ${doc.doc_type} ${doc.doc_number || ''} — ${url}`;
    if (channel === 'whatsapp') {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
      return;
    }
    if (channel === 'sms' && doc.party_phone) {
      Linking.openURL(`sms:${doc.party_phone}?body=${encodeURIComponent(msg)}`);
      return;
    }
    try {
      await Share.share({ message: msg, url });
    } catch (e) {
      Alert.alert('Share', e?.message || url);
    }
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.primaryDark }}>Finance Hub</Text>
        <Text style={{ color: colors.muted }}>
          Billing jobs, bills, donations, sadaqah, quotations — create, issue, amend, void and share from the phone.
        </Text>
        {error ? <ErrorBanner message={error} /> : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[
            ['create', 'Create'],
            ['docs', 'Documents'],
            ['jobs', 'Jobs'],
          ].map(([id, label]) => (
            <Button key={id} title={label} variant={tab === id ? undefined : 'muted'} onPress={() => setTab(id)} />
          ))}
          <Button title="Refresh" variant="muted" disabled={busy} onPress={load} />
        </View>

        {tab === 'create' && (
          <Card>
            <SectionHeader title="New document" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {DOC_TYPES.map((d) => (
                <Button key={d.id} title={d.label} small variant={docType === d.id ? undefined : 'muted'} onPress={() => setDocType(d.id)} />
              ))}
            </View>
            <TextInput style={inputStyle} value={partyName} onChangeText={setPartyName} placeholder="Party / donor / student name" />
            <TextInput style={inputStyle} value={partyPhone} onChangeText={setPartyPhone} placeholder="Phone (WhatsApp / SMS)" keyboardType="phone-pad" />
            <TextInput style={inputStyle} value={description} onChangeText={setDescription} placeholder="Line description (food, fee, item…)" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput style={[inputStyle, { flex: 1 }]} value={qty} onChangeText={setQty} placeholder="Qty" keyboardType="decimal-pad" />
              <TextInput style={[inputStyle, { flex: 2 }]} value={amount} onChangeText={setAmount} placeholder="Unit amount" keyboardType="decimal-pad" />
            </View>
            {canWrite ? (
              <View style={{ gap: 8 }}>
                <Button title="Save draft" disabled={busy || !partyName.trim()} onPress={() => createDoc(false)} />
                <Button title="Save & issue" disabled={busy || !partyName.trim()} onPress={() => createDoc(true)} />
              </View>
            ) : (
              <Text style={{ color: colors.muted }}>View-only for your role. Finance staff can create documents.</Text>
            )}
          </Card>
        )}

        {tab === 'jobs' && (
          <Card>
            <SectionHeader title="Billing jobs" />
            {canWrite ? (
              <View style={{ gap: 8, marginBottom: 12 }}>
                <Button title="Run monthly fee job" disabled={busy} onPress={() => runJob('monthly_fees')} />
                <Button title="Log donation drive" variant="muted" disabled={busy} onPress={() => runJob('donation_drive')} />
                <Button title="Log quotation batch" variant="muted" disabled={busy} onPress={() => runJob('quotation_batch')} />
              </View>
            ) : null}
            {!jobs.length ? <EmptyState message="No jobs yet" /> : jobs.map((j) => (
              <View key={j.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontWeight: '700' }}>{j.kind} · {j.status}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {j.period_month || '—'} · {new Date(j.created_at).toLocaleString()}
                </Text>
                {j.error ? <Text style={{ color: '#b91c1c', fontSize: 12 }}>{j.error}</Text> : null}
              </View>
            ))}
          </Card>
        )}

        {tab === 'docs' && (
          <>
            <Card>
              <SectionHeader title="Documents" />
              {!docs.length ? <EmptyState message="No documents" /> : docs.map((d) => (
                <View key={d.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ fontWeight: '700' }} onPress={() => setSelected(d)}>
                    {d.doc_type} · {d.party_name || '—'}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {d.status} · {Number(d.total || 0).toFixed(2)} {d.currency || 'LKR'} · {d.doc_number || d.id.slice(0, 8)}
                  </Text>
                  <Button title={selected?.id === d.id ? 'Selected' : 'Open'} small variant="muted" onPress={() => setSelected(d)} />
                </View>
              ))}
            </Card>

            {selected ? (
              <Card>
                <SectionHeader title={`${selected.doc_type} actions`} />
                <Text style={{ fontWeight: '700', marginBottom: 4 }}>{selected.party_name}</Text>
                <Text style={{ color: colors.muted, marginBottom: 8 }}>
                  {selected.doc_number || selected.id} · {selected.status} · {Number(selected.total || 0).toFixed(2)}
                </Text>
                <TextInput
                  style={inputStyle}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Reason (required for amend / void)"
                />
                <View style={{ gap: 8 }}>
                  {selected.status === 'draft' && canWrite ? (
                    <Button
                      title="Issue"
                      disabled={busy}
                      onPress={async () => {
                        setBusy(true);
                        try {
                          const { data, error: err } = await supabase.rpc('issue_finance_document', { p_id: selected.id });
                          if (err) throw err;
                          setSelected(data);
                          await load();
                        } catch (e) {
                          setError(e.message || String(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  ) : null}
                  {selected.doc_type === 'quotation' && selected.status !== 'void' && canWrite ? (
                    <Button
                      title="Convert to bill"
                      variant="muted"
                      disabled={busy}
                      onPress={async () => {
                        setBusy(true);
                        try {
                          const { data, error: err } = await supabase.rpc('convert_quotation_to_bill', { p_id: selected.id });
                          if (err) throw err;
                          setSelected(data);
                          await load();
                        } catch (e) {
                          setError(e.message || String(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  ) : null}
                  {selected.status !== 'draft' ? (
                    <>
                      <Button title="WhatsApp share" onPress={() => shareDoc(selected, 'whatsapp')} />
                      <Button title="SMS share" variant="muted" onPress={() => shareDoc(selected, 'sms')} />
                      <Button title="Copy / share link" variant="muted" onPress={() => shareDoc(selected, 'share')} />
                      <Button title="Open public page" variant="muted" onPress={() => Linking.openURL(`${WEB}${publicPath(selected)}`)} />
                    </>
                  ) : null}
                  {selected.status !== 'void' && canWrite ? (
                    <>
                      <Button
                        title="Amend with reason"
                        variant="muted"
                        disabled={busy || !reason.trim()}
                        onPress={async () => {
                          setBusy(true);
                          try {
                            const { data, error: err } = await supabase.rpc('amend_finance_document', {
                              p_id: selected.id,
                              p_party_name: selected.party_name,
                              p_notes: selected.notes,
                              p_lines: null,
                              p_reason: reason.trim(),
                            });
                            if (err) throw err;
                            setSelected(data);
                            setReason('');
                            await load();
                          } catch (e) {
                            setError(e.message || String(e));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      />
                      <Button
                        title="Void with reason"
                        variant="muted"
                        disabled={busy || !reason.trim()}
                        onPress={async () => {
                          setBusy(true);
                          try {
                            const { data, error: err } = await supabase.rpc('void_finance_document', {
                              p_id: selected.id,
                              p_reason: reason.trim(),
                            });
                            if (err) throw err;
                            setSelected(data);
                            setReason('');
                            await load();
                          } catch (e) {
                            setError(e.message || String(e));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      />
                    </>
                  ) : null}
                  {profile?.role === 'super_admin' && selected.status === 'void' ? (
                    <Button
                      title="Hard delete (super admin)"
                      variant="muted"
                      disabled={busy}
                      onPress={async () => {
                        setBusy(true);
                        try {
                          const { error: err } = await supabase.rpc('hard_delete_finance_document', { p_id: selected.id });
                          if (err) throw err;
                          setSelected(null);
                          await load();
                        } catch (e) {
                          setError(e.message || String(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  ) : null}
                </View>
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
