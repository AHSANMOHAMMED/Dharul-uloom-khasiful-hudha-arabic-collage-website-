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

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export default supabase;
