import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { homeRouteFor } from '../lib/roles';
import { isConfigured } from '../lib/supabase';
import { Loading, Screen, ErrorBanner, Button } from '../components';

// Auth gate + role router.
export default function Index() {
  const { session, profile, profileError, loading, refreshProfile, signOut } = useAuth();
  const { t } = useI18n();
  const [retrying, setRetrying] = useState(false);
  if (!isConfigured) return <Redirect href="/login" />;
  if (loading) return <Loading />;
  if (!session) return <Redirect href="/login" />;
  if (!profile) {
    // Signed in but the profile row could not be read (network / RLS).
    return (
      <Screen>
        <ErrorBanner message={profileError || t('common.error')} />
        <Button
          title={t('common.retry')}
          loading={retrying}
          onPress={async () => {
            setRetrying(true);
            await refreshProfile();
            setRetrying(false);
          }}
        />
        <Button title={t('auth.signOut')} variant="muted" onPress={async () => { await signOut(); router.replace('/login'); }} />
      </Screen>
    );
  }
  return <Redirect href={homeRouteFor(profile)} />;
}
