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
  'student_portal', 'parent_portal', 'staff_portal', 'mobile_app',
];

const SECTIONS = [
  { id: 'home', label: 'Overview' },
  { id: 'features', label: 'Features' },
  { id: 'users', label: 'Users' },
  { id: 'communities', label: 'Communities' },
  { id: 'finance', label: 'Finance' },
  { id: 'audit', label: 'Audit' },
];

export default function PlatformScreen() {
  const { profile, signOut } = useAuth();
  const { t } = useI18n();
  const [section, setSection] = useState('home');
  const [controls, setControls] = useState(null);
  const [users, setUsers] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [audit, setAudit] = useState([]);
  const [orgId, setOrgId] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

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
      } catch (e) {
        if (live) setError(e.message || String(e));
      }
    })();
    return () => { live = false; };
  }, [section, search, orgId, profile]);

  if (!profile) return <Loading />;
  if (profile.role !== 'super_admin') return <Redirect href="/" />;

  const effective = (key) => {
    const g = controls?.global?.[key];
    if (typeof g === 'boolean') return g;
    return controls?.defaults?.[key] !== false;
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
          Control plane on mobile — features, users, communities, finance jobs, audit & messaging.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {SECTIONS.map((s) => (
            <Button
              key={s.id}
              title={s.label}
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
                variant={orgId === o.org_id ? undefined : 'muted'}
                onPress={() => setOrgId(o.org_id)}
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
              <Button title="Web Finance Hub" variant="muted" onPress={() => Linking.openURL(`${WEB}/erp?module=financehub`)} />
              <View style={{ height: 8 }} />
              <Button title="Messages" variant="muted" onPress={() => router.push('/messages')} />
            </Card>
            <Card>
              <SectionHeader title={`Institutions (${controls?.organizations?.length || 0})`} />
              {(controls?.organizations || []).length === 0 ? (
                <EmptyState title="No organizations" />
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

        {section === 'users' && (
          <Card>
            <SectionHeader title="Users & invite" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search users"
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginBottom: 8 }}
            />
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="Invite email"
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginBottom: 8 }}
            />
            <Button title="Invite staff" disabled={busy} onPress={inviteUser} />
            <View style={{ height: 12 }} />
            {users.map((u) => (
              <View key={u.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontWeight: '700' }}>{u.full_name || u.email}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {u.account_type} · {u.role} · {u.is_approved ? 'approved' : 'pending'}
                </Text>
                <Button
                  title={u.is_approved ? 'Revoke' : 'Approve'}
                  variant="muted"
                  onPress={async () => {
                    await supabase.rpc('platform_set_user_approved', { p_profile: u.id, p_approve: !u.is_approved });
                    const { data } = await supabase.rpc('platform_user_directory', { p_search: search || null, p_limit: 40 });
                    setUsers(data || []);
                  }}
                />
              </View>
            ))}
          </Card>
        )}

        {section === 'communities' && (
          <Card>
            <SectionHeader title="Campus communities" />
            {!communities.length ? <EmptyState title="No communities" /> : communities.map((c) => (
              <View key={c.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontWeight: '700' }}>{c.name_en}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{c.kind}</Text>
              </View>
            ))}
            <Button title="Manage on web" variant="muted" onPress={() => Linking.openURL(`${WEB}/platform?section=communities`)} />
          </Card>
        )}

        {section === 'finance' && (
          <Card>
            <SectionHeader title="Billing jobs" />
            <Button title="Run monthly fee job" disabled={busy} onPress={runMonthlyJob} />
            <View style={{ height: 8 }} />
            <Button title="Open Finance Hub (web)" variant="muted" onPress={() => Linking.openURL(`${WEB}/erp?module=financehub`)} />
            {jobs.map((j) => (
              <View key={j.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontWeight: '700' }}>{j.kind} · {j.status}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{j.period_month || '—'} · {new Date(j.created_at).toLocaleString()}</Text>
              </View>
            ))}
          </Card>
        )}

        {section === 'audit' && (
          <Card>
            <SectionHeader title="Audit feed" />
            {!audit.length ? <EmptyState title="No audit rows" /> : audit.map((row) => (
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
