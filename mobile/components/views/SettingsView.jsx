import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { accountLabelKey, staffRoles } from '../../lib/roles';
import { WEB_URL } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import { Screen, Card, Txt, Button, Chips, KeyValue, SectionHeader, ListItem } from '..';

export default function SettingsView({ links = [] }) {
  const { t, lang, setLang } = useI18n();
  const { profile, user, signOut } = useAuth();
  const roles = [
    ...(profile?.role === 'admin' || profile?.role === 'super_admin' ? [profile.role] : []),
    ...staffRoles(profile),
  ];

  const onSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <Screen>
      {links.length ? (
        <>
          <SectionHeader title={t('common.more')} />
          {links.map((l) => (
            <ListItem key={l.href} icon={l.icon} title={l.label} onPress={() => router.push(l.href)} />
          ))}
        </>
      ) : null}

      <SectionHeader title={t('settings.myInfo')} />
      <Card accent={colors.primary}>
        <Txt variant="h2">{profile?.full_name || user?.email}</Txt>
        <KeyValue label={t('settings.email')} value={profile?.email || user?.email || '—'} />
        {profile?.phone ? <KeyValue label={t('settings.phone')} value={profile.phone} /> : null}
        <KeyValue label={t('settings.accountType')} value={t(accountLabelKey(profile))} />
        {profile?.index_number ? <KeyValue label={t('common.index')} value={profile.index_number} /> : null}
        {profile?.class_number ? <KeyValue label={t('common.class')} value={String(profile.class_number)} /> : null}
        {roles.length ? <KeyValue label={t('settings.roles')} value={roles.map((r) => t(`role.${r}`)).join(', ')} /> : null}
      </Card>

      <SectionHeader title={t('lang.label')} />
      <Card>
        <Chips
          options={[
            { value: 'en', label: 'English' },
            { value: 'ar', label: 'العربية' },
            { value: 'ta', label: 'தமிழ்' },
          ]}
          value={lang}
          onChange={setLang}
        />
      </Card>

      <Button title={t('common.openWeb')} variant="outline" icon="globe-outline" onPress={() => WebBrowser.openBrowserAsync(WEB_URL)} />
      <Button title={t('auth.signOut')} variant="muted" icon="log-out-outline" onPress={onSignOut} />
      <Txt variant="small" center>{t('settings.version', { v: Constants.expoConfig?.version || '1.0.0' })}</Txt>
    </Screen>
  );
}
