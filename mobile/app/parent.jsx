import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function ParentScreen() {
  const [children, setChildren] = useState([]);
  const [fees, setFees] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data } = await supabase
        .from('parent_children')
        .select('child_id, profiles:child_id(id, full_name, index_number, class_number)')
        .eq('parent_id', user.id);
      const kids = (data || []).map((r) => r.profiles).filter(Boolean);
      setChildren(kids);
      if (kids[0]) {
        const { data: feeRows } = await supabase
          .from('student_fees')
          .select('*')
          .eq('student_id', kids[0].id)
          .order('month', { ascending: false })
          .limit(3);
        setFees(feeRows || []);
      }
    })();
  }, []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.h}>Linked children</Text>
      <FlatList
        data={children}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={<Text style={styles.muted}>No children linked yet</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.full_name}</Text>
            <Text style={styles.muted}>
              {item.index_number} · Class {item.class_number ?? '—'}
            </Text>
          </View>
        )}
      />
      <Text style={styles.h}>Recent fees</Text>
      {fees.map((f) => (
        <View key={f.id} style={styles.card}>
          <Text style={styles.name}>{f.month} · {f.status}</Text>
          <Text style={styles.muted}>LKR {f.paid_amount}/{f.total_due}</Text>
        </View>
      ))}
      <Pressable
        style={styles.btn}
        onPress={async () => {
          await supabase.auth.signOut();
          router.replace('/login');
        }}
      >
        <Text style={styles.btnText}>Sign out</Text>
      </Pressable>
      <Pressable onPress={() => Alert.alert('Payments', 'Complete PayHere checkout on the web portal for now.')}>
        <Text style={styles.link}>Pay fees on web portal</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: '#f8fafc', gap: 8 },
  h: { fontSize: 16, fontWeight: '700', color: '#064e3b', marginTop: 8 },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  name: { fontWeight: '600', color: '#0f172a' },
  muted: { color: '#64748b', fontSize: 12, marginTop: 2 },
  btn: { marginTop: 16, backgroundColor: '#334155', padding: 12, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  link: { color: '#047857', textAlign: 'center', marginTop: 8, fontWeight: '600' },
});
