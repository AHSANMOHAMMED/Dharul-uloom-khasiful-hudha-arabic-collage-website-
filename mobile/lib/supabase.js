import { createClient } from '@supabase/supabase-js';
import { storage } from './storage';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || 'https://kashifulhudha.lk').replace(/\/$/, '');

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Bound every API call to 10 s (mobile networks can stall); screens show a retry.
const REQUEST_TIMEOUT_MS = 9000;
export function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const callerSignal = init.signal;
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
  const timer = setTimeout(() => {
    const timeout = new Error('Request exceeded the 9 second API response budget');
    timeout.name = 'TimeoutError';
    controller.abort(timeout);
  }, REQUEST_TIMEOUT_MS);
  const cleanup = () => {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  };
  controller.signal.addEventListener('abort', cleanup, { once: true });
  return fetch(input, { ...init, signal: controller.signal }).then((response) => {
    if (!response.body) {
      cleanup();
      return response;
    }
    for (const method of ['json', 'text', 'arrayBuffer', 'blob', 'formData']) {
      const original = response[method]?.bind(response);
      if (original) response[method] = (...args) => original(...args).finally(cleanup);
    }
    return response;
  }).catch((error) => {
    cleanup();
    throw error;
  });
}

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { fetch: fetchWithTimeout },
      auth: {
        storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Throws the PostgREST error so callers can use try/catch uniformly.
export async function must(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}
