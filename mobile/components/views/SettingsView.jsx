import { useEffect, useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { accountLabelKey, staffRoles } from '../../lib/roles';
import { WEB_URL } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import { useAppLock, biometricSupport } from '../../lib/appLock';
import { Screen, Card, Txt, Button, Chips, KeyValue, SectionHeader, ListItem, PromptModal } from '..';

export default function SettingsView({ links = [] }) {
  const { t, lang, setLang } = useI18n();
  const { profile, user, signOut, aal } = useAuth();
  const lock = useAppLock();
  const [bio, setBio] = useState({ available: false, enrolled: false });
  const [pinPrompt, setPinPrompt] = useState(false);
  useEffect(() => {
    biometricSupport().then(setBio).catch(() => {});
  }, []);
  const bioUsable = bio.available && bio.enrolled;

  const toggleLock = async (on) => {
    if (!on) {
      await lock.disableLock();
      return;
    }
    if (bioUsable) {
      // Confirm the person holding the phone can pass the check before relying on it.
      const ok = await lock.unlockWithBiometrics(t('lock.prompt'));
      if (!ok) return;
      await lock.enableLock();
      Alert.alert(t('lock.title'), t('lock.addPinToo'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('lock.setPin'), onPress: () => setPinPrompt(true) },
      ]);
    } else {
      setPinPrompt(true);
    }
  };
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

      <SectionHeader title={t('security.title')} />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Txt style={{ fontWeight: '700' }}>{t('lock.setting')}</Txt>
            <Txt variant="small">{bioUsable ? t('lock.settingHelpBio') : t('lock.settingHelpPin')}</Txt>
          </View>
          <Switch
            value={lock.enabled}
            onValueChange={toggleLock}
            trackColor={{ true: colors.primary }}
            accessibilityLabel={t('lock.setting')}
          />
        </View>
        {lock.enabled ? (
          <Button small variant="outline" title={lock.hasPin ? t('lock.changePin') : t('lock.setPin')} onPress={() => setPinPrompt(true)} />
        ) : null}
        <KeyValue label={t('mfa.title')} value={aal?.nextLevel === 'aal2' ? t('mfa.on') : t('mfa.off')} />
        <Button
          small
          variant="ghost"
          icon="shield-checkmark-outline"
          title={t('mfa.manageOnWeb')}
          onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/account/security`)}
        />
      </Card>
      <PromptModal
        visible={pinPrompt}
        title={t('lock.setPin')}
        message={t('lock.pinHelp')}
        label={t('lock.pin')}
        keyboardType="number-pad"
        multiline={false}
        secure
        maxLength={6}
        required
        confirmLabel={t('common.save')}
        onSubmit={async (v) => {
          if (!/^\d{6}$/.test(v)) throw new Error(t('lock.pinHelp'));
          await lock.setPin(v);
          if (!lock.enabled) await lock.enableLock();
        }}
        onClose={() => setPinPrompt(false)}
      />

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
