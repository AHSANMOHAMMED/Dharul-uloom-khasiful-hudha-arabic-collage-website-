import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';

export default function PaymentCancel() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Payment cancelled</Text>
      <Text style={styles.sub}>No charge was completed. You can try again from the parent or student portal.</Text>
      <Pressable style={styles.btn} onPress={() => router.replace('/')}>
        <Text style={styles.btnText}>Back to portal</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#f8fafc' },
  title: { fontSize: 22, fontWeight: '700', color: '#9a3412' },
  sub: { color: '#64748b' },
  btn: { backgroundColor: '#334155', padding: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});
