import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import { storage } from './storage';

/**
 * App lock: fingerprint / Face ID (or the phone's own screen lock), with an
 * app PIN as fallback for devices without biometrics. Settings live in
 * SecureStore (Keychain / Keystore). The PIN is stored only as a salted
 * SHA-256 hash; after MAX_ATTEMPTS wrong PINs the user is signed out.
 *
 * This protects an already signed-in phone. Account security (password +
 * two-step verification) is enforced by the server.
 */
const KEY_ENABLED = 'applock.enabled';
const KEY_PIN = 'applock.pinHash';
const KEY_SALT = 'applock.salt';
const KEY_FAILS = 'applock.fails';
export const RELOCK_AFTER_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const PIN_LENGTH = 6;

const LockContext = createContext(null);

async function hashPin(pin, salt) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function biometricSupport() {
  if (Platform.OS === 'web') return { available: false, enrolled: false, types: [] };
  const [hardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  return { available: hardware, enrolled, types };
}

export function AppLockProvider({ signedIn, onTooManyAttempts, children }) {
  const [enabled, setEnabled] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const backgroundAt = useRef(null);

  // Load settings; lock on cold start when enabled.
  useEffect(() => {
    let live = true;
    (async () => {
      const [on, pin] = await Promise.all([storage.getItem(KEY_ENABLED), storage.getItem(KEY_PIN)]);
      if (!live) return;
      setEnabled(on === '1');
      setHasPin(Boolean(pin));
      setLocked(on === '1');
      setReady(true);
    })();
    return () => {
      live = false;
    };
  }, []);

  // Re-lock after the app has been in the background for a while.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        if (backgroundAt.current == null) backgroundAt.current = Date.now();
      } else if (state === 'active') {
        const away = backgroundAt.current ? Date.now() - backgroundAt.current : 0;
        backgroundAt.current = null;
        if (enabled && away >= RELOCK_AFTER_MS) setLocked(true);
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const unlockWithBiometrics = useCallback(async (promptMessage) => {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage,
      // Allow the phone's own PIN/pattern when biometrics fail or are absent.
      disableDeviceFallback: false,
    });
    if (res.success) {
      await storage.setItem(KEY_FAILS, '0');
      setLocked(false);
    }
    return res.success;
  }, []);

  const unlockWithPin = useCallback(
    async (pin) => {
      const [stored, salt] = await Promise.all([storage.getItem(KEY_PIN), storage.getItem(KEY_SALT)]);
      if (!stored || !salt) return { ok: false, remaining: 0 };
      if ((await hashPin(pin, salt)) === stored) {
        await storage.setItem(KEY_FAILS, '0');
        setLocked(false);
        return { ok: true };
      }
      const fails = Number((await storage.getItem(KEY_FAILS)) || 0) + 1;
      await storage.setItem(KEY_FAILS, String(fails));
      const remaining = Math.max(0, MAX_ATTEMPTS - fails);
      if (remaining === 0) {
        await disableLock();
        onTooManyAttempts?.();
      }
      return { ok: false, remaining };
    },
    [onTooManyAttempts],
  );

  const setPin = useCallback(async (pin) => {
    if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) throw new Error('PIN must be 6 digits');
    const salt = Crypto.randomUUID();
    await storage.setItem(KEY_SALT, salt);
    await storage.setItem(KEY_PIN, await hashPin(pin, salt));
    await storage.setItem(KEY_FAILS, '0');
    setHasPin(true);
  }, []);

  const enableLock = useCallback(async () => {
    await storage.setItem(KEY_ENABLED, '1');
    setEnabled(true);
  }, []);

  async function disableLock() {
    await Promise.all([
      storage.removeItem(KEY_ENABLED),
      storage.removeItem(KEY_PIN),
      storage.removeItem(KEY_SALT),
      storage.removeItem(KEY_FAILS),
    ]);
    setEnabled(false);
    setHasPin(false);
    setLocked(false);
  }

  const value = useMemo(
    () => ({
      ready,
      enabled,
      hasPin,
      // Only meaningful with a session: a signed-out phone shows the login screen.
      locked: Boolean(signedIn) && enabled && locked,
      unlockWithBiometrics,
      unlockWithPin,
      setPin,
      enableLock,
      disableLock,
    }),
    [ready, enabled, hasPin, locked, signedIn, unlockWithBiometrics, unlockWithPin, setPin, enableLock],
  );

  return createElement(LockContext.Provider, { value }, children);
}

export function useAppLock() {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useAppLock must be used inside AppLockProvider');
  return ctx;
}
