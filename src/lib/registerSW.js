/**
 * registerSW.js
 * Registers the service worker and exposes helpers for push notifications.
 */

const SW_URL = '/sw.js';

/**
 * Register the service worker on supported browsers.
 * Call this once at app startup (main.jsx).
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.info('[SW] Service Workers not supported in this browser.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_URL, {
      scope: '/',
    });

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker?.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          window.dispatchEvent(new CustomEvent('sw-update-available'));
        }
      });
    });

    console.info('[SW] Registered successfully:', registration.scope);
    return registration;
  } catch (err) {
    console.error('[SW] Registration failed:', err);
    return null;
  }
}

/**
 * Request permission and subscribe to push notifications.
 * Returns the PushSubscription object or null if denied / unsupported.
 * @param {string} vapidPublicKey - Your VAPID public key (base64url encoded)
 */
export async function subscribeToPush(vapidPublicKey) {
  if (!('PushManager' in window)) {
    console.warn('[Push] PushManager not available');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('[Push] Permission not granted:', permission);
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    console.info('[Push] Subscribed:', subscription.endpoint);
    return subscription;
  } catch (err) {
    console.error('[Push] Subscription failed:', err);
    return null;
  }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      console.info('[Push] Unsubscribed');
    }
  } catch (err) {
    console.error('[Push] Unsubscribe failed:', err);
  }
}

// Helper: convert VAPID base64url key to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
