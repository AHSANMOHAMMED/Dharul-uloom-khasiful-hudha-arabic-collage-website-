import { useState } from 'react';
import { useAuth } from '../lib/auth';
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
  const [code, setCode] = useState('');
  const { session, mfaPending, refreshAal, signOut } = useAuth();
  const [needsCode, setNeedsCode] = useState(false);
  const showCodeStep = needsCode || (session && mfaPending);

  const verifyCode = async () => {
    const clean = code.replace(/\D/g, '');
    if (clean.length !== 6) return Alert.alert(t('common.error'), t('mfa.enterCode'));
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const factors = (data?.totp || []).filter((f) => f.status === 'verified');
      let ok = false;
      for (const f of factors) {
        const res = await supabase.auth.mfa.challengeAndVerify({ factorId: f.id, code: clean });
        if (!res.error) {
          ok = true;
          break;
        }
      }
      if (!ok) throw new Error(t('mfa.wrongCode'));
      await refreshAal();
      setNeedsCode(false);
      router.replace('/');
    } catch (e) {
      setCode('');
      Alert.alert(t('auth.failed'), e.message || t('mfa.wrongCode'));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async () => {
    if (!isConfigured || !supabase) return Alert.alert(t('common.error'), t('common.notConfigured'));
    if (!email.trim() || !password) return Alert.alert(t('common.error'), t('common.required'));
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      return Alert.alert(t('auth.failed'), error.message);
    }
    // Accounts with two-step verification must enter a code before the session is privileged.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setLoading(false);
    setPassword('');
    if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') setNeedsCode(true);
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
        {showCodeStep ? (
          <Card style={styles.card}>
            <Txt variant="title">{t('mfa.title')}</Txt>
            <Txt>{t('mfa.help')}</Txt>
            <Field
              label={t('mfa.code')}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              onSubmitEditing={verifyCode}
              inputStyle={styles.code}
              autoFocus
            />
            <Button title={loading ? t('mfa.verifying') : t('mfa.verify')} loading={loading} onPress={verifyCode} />
            <Button
              variant="ghost"
              title={t('auth.signOut')}
              onPress={async () => {
                await signOut();
                setNeedsCode(false);
                setCode('');
              }}
            />
          </Card>
        ) : (
        <Card style={styles.card}>
          <Txt variant="title">{t('auth.welcome')}</Txt>
          {!isConfigured ? <ErrorBanner message={t('common.notConfigured')} /> : null}
          <Field label={t('auth.email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
          <Field label={t('auth.password')} secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} onSubmitEditing={onSubmit} />
          <Button title={loading ? t('auth.signingIn') : t('auth.signIn')} loading={loading} onPress={onSubmit} />
          <Button variant="ghost" title={t('auth.forgot')} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/forgot-password`)} />
          <Button variant="ghost" title={t('auth.noAccount')} onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/register`)} />
        </Card>
        )}
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
  code: { fontSize: 26, letterSpacing: 10, textAlign: 'center', fontWeight: '700' },
});
