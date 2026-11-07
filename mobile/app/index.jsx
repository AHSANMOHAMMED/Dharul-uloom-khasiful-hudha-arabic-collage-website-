import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase, isConfigured } from '../lib/supabase';

export default function Home() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (!isConfigured || !supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user || !supabase) return;
    (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_type, role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profile?.role === 'admin') return;
      if (profile?.account_type === 'parent') router.replace('/parent');
      else if (profile?.account_type === 'student') router.replace('/student');
      else if (profile?.account_type === 'tutor') router.replace('/tutor');
    })();
  }, [session]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.brand}>Dharul Uloom Kashiful Hudha</Text>
      <Text style={styles.sub}>Mobile portal (Supabase)</Text>
      {!isConfigured && (
        <Text style={styles.warn}>Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY</Text>
      )}
      <Link href="/login" asChild>
        <Pressable style={styles.btn}>
          <Text style={styles.btnText}>Sign in</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc', gap: 12 },
  brand: { fontSize: 22, fontWeight: '700', color: '#064e3b' },
  sub: { color: '#64748b', marginBottom: 12 },
  warn: { color: '#b45309', marginBottom: 8 },
  btn: { backgroundColor: '#047857', padding: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});
