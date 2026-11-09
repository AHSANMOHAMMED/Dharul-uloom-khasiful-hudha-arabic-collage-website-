import { useEffect, useRef } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider, useI18n } from '../lib/i18n';
import { AuthProvider, useAuth } from '../lib/auth';
import { colors } from '../lib/theme';
import { handleInitialPush, listenForPushTaps, registerForPush, setPushCaps } from '../lib/push';
import { LiveProvider } from '../lib/live';
import LiveToast from '../components/LiveToast';
import LockScreen from '../components/LockScreen';
import { AppLockProvider, useAppLock } from '../lib/appLock';

// Routes reachable without a session (deep links included).
const PUBLIC = new Set(['login', 'payment-success', 'payment-cancel']);

function AuthGate() {
  const { session, loading, caps, mfaPending } = useAuth();
  const segments = useSegments();
  // Push routing depends on the role (activity → team screen for governance).
  const isGovernance = caps.isGovernance;
  useEffect(() => {
    setPushCaps({ isGovernance });
  }, [isGovernance]);
  useEffect(() => {
    if (loading) return;
    const first = segments[0];
    if (!session && first && !PUBLIC.has(first)) router.replace('/login');
    // A password-only session on a 2FA account stays on the code step.
    else if (session && mfaPending && first !== 'login') router.replace('/login');
  }, [session, loading, segments, mfaPending]);

  // Register this device for native push once signed in.
  const userId = session?.user?.id;
  useEffect(() => {
    if (userId) registerForPush();
  }, [userId]);
  useEffect(() => listenForPushTaps(), []);

  // Cold start from a push tap: route once the session is restored and the
  // role router has had a moment to place the user in their portal.
  const initialHandled = useRef(false);
  useEffect(() => {
    if (loading || !userId || initialHandled.current) return undefined;
    initialHandled.current = true;
    const timer = setTimeout(handleInitialPush, 700);
    return () => clearTimeout(timer);
  }, [loading, userId]);
  return null;
}

function RootStack() {
  const { t, ready } = useI18n();
  if (!ready) return null;
  const header = {
    headerStyle: { backgroundColor: colors.primaryDark },
    headerTintColor: colors.white,
    headerTitleStyle: { fontWeight: '700' },
    contentStyle: { backgroundColor: colors.bg },
  };
  return (
    <>
      <StatusBar style="light" />
      <AuthGate />
      <Stack screenOptions={header}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="pending" options={{ title: t('pending.title') }} />
        <Stack.Screen name="student" options={{ headerShown: false }} />
        <Stack.Screen name="parent" options={{ headerShown: false }} />
        <Stack.Screen name="staff" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="platform" options={{ title: t('role.super_admin') }} />
        <Stack.Screen name="finance-hub" options={{ title: 'Finance Hub' }} />
        <Stack.Screen name="donations" options={{ title: 'Donations' }} />
        <Stack.Screen name="expenses" options={{ title: 'Expenses' }} />
        <Stack.Screen name="cheques" options={{ title: 'Cheques' }} />
        <Stack.Screen name="library" options={{ title: t('nav.library') || 'Library' }} />
        <Stack.Screen name="tutor-lms" options={{ title: t('lms.title') || 'Class LMS' }} />
        <Stack.Screen name="payment-success" options={{ title: t('payment.successTitle') }} />
        <Stack.Screen name="payment-cancel" options={{ title: t('payment.cancelTitle') }} />
        <Stack.Screen name="notifications" options={{ title: t('notif.title') }} />
        <Stack.Screen name="messages" options={{ title: t('chat.title') }} />
        <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
        <Stack.Screen name="fees" options={{ title: t('fees.title') }} />
        <Stack.Screen name="results" options={{ title: t('results.title') }} />
        <Stack.Screen name="report-card" options={{ title: t('results.reportCard') }} />
        <Stack.Screen name="attendance-history" options={{ title: t('attendance.history') }} />
        <Stack.Screen name="timetable" options={{ title: t('timetable.title') }} />
        <Stack.Screen name="certificates" options={{ title: t('cert.title') }} />
        <Stack.Screen name="hostel" options={{ title: t('hostel.title') }} />
        <Stack.Screen name="leave-requests" options={{ title: t('leave.title') }} />
        <Stack.Screen name="discipline" options={{ title: t('child.discipline') }} />
        <Stack.Screen name="announcements" options={{ title: t('home.announcements') }} />
        <Stack.Screen name="link-child" options={{ title: t('parent.link') }} />
        <Stack.Screen name="child/[id]" options={{ title: t('child.overview') }} />
        <Stack.Screen name="assignment/[id]" options={{ title: t('lms.assignments') }} />
        <Stack.Screen name="payslip/[id]" options={{ title: t('staff.payslips') }} />
        <Stack.Screen name="my-attendance" options={{ title: t('staff.myAttendance') }} />
        <Stack.Screen name="staff-leave" options={{ title: t('staff.requestLeave') }} />
        <Stack.Screen name="payslips" options={{ title: t('staff.payslips') }} />
        <Stack.Screen name="receipt/[id]" options={{ title: t('receipt.title') }} />
        <Stack.Screen name="receive-payment" options={{ title: t('counter.title') }} />
        <Stack.Screen name="dictionary" options={{ title: t('dict.title') }} />
        <Stack.Screen name="tasks" options={{ title: t('task.boardTitle') }} />
        <Stack.Screen name="task/[id]" options={{ title: t('task.detail') }} />
        <Stack.Screen name="duties" options={{ title: t('duty.title') }} />
        <Stack.Screen name="petty-cash-spend" options={{ title: t('petty.recordSpend') }} />
        <Stack.Screen name="mashoora" options={{ title: t('mashoora.title') }} />
        <Stack.Screen name="finance/index" options={{ title: t('fin.title') }} />
        <Stack.Screen name="finance/outstanding" options={{ title: t('admin.outstandingList') }} />
        <Stack.Screen name="finance/student/[id]" options={{ title: t('fin.studentTitle') }} />
        <Stack.Screen name="responsibilities" options={{ title: t('resp.title') }} />
        <Stack.Screen name="activity/[id]" options={{ title: t('activity.title') }} />
        <Stack.Screen name="analytics" options={{ title: t('analytics.title') }} />
        <Stack.Screen name="accounting/index" options={{ title: t('finance.accounting') || 'Accounting' }} />
        <Stack.Screen name="admissions/index" options={{ title: t('admissions.pipeline') || 'Admissions' }} />
        <Stack.Screen name="admissions/[id]" options={{ title: t('admissions.detail') || 'Admission' }} />
        <Stack.Screen name="welfare/index" options={{ title: t('welfare.title') || 'Welfare' }} />
        <Stack.Screen name="welfare/[id]" options={{ title: t('welfare.case') || 'Welfare case' }} />
        <Stack.Screen name="exams/index" options={{ title: t('exams.title') || 'Exams' }} />
        <Stack.Screen name="exams/[id]" options={{ title: t('exams.detail') || 'Exam' }} />
      </Stack>
      <LiveToast />
      <LockOverlay />
    </>
  );
}

function LockOverlay() {
  const { locked } = useAppLock();
  return locked ? <LockScreen /> : null;
}

function LockedApp({ children }) {
  const { session, signOut } = useAuth();
  return (
    <AppLockProvider
      signedIn={Boolean(session)}
      onTooManyAttempts={async () => {
        await signOut();
        router.replace('/login');
      }}
    >
      {children}
    </AppLockProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <LockedApp>
            <LiveProvider>
              <RootStack />
            </LiveProvider>
          </LockedApp>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
