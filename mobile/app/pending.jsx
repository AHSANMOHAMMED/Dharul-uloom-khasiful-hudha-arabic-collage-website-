import { useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { homeRouteFor } from '../lib/roles';
import { colors } from '../lib/theme';
import { Screen, Card, Txt, Button, EmptyState } from '../components';

export default function Pending() {
  const { t } = useI18n();
  const { profile, refreshProfile, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const isGuest = !['student', 'parent', 'tutor', 'staff'].includes(profile?.account_type);

  const check = async () => {
    setChecking(true);
    const p = await refreshProfile();
    setChecking(false);
    const next = homeRouteFor(p);
    if (next !== '/pending') router.replace(next);
  };

  return (
    <Screen>
      <Card accent={colors.gold}>
        <EmptyState icon={isGuest ? 'person-outline' : 'hourglass-outline'} message="" />
        <Txt variant="title" center>{t(isGuest ? 'pending.guestTitle' : 'pending.title')}</Txt>
        <Txt variant="muted" center>{t(isGuest ? 'pending.guestBody' : 'pending.body')}</Txt>
        {profile?.email ? <Txt variant="small" center>{profile.email}</Txt> : null}
      </Card>
      <Button title={t('pending.check')} icon="refresh-outline" loading={checking} onPress={check} />
      <Button title={t('auth.signOut')} variant="muted" onPress={async () => { await signOut(); router.replace('/login'); }} />
    </Screen>
  );
}
