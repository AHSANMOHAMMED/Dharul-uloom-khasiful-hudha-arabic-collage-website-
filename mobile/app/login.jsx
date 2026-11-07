import { useState } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { supabase, isConfigured, WEB_URL } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { colors } from '../lib/theme';
import { Txt, Field, Button, ErrorBanner, Card } from '../components';

export default function Login() {
  const { t, toggleLang } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!isConfigured || !supabase) return Alert.alert(t('common.error'), t('common.notConfigured'));
    if (!email.trim() || !password) return Alert.alert(t('common.error'), t('common.required'));
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert(t('auth.failed'), error.message);
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.top}>
          <Pressable onPress={toggleLang} style={styles.lang} hitSlop={8}>
            <Txt style={styles.langText}>{t('lang.toggle')}</Txt>
          </Pressable>
          <View style={styles.logo}>
            <Txt style={styles.logoText}>ك</Txt>
          </View>
          <Txt style={styles.brand} center>{t('app.fullName')}</Txt>
          <Txt style={styles.tagline} center>{t('app.tagline')}</Txt>
        </View>
        <Card style={styles.card}>
          <Txt variant="title">{t('auth.welcome')}</Txt>
          {!isConfigured ? <ErrorBanner message={t('common.notConfigured')} /> : null}
          <Field label={t('auth.email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
          <Field label={t('auth.password')} secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} onSubmitEditing={onSubmit} />
          <Button title={loading ? t('auth.signingIn') : t('auth.signIn')} loading={loading} onPress={onSubmit} />
          <Button variant="ghost" title={t('auth.forgot')} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/forgot-password`)} />
          <Button variant="ghost" title={t('auth.noAccount')} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/register`)} />
        </Card>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primaryDark },
  flex: { flex: 1, justifyContent: 'center' },
  top: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 24, gap: 6 },
  lang: { position: 'absolute', top: 0, right: 16, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.gold },
  langText: { color: colors.gold, fontWeight: '700' },
  logo: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginTop: 32 },
  logoText: { fontSize: 36, color: colors.primaryDark, fontWeight: '800' },
  brand: { color: colors.white, fontSize: 22, fontWeight: '800' },
  tagline: { color: '#a7f3d0' },
  card: { marginHorizontal: 16, padding: 20, gap: 12 },
});
