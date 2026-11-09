import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, Switch, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { colors } from '../lib/theme';
import { Button, Card, EmptyState, ErrorBanner, Loading, Screen, SectionHeader } from '../components';

const WEB = process.env.EXPO_PUBLIC_WEB_URL || 'https://kashifulhudha.lk';

const KEY_FEATURES = [
  'erp',
  'erp_fees',
  'erp_accounting',
  'erp_crm',
  'payments',
  'library',
  'registrations',
  'mobile_app',
  'messaging',
  'student_portal',
  'parent_portal',
  'staff_portal',
];

export default function PlatformScreen() {
  const { profile, signOut } = useAuth();
  const { t } = useI18n();
  const [controls, setControls] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const { data, error: err } = await supabase.rpc('get_platform_controls');
      if (err) throw err;
      setControls(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
        p_key: key,
        p_enabled: enabled,
        p_note: 'mobile toggle',
      });
      if (err) throw err;
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
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.primaryDark }}>
          {t('role.super_admin')}
        </Text>
        <Text style={{ color: colors.muted, marginBottom: 8 }}>
          Full platform controls. Use the web console for tenants, per-college overrides and user directory.
        </Text>
        {error ? <ErrorBanner message={error} /> : null}
        <Card>
          <SectionHeader title="Open full console" />
          <Button title="Open web Super Admin" onPress={() => Linking.openURL(`${WEB}/platform`)} />
          <View style={{ height: 8 }} />
          <Button title="Open web ERP" variant="muted" onPress={() => Linking.openURL(`${WEB}/erp`)} />
        </Card>
        <Card>
          <SectionHeader title="Global feature switches" />
          {!controls ? (
            <Loading />
          ) : (
            KEY_FEATURES.map((key) => (
              <View
                key={key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ flex: 1, color: colors.text, fontWeight: '600' }}>{key}</Text>
                <Switch
                  disabled={busy}
                  value={effective(key)}
                  onValueChange={(v) => toggle(key, v)}
                />
              </View>
            ))
          )}
        </Card>
        <Card>
          <SectionHeader title={`Institutions (${controls?.organizations?.length || 0})`} />
          {(controls?.organizations || []).length === 0 ? (
            <EmptyState title="No organizations" />
          ) : (
            (controls?.organizations || []).map((o) => (
              <View key={o.org_id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontWeight: '700', color: colors.primaryDark }}>{o.name_en}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {o.slug} · {o.status} · {o.plan}
                </Text>
              </View>
            ))
          )}
        </Card>
        <Button title={t('auth.signOut')} variant="muted" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}
