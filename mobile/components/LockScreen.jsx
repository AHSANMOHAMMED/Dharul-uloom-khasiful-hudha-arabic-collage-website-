import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppLock, biometricSupport, PIN_LENGTH } from '../lib/appLock';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { colors } from '../lib/theme';
import Txt from './Txt';
import Button from './Button';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];

/** Full-screen lock shown over the app until fingerprint/Face ID or the app PIN succeeds. */
export default function LockScreen() {
  const { t } = useI18n();
  const { hasPin, unlockWithBiometrics, unlockWithPin } = useAppLock();
  const { signOut } = useAuth();
  const [pin, setPin] = useState('');
  const [bio, setBio] = useState(false);
  const [error, setError] = useState('');

  const tryBiometric = useCallback(async () => {
    try {
      await unlockWithBiometrics(t('lock.prompt'));
    } catch {
      /* user cancelled or sensor error: the PIN pad stays available */
    }
  }, [unlockWithBiometrics, t]);

  useEffect(() => {
    biometricSupport().then((s) => {
      const usable = s.available && s.enrolled;
      setBio(usable);
      if (usable) tryBiometric();
    });
  }, [tryBiometric]);

  const press = async (k) => {
    if (k === 'bio') return tryBiometric();
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    const next = (pin + k).slice(0, PIN_LENGTH);
    setPin(next);
    setError('');
    if (next.length === PIN_LENGTH) {
      const res = await unlockWithPin(next);
      setPin('');
      if (!res.ok) {
        if (res.remaining === 0) {
          Alert.alert(t('lock.title'), t('lock.tooMany'));
        } else {
          setError(t('lock.wrongPin', { n: res.remaining }));
        }
      }
    }
  };

  const signOutNow = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <View style={styles.logo}>
          <Ionicons name="lock-closed" size={32} color={colors.primaryDark} />
        </View>
        <Txt style={styles.title} center>{t('lock.title')}</Txt>
        <Txt style={styles.sub} center>{hasPin ? t('lock.enterPin') : t('lock.useBiometric')}</Txt>
      </View>

      {hasPin ? (
        <>
          <View style={styles.dots} accessibilityLabel={t('lock.enterPin')}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <View key={i} style={[styles.dot, i < pin.length && styles.dotOn]} />
            ))}
          </View>
          {error ? <Txt style={styles.error} center>{error}</Txt> : <View style={{ height: 20 }} />}
          <View style={styles.pad}>
            {KEYS.map((k) => {
              if (k === 'bio' && !bio) return <View key={k} style={styles.key} />;
              return (
                <Pressable
                  key={k}
                  onPress={() => press(k)}
                  accessibilityRole="button"
                  accessibilityLabel={k === 'bio' ? t('lock.useBiometric') : k === 'del' ? t('lock.delete') : k}
                  style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                >
                  {k === 'bio' ? (
                    <Ionicons name="finger-print" size={30} color={colors.white} />
                  ) : k === 'del' ? (
                    <Ionicons name="backspace-outline" size={26} color={colors.white} />
                  ) : (
                    <Txt style={styles.keyText}>{k}</Txt>
                  )}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <View style={styles.bioOnly}>
          <Button title={t('lock.unlock')} variant="gold" icon="finger-print" onPress={tryBiometric} />
        </View>
      )}

      <Button variant="ghost" title={t('auth.signOut')} onPress={signOutNow} style={styles.signOut} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.primaryDark, zIndex: 1000, justifyContent: 'space-between', paddingVertical: 24 },
  top: { alignItems: 'center', gap: 8, marginTop: 32 },
  logo: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.white, fontSize: 22, fontWeight: '800' },
  sub: { color: '#a7f3d0' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 14 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.gold },
  dotOn: { backgroundColor: colors.gold },
  error: { color: '#fecaca', minHeight: 20 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 40 },
  key: { width: '33.33%', height: 72, alignItems: 'center', justifyContent: 'center' },
  keyPressed: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 36 },
  keyText: { color: colors.white, fontSize: 28, fontWeight: '600' },
  bioOnly: { paddingHorizontal: 32 },
  signOut: { marginHorizontal: 32 },
});
