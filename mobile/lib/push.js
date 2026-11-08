import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { supabase } from './supabase';

/**
 * Native push: ask permission, get the Expo push token and register it with
 * the backend (rpc register_push_token). The database fans every in-app
 * notification out to registered devices; send-outbound delivers them.
 *
 * Requires a real device and an EAS projectId (app.json → extra.eas.projectId,
 * set by `eas init`). Without them this is a silent no-op.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function projectId() {
  const id = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  return id && !String(id).startsWith('replace-') ? id : null;
}

export async function registerForPush() {
  try {
    if (!supabase || !Device.isDevice || !projectId()) return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Kashiful Hudha',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    if (!token) return null;
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
    if (error) console.warn('[push] register failed', error.message);
    return token;
  } catch (e) {
    console.warn('[push] unavailable', e?.message || e);
    return null;
  }
}

// Top-level app routes a notification `link` may point at.
const APP_ROUTES = new Set([
  'receipt', 'notifications', 'announcements', 'fees', 'results', 'report-card', 'attendance-history',
  'timetable', 'certificates', 'hostel', 'leave-requests', 'discipline', 'child', 'assignment', 'payslips',
  'payslip', 'my-attendance', 'staff-leave', 'settings', 'student', 'parent', 'staff', 'admin',
  'receive-payment', 'dictionary', 'tasks', 'task', 'duties', 'mashoora', 'petty-cash-spend',
  'finance', 'responsibilities', 'activity', 'analytics',
]);

// Older / web links that have a different mobile route.
const LINK_ALIASES = { '/activities': '/responsibilities' };

// Governance users open the activity itself (team + add people); everyone else
// lands on My responsibilities. Set from the auth gate (setPushCaps).
let governance = false;
export function setPushCaps(caps) {
  governance = !!caps?.isGovernance;
}

// Web ERP links (/erp?module=…) that have a mobile screen.
const ERP_MODULE_ROUTES = {
  tasks: '/tasks',
  duties: '/duties',
  mashoora: '/mashoora',
  activities: '/responsibilities',
  analytics: '/analytics',
  finance: '/finance',
};

function erpRoute(link) {
  if (typeof link !== 'string' || !link.startsWith('/erp')) return null;
  const m = link.match(/[?&]module=([\w-]+)/);
  return (m && ERP_MODULE_ROUTES[m[1]]) || null;
}

export function isAppRoute(link) {
  if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//')) return false;
  const first = link.slice(1).split(/[/?#]/)[0];
  return APP_ROUTES.has(first);
}

/**
 * Where tapping a notification should go. Accepts an in-app notification row
 * ({ data, link }) or a push payload's data ({ type, receipt_id, link, … }).
 */
export function notificationRoute(input) {
  const n = input || {};
  const data = n.data && typeof n.data === 'object' ? n.data : n;
  // Students / parents and finance staff (audience 'finance') both open the receipt.
  if (data.type === 'fee_receipt' && data.receipt_id) return `/receipt/${data.receipt_id}`;
  if (data.type === 'task' && data.task_id) return `/task/${data.task_id}`;
  if (data.type === 'duty') return '/duties';
  if (data.type === 'activity') {
    return governance && data.activity_id ? `/activity/${data.activity_id}` : '/responsibilities';
  }
  const raw = n.link || data.link;
  const link = (typeof raw === 'string' && LINK_ALIASES[raw.split(/[?#]/)[0]]) || raw;
  if (isAppRoute(link)) return link;
  const erp = erpRoute(link);
  if (erp) return erp;
  return '/notifications';
}

// A push can be reported by both the listener and getLastNotificationResponseAsync.
const handledResponses = new Set();

function handleResponse(response) {
  const req = response?.notification?.request;
  const key = req?.identifier || null;
  if (key) {
    if (handledResponses.has(key)) return;
    handledResponses.add(key);
  }
  const data = req?.content?.data || {};
  if (data.notification_id && supabase) {
    supabase.from('notifications').update({ is_read: true }).eq('id', data.notification_id).then(() => {}, () => {});
  }
  router.push(notificationRoute(data));
}

/** Route push taps while the app is running. Returns cleanup. */
export function listenForPushTaps() {
  const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
  return () => sub.remove();
}

/**
 * Cold start: the app was launched by tapping a push. Call once the session is
 * known and the navigator has mounted.
 */
export async function handleInitialPush() {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) handleResponse(response);
  } catch (e) {
    console.warn('[push] initial response unavailable', e?.message || e);
  }
}
