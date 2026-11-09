import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { colors } from '../lib/theme';
import { Button, Card, EmptyState, ErrorBanner, Loading, Screen, SectionHeader } from '../components';

const WEB = process.env.EXPO_PUBLIC_WEB_URL || 'https://dharul-uloom-kashiful-hudha.vercel.app';

const KEY_FEATURES = [
  'erp', 'erp_fees', 'erp_accounting', 'erp_finance_hub', 'erp_quotations',
  'erp_billing_jobs', 'erp_crm', 'payments', 'messaging',
  'student_portal', 'parent_portal', 'staff_portal', 'mobile_app', 'library',
];

const ROLE_KEYS = [
  'student', 'parent', 'tutor', 'staff', 'admin', 'librarian',
  'principal', 'vice_principal', 'treasurer', 'accountant', 'hr_manager',
  'admissions_officer', 'warden', 'counselor', 'exam_officer', 'it_officer',
];

const ACL_FEATURE_KEYS = [
  'erp', 'erp_fees', 'erp_accounting', 'erp_finance_hub', 'erp_quotations',
  'erp_billing_jobs', 'payments', 'messaging', 'library', 'mobile_app',
];

const SECTIONS = [
  { id: 'home', label: 'Overview' },
  { id: 'features', label: 'Features' },
  { id: 'acl', label: 'ACL' },
  { id: 'users', label: 'Users' },
  { id: 'communities', label: 'Communities' },
  { id: 'broadcast', label: 'Broadcast' },
  { id: 'finance', label: 'Finance' },
  { id: 'health', label: 'Health' },
  { id: 'audit', label: 'Audit' },
];

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 10,
  padding: 10,
  marginBottom: 8,
  backgroundColor: '#fff',
};

export default function PlatformScreen() {
  const { profile, signOut } = useAuth();
  const { t } = useI18n();
  const [section, setSection] = useState('home');
  const [controls, setControls] = useState(null);
  const [users, setUsers] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [audit, setAudit] = useState([]);
  const [health, setHealth] = useState(null);
  const [roleFeatures, setRoleFeatures] = useState([]);
  const [aclRole, setAclRole] = useState('staff');
  const [aclUserId, setAclUserId] = useState('');
  const [userFeatures, setUserFeatures] = useState([]);
  const [orgId, setOrgId] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [commName, setCommName] = useState('');
  const [commKind, setCommKind] = useState('staff_team');
  const [bcTitle, setBcTitle] = useState('');
  const [bcMessage, setBcMessage] = useState('');
  const [bcAudience, setBcAudience] = useState('admins');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const { data, error: err } = await supabase.rpc('get_platform_controls');
      if (err) throw err;
      setControls(data);
      if (!orgId && data?.organizations?.[0]?.org_id) setOrgId(data.organizations[0].org_id);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile || profile.role !== 'super_admin') return undefined;
    let live = true;
    (async () => {
      try {
        if (section === 'users') {
          const { data, error: err } = await supabase.rpc('platform_user_directory', {
            p_search: search || null,
            p_limit: 40,
          });
          if (err) throw err;
          if (live) setUsers(data || []);
        }
        if (section === 'communities' && orgId) {
          const { data, error: err } = await supabase.rpc('platform_list_communities', { p_org: orgId });
          if (err) throw err;
          if (live) setCommunities(data || []);
        }
        if (section === 'finance') {
          const { data, error: err } = await supabase
            .from('billing_jobs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
          if (err) throw err;
          if (live) setJobs(data || []);
        }
        if (section === 'audit') {
          const { data, error: err } = await supabase.rpc('platform_audit_feed', {
            p_org: orgId || null,
            p_table: null,
            p_limit: 40,
          });
          if (err) throw err;
          if (live) setAudit(data || []);
        }
        if (section === 'health') {
          const { data, error: err } = await supabase.rpc('platform_health');
          if (err) throw err;
          if (live) setHealth(data);
        }
        if (section === 'acl') {
          const { data, error: err } = await supabase.rpc('platform_list_role_features', { p_role: aclRole });
          if (err) throw err;
          if (live) setRoleFeatures(data || []);
          if (aclUserId) {
            const { data: uf, error: e2 } = await supabase.rpc('platform_list_user_features', { p_user: aclUserId });
            if (e2) throw e2;
            if (live) setUserFeatures(uf || []);
          } else if (live) setUserFeatures([]);
        }
      } catch (e) {
        if (live) setError(e.message || String(e));
      }
    })();
    return () => { live = false; };
  }, [section, search, orgId, profile, aclRole, aclUserId]);

  if (!profile) return <Loading />;
  if (profile.role !== 'super_admin') return <Redirect href="/" />;

  const effective = (key) => {
    const g = controls?.global?.[key];
    if (typeof g === 'boolean') return g;
    return controls?.defaults?.[key] !== false;
  };

  const roleEnabled = (key) => {
    const row = roleFeatures.find((r) => r.feature_key === key || r.key === key);
    if (!row) return true;
    return row.enabled !== false;
  };

  const userOverride = (key) => {
    const row = userFeatures.find((r) => r.feature_key === key || r.key === key);
    if (!row) return null;
    return row.enabled;
  };

  const toggle = async (key, enabled) => {
    setBusy(true);
    setError('');
    try {
      const { error: err } = await supabase.rpc('set_platform_feature', {
        p_key: key, p_enabled: enabled, p_note: 'mobile toggle',
      });
      if (err) throw err;
      await load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleRoleFeature = async (key, enabled) => {
    setBusy(true);
    setError('');
    try {
      const { error: err } = await supabase.rpc('platform_set_role_feature', {
        p_role: aclRole, p_key: key, p_enabled: enabled,
      });
      if (err) throw err;
      const { data } = await supabase.rpc('platform_list_role_features', { p_role: aclRole });
      setRoleFeatures(data || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleUserFeature = async (key, enabled) => {
    if (!aclUserId) return;
    setBusy(true);
    setError('');
    try {
      const { error: err } = await supabase.rpc('platform_set_user_feature', {
        p_user: aclUserId, p_key: key, p_enabled: enabled,
      });
      if (err) throw err;
      const { data } = await supabase.rpc('platform_list_user_features', { p_user: aclUserId });
      setUserFeatures(data || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const clearUserFeature = async (key) => {
    if (!aclUserId) return;
    setBusy(true);
    try {
      await supabase.rpc('platform_clear_user_feature', { p_user: aclUserId, p_key: key });
      const { data } = await supabase.rpc('platform_list_user_features', { p_user: aclUserId });
      setUserFeatures(data || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const inviteUser = async () => {
    if (!inviteEmail.trim() || !orgId) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: err } = await supabase.rpc('platform_invite_user', {
        p_org: orgId,
        p_email: inviteEmail.trim(),
        p_full_name: null,
        p_account_type: 'staff',
        p_role: 'user',
        p_assigned_tutor_role: 'none',
        p_extra_roles: [],
        p_approve: true,
      });
      if (err) throw err;
      setInviteEmail('');
      setError(`Invite OK · token ${data?.token?.slice?.(0, 8) || ''}…`);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const createCommunity = async () => {
    if (!commName.trim() || !orgId) return;
    setBusy(true);
    setError('');
    try {
      const { error: err } = await supabase.from('communities').insert({
        org_id: orgId,
        kind: commKind,
        name_en: commName.trim(),
        is_active: true,
      });
      if (err) throw err;
      setCommName('');
      const { data } = await supabase.rpc('platform_list_communities', { p_org: orgId });
      setCommunities(data || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleCommunity = async (c) => {
    setBusy(true);
    try {
      await supabase.from('communities').update({ is_active: !c.is_active }).eq('id', c.id);
      const { data } = await supabase.rpc('platform_list_communities', { p_org: orgId });
      setCommunities(data || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const sendBroadcast = async () => {
    if (!bcTitle.trim() || !bcMessage.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: err } = await supabase.rpc('platform_broadcast', {
        p_title: bcTitle.trim(),
        p_message: bcMessage.trim(),
        p_audience: bcAudience,
        p_orgs: orgId ? [orgId] : null,
      });
      if (err) throw err;
      setBcTitle('');
      setBcMessage('');
      setError(`Broadcast sent to ${data ?? 0} people.`);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const runMonthlyJob = async () => {
    setBusy(true);
    setError('');
    try {
      if (orgId) await supabase.rpc('set_acting_org', { p_org: orgId });
      const month = new Date().toISOString().slice(0, 7);
      const { error: err } = await supabase.rpc('create_billing_job', {
        p_kind: 'monthly_fees',
        p_month: month,
        p_default_tuition: null,
      });
      if (err) throw err;
      const { data } = await supabase.from('billing_jobs').select('*').order('created_at', { ascending: false }).limit(20);
      setJobs(data || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.primaryDark }}>
          {t('role.super_admin')}
        </Text>
        <Text style={{ color: colors.muted }}>
          Control plane — features, ACL, users, communities, broadcast, finance jobs, health & audit.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {SECTIONS.map((s) => (
            <Button
              key={s.id}
              title={s.label}
              small
              variant={section === s.id ? undefined : 'muted'}
              onPress={() => setSection(s.id)}
            />
          ))}
        </ScrollView>

        {error ? <ErrorBanner message={error} /> : null}

        {(controls?.organizations || []).length > 0 && (
          <Card>
            <SectionHeader title="Acting college" />
            {(controls?.organizations || []).map((o) => (
              <Button
                key={o.org_id}
                title={`${o.name_en}${orgId === o.org_id ? ' ✓' : ''}`}
                small
                variant={orgId === o.org_id ? undefined : 'muted'}
                onPress={async () => {
                  setOrgId(o.org_id);
                  try { await supabase.rpc('set_acting_org', { p_org: o.org_id }); } catch { /* ignore */ }
                }}
              />
            ))}
          </Card>
        )}

        {section === 'home' && (
          <>
            <Card>
              <SectionHeader title="Open full tools" />
              <Button title="Web Super Admin" onPress={() => Linking.openURL(`${WEB}/platform`)} />
              <View style={{ height: 8 }} />
              <Button title="Finance Hub (app)" variant="muted" onPress={() => router.push('/finance-hub')} />
              <View style={{ height: 8 }} />
              <Button title="Messages" variant="muted" onPress={() => router.push('/messages')} />
            </Card>
            <Card>
              <SectionHeader title={`Institutions (${controls?.organizations?.length || 0})`} />
              {(controls?.organizations || []).length === 0 ? (
                <EmptyState message="No organizations" />
              ) : (
                (controls?.organizations || []).map((o) => (
                  <View key={o.org_id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Text style={{ fontWeight: '700', color: colors.primaryDark }}>{o.name_en}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{o.slug} · {o.status}</Text>
                  </View>
                ))
              )}
            </Card>
          </>
        )}

        {section === 'features' && (
          <Card>
            <SectionHeader title="Global feature switches" />
            {!controls ? <Loading /> : KEY_FEATURES.map((key) => (
              <View key={key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ flex: 1, color: colors.text, fontWeight: '600' }}>{key}</Text>
                <Switch disabled={busy} value={effective(key)} onValueChange={(v) => toggle(key, v)} />
              </View>
            ))}
          </Card>
        )}

        {section === 'acl' && (
          <>
            <Card>
              <SectionHeader title="Role feature templates" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                {ROLE_KEYS.map((r) => (
                  <Button key={r} title={r} small variant={aclRole === r ? undefined : 'muted'} onPress={() => setAclRole(r)} />
                ))}
              </ScrollView>
              {ACL_FEATURE_KEYS.map((key) => (
                <View key={key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ flex: 1, fontWeight: '600' }}>{key}</Text>
                  <Switch disabled={busy} value={roleEnabled(key)} onValueChange={(v) => toggleRoleFeature(key, v)} />
                </View>
              ))}
            </Card>
            <Card>
              <SectionHeader title="Per-user overrides" />
              <TextInput
                style={inputStyle}
                value={aclUserId}
                onChangeText={setAclUserId}
                placeholder="Paste profile UUID"
                autoCapitalize="none"
              />
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
                Tip: copy a user id from the Users tab, then toggle overrides here.
              </Text>
              {aclUserId ? ACL_FEATURE_KEYS.map((key) => {
                const ov = userOverride(key);
                return (
                  <View key={key} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Text style={{ fontWeight: '600' }}>{key}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>
                      {ov === null ? 'inherits role' : ov ? 'forced ON' : 'forced OFF'}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      <Button title="On" small variant={ov === true ? undefined : 'muted'} disabled={busy} onPress={() => toggleUserFeature(key, true)} />
                      <Button title="Off" small variant={ov === false ? undefined : 'muted'} disabled={busy} onPress={() => toggleUserFeature(key, false)} />
                      <Button title="Clear" small variant="outline" disabled={busy} onPress={() => clearUserFeature(key)} />
                    </View>
                  </View>
                );
              }) : null}
            </Card>
          </>
        )}

        {section === 'users' && (
          <Card>
            <SectionHeader title="Users & invite" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search users"
              style={inputStyle}
            />
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="Invite email"
              autoCapitalize="none"
              keyboardType="email-address"
              style={inputStyle}
            />
            <Button title="Invite staff" disabled={busy} onPress={inviteUser} />
            <View style={{ height: 12 }} />
            {users.map((u) => (
              <View key={u.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontWeight: '700' }}>{u.full_name || u.email}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {u.account_type} · {u.role} · {u.is_approved ? 'approved' : 'pending'}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }} selectable>{u.id}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <Button
                    title={u.is_approved ? 'Revoke' : 'Approve'}
                    small
                    variant="muted"
                    onPress={async () => {
                      await supabase.rpc('platform_set_user_approved', { p_profile: u.id, p_approve: !u.is_approved });
                      const { data } = await supabase.rpc('platform_user_directory', { p_search: search || null, p_limit: 40 });
                      setUsers(data || []);
                    }}
                  />
                  <Button title="ACL" small variant="outline" onPress={() => { setAclUserId(u.id); setSection('acl'); }} />
                  <Button
                    title="Deactivate"
                    small
                    variant="danger"
                    onPress={async () => {
                      await supabase.rpc('platform_deactivate_user', { p_profile: u.id, p_reason: 'mobile deactivate' });
                      const { data } = await supabase.rpc('platform_user_directory', { p_search: search || null, p_limit: 40 });
                      setUsers(data || []);
                    }}
                  />
                </View>
              </View>
            ))}
          </Card>
        )}

        {section === 'communities' && (
          <Card>
            <SectionHeader title="Campus communities" />
            <TextInput style={inputStyle} value={commName} onChangeText={setCommName} placeholder="New community name" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {['alumni', 'staff_team', 'club', 'custom'].map((k) => (
                <Button key={k} title={k} small variant={commKind === k ? undefined : 'muted'} onPress={() => setCommKind(k)} />
              ))}
            </View>
            <Button title="Create community" disabled={busy || !commName.trim()} onPress={createCommunity} />
            <View style={{ height: 12 }} />
            {!communities.length ? <EmptyState message="No communities" /> : communities.map((c) => (
              <View key={c.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontWeight: '700' }}>{c.name_en}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{c.kind} · {c.is_active === false ? 'inactive' : 'active'}</Text>
                <Button
                  title={c.is_active === false ? 'Activate' : 'Deactivate'}
                  small
                  variant="muted"
                  disabled={busy}
                  onPress={() => toggleCommunity(c)}
                />
              </View>
            ))}
          </Card>
        )}

        {section === 'broadcast' && (
          <Card>
            <SectionHeader title="Platform broadcast" />
            <Text style={{ color: colors.muted, marginBottom: 8 }}>
              Sends a notice to the selected audience (notification bell + push). Scope: acting college, or leave college unset for all.
            </Text>
            <TextInput style={inputStyle} value={bcTitle} onChangeText={setBcTitle} placeholder="Title" maxLength={200} />
            <TextInput
              style={[inputStyle, { minHeight: 90, textAlignVertical: 'top' }]}
              value={bcMessage}
              onChangeText={setBcMessage}
              placeholder="Message"
              multiline
              maxLength={4000}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {[
                ['admins', 'Admins'],
                ['staff', 'Staff'],
                ['everyone', 'Everyone'],
              ].map(([id, label]) => (
                <Button key={id} title={label} small variant={bcAudience === id ? undefined : 'muted'} onPress={() => setBcAudience(id)} />
              ))}
            </View>
            <Button title="Send notice" disabled={busy || !bcTitle.trim() || !bcMessage.trim()} onPress={sendBroadcast} />
          </Card>
        )}

        {section === 'finance' && (
          <Card>
            <SectionHeader title="Billing jobs" />
            <Button title="Run monthly fee job" disabled={busy} onPress={runMonthlyJob} />
            <View style={{ height: 8 }} />
            <Button title="Open Finance Hub (app)" variant="muted" onPress={() => router.push('/finance-hub')} />
            {jobs.map((j) => (
              <View key={j.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontWeight: '700' }}>{j.kind} · {j.status}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{j.period_month || '—'} · {new Date(j.created_at).toLocaleString()}</Text>
              </View>
            ))}
          </Card>
        )}

        {section === 'health' && (
          <Card>
            <SectionHeader title="Platform health" />
            {!health ? <Loading /> : (
              <View style={{ gap: 8 }}>
                {typeof health === 'object' ? Object.entries(health).map(([k, v]) => (
                  <View key={k} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Text style={{ fontWeight: '700' }}>{k}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</Text>
                  </View>
                )) : <Text>{String(health)}</Text>}
                <Button title="Refresh health" variant="muted" disabled={busy} onPress={() => setSection('health')} />
              </View>
            )}
          </Card>
        )}

        {section === 'audit' && (
          <Card>
            <SectionHeader title="Audit feed" />
            {!audit.length ? <EmptyState message="No audit rows" /> : audit.map((row) => (
              <View key={row.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontWeight: '700' }}>{row.table_name} · {row.action}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{new Date(row.created_at).toLocaleString()}</Text>
              </View>
            ))}
          </Card>
        )}

        <Button title={t('auth.signOut')} variant="muted" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}
