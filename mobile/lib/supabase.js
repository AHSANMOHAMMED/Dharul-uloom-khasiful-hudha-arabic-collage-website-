import { createClient } from '@supabase/supabase-js';
import { storage } from './storage';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || 'https://kashifulhudha.lk').replace(/\/$/, '');

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Bound every API call to 10 s (mobile networks can stall); screens show a retry.
const REQUEST_TIMEOUT_MS = 10000;
function fetchWithTimeout(input, init = {}) {
  if (init.signal) return fetch(input, init);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
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
