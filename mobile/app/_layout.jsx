import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: true, headerTintColor: '#047857' }}>
        <Stack.Screen name="index" options={{ title: 'Kashiful Hudha' }} />
        <Stack.Screen name="login" options={{ title: 'Sign in' }} />
        <Stack.Screen name="parent" options={{ title: 'Parent' }} />
        <Stack.Screen name="student" options={{ title: 'Student' }} />
        <Stack.Screen name="tutor" options={{ title: 'Tutor' }} />
      </Stack>
    </>
  );
}
