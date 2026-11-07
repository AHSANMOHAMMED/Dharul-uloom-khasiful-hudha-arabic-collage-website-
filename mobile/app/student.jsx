import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function StudentScreen() {
  const [fee, setFee] = useState(null);
  const [results, setResults] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data: fees } = await supabase
        .from('student_fees')
        .select('*')
        .eq('student_id', user.id)
        .order('month', { ascending: false })
        .limit(1);
      setFee(fees?.[0] || null);
      const { data: res } = await supabase
        .from('student_results')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setResults(res || []);
    })();
  }, []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.h}>Fees</Text>
      <View style={styles.card}>
        {fee ? (
          <Text>{fee.month}: LKR {fee.paid_amount}/{fee.total_due} ({fee.status})</Text>
        ) : (
          <Text style={styles.muted}>No fee row</Text>
        )}
      </View>
      <Text style={styles.h}>Recent results</Text>
      {results.map((r) => (
        <View key={r.id} style={styles.card}>
          <Text>{r.subject || r.exam_name || 'Result'} · {r.marks ?? r.grade ?? '—'}</Text>
        </View>
      ))}
      <Pressable style={styles.btn} onPress={async () => { await supabase.auth.signOut(); router.replace('/login'); }}>
        <Text style={styles.btnText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 8, backgroundColor: '#f8fafc' },
  h: { fontSize: 16, fontWeight: '700', color: '#064e3b' },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 12, borderColor: '#e2e8f0', borderWidth: 1 },
  muted: { color: '#64748b' },
  btn: { marginTop: 16, backgroundColor: '#334155', padding: 12, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
});
