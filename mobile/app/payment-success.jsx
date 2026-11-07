import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';

export default function PaymentSuccess() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Payment received</Text>
      <Text style={styles.sub}>Your PayHere payment was successful. Fees will update shortly.</Text>
      <Pressable style={styles.btn} onPress={() => router.replace('/')}>
        <Text style={styles.btnText}>Back to portal</Text>
      </Pressable>
      <Pressable onPress={() => Linking.openURL('https://kashifulhudha.lk/payment/success').catch(() => {})}>
        <Text style={styles.link}>Open web receipt page</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#f8fafc' },
  title: { fontSize: 22, fontWeight: '700', color: '#064e3b' },
  sub: { color: '#64748b' },
  btn: { backgroundColor: '#047857', padding: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  link: { color: '#047857', textAlign: 'center', marginTop: 8 },
});
