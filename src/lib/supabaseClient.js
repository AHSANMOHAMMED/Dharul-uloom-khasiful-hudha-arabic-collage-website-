import { createClient } from '@supabase/supabase-js';

// Read configuration from Vite env. These are safe to expose to the browser:
// the anon key is governed by Row Level Security policies in Supabase.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseFunctionBaseUrl = supabaseUrl || '';

// The app should still build and render (with graceful empty states) before a
// Supabase project has been provisioned, so we guard against missing config
// instead of throwing at import time.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
      'Library features that require Supabase will show empty states until configured.'
  );
}

// Every API call is bounded: a request that has not answered within 10 s is
// aborted so the UI can show an error instead of hanging. Realtime (websocket)
// and storage uploads are not affected.
export const REQUEST_TIMEOUT_MS = 9_000;
export function fetchWithTimeout(input, init = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  if (typeof AbortController === 'undefined') return fetch(input, init);

  // Preserve explicit caller cancellation while still enforcing the platform
  // API budget. A supplied signal must not disable the timeout.
  const controller = new AbortController();
  const callerSignal = init.signal;
  const abortFromCaller = () => controller.abort(callerSignal?.reason);
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });

  const cleanup = () => {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  };
  const timer = setTimeout(() => {
    const timeout = new Error('Request exceeded the 9 second API response budget');
    timeout.name = 'TimeoutError';
    controller.abort(timeout);
  }, timeoutMs);
  controller.signal.addEventListener('abort', cleanup, { once: true });
  return fetch(input, { ...init, signal: controller.signal }).then((response) => {
    // Keep the deadline active until the response body has been consumed too;
    // fetch() itself resolves as soon as headers arrive.
    if (!response.body) {
      cleanup();
      return response;
    }
    for (const method of ['json', 'text', 'arrayBuffer', 'blob', 'formData']) {
      const original = response[method]?.bind(response);
      if (!original) continue;
      response[method] = (...args) => original(...args).finally(cleanup);
    }
    return response;
  }).catch((error) => {
    cleanup();
    throw error;
  });
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: fetchWithTimeout },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export default supabase;
