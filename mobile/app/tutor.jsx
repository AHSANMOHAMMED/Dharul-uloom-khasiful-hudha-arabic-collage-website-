import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function TutorScreen() {
  const [leaves, setLeaves] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data } = await supabase
        .from('leave_requests')
        .select('*, profiles:student_id(full_name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);
      setLeaves(data || []);
    })();
  }, []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.h}>Pending leave requests</Text>
      <FlatList
        data={leaves}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={<Text style={styles.muted}>None</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.profiles?.full_name || 'Student'}</Text>
            <Text style={styles.muted}>{item.start_date} → {item.end_date}</Text>
            <Text style={styles.muted}>{item.reason}</Text>
          </View>
        )}
      />
      <Pressable style={styles.btn} onPress={async () => { await supabase.auth.signOut(); router.replace('/login'); }}>
        <Text style={styles.btnText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16, backgroundColor: '#f8fafc', gap: 8 },
  h: { fontSize: 16, fontWeight: '700', color: '#064e3b' },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 },
  name: { fontWeight: '600' },
  muted: { color: '#64748b', fontSize: 12, marginTop: 2 },
  btn: { backgroundColor: '#334155', padding: 12, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
});
