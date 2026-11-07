import { supabase, isSupabaseConfigured, supabaseFunctionBaseUrl } from './supabaseClient';
import { tx } from './tx';

/**
 * Arabic → Tamil word lookup for the library reader.
 * 1. translate-word edge function (dictionary, AI fallback when no match)
 * 2. lookup_arabic_word RPC (dictionary only) when the function is unavailable
 */

export const LOOKUP_TIMEOUT_MS = 10_000;

const ARABIC_RUN = /[؀-ۿݐ-ݿࢠ-ࣿ]+/g;
const ARABIC_PUNCT = /[،؛؟٪-٭۔۝۞۩]/g;

/** Keep only the Arabic letters + diacritics of a token (drops punctuation, digits, Latin). */
export function cleanArabicWord(input) {
  const runs = String(input || '').replace(ARABIC_PUNCT, ' ').match(ARABIC_RUN);
  if (!runs) return '';
  return runs.join('').replace(/[٠-٩۰-۹]/g, '').slice(0, 40);
}

export function isArabicWord(input) {
  return cleanArabicWord(input).length > 0;
}

function timeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return AbortSignal.timeout(ms);
  return undefined;
}

async function viaRpc(word) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Dictionary service is not configured.');
  // the shared client already aborts every request after 10 s (fetchWithTimeout)
  const { data, error } = await supabase.rpc('lookup_arabic_word', { p_word: word, p_limit: 8 });
  if (error) throw new Error(error.message);
  return { ...(data || {}), results: data?.results || [], from: 'dictionary' };
}

/**
 * Look up one Arabic word. Returns
 * { word, normalized, results:[...], from:'dictionary'|'ai', unverified?, note? }.
 */
export async function lookupArabicWord(rawWord, context = '') {
  const word = cleanArabicWord(rawWord);
  if (!word) throw new Error('Enter one Arabic word.');

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (supabaseFunctionBaseUrl && anonKey) {
    let token = anonKey;
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) token = data.session.access_token;
    } catch {
      /* not signed in — anon key */
    }
    let res = null;
    try {
      res = await fetch(`${supabaseFunctionBaseUrl.replace(/\/$/, '')}/functions/v1/translate-word`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: anonKey },
        body: JSON.stringify({ word, context: String(context || '').slice(0, 400) }),
        signal: timeoutSignal(LOOKUP_TIMEOUT_MS),
      });
    } catch (error) {
      if (error?.name === 'TimeoutError') throw new Error('The lookup timed out. Please try again.');
      res = null; // network / CORS: fall back to the dictionary RPC
    }
    if (res?.ok) {
      const body = await res.json();
      return { ...body, results: body?.results || [] };
    }
    if (res && res.status === 400) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || 'Enter one Arabic word.');
    }
  }
  return viaRpc(word);
}

/** Localised part-of-speech label (literal tx() calls so the Tamil extractor sees them). */
export function posLabel(pos) {
  switch (pos) {
    case 'noun':
      return tx('اسم', 'Noun');
    case 'verb':
      return tx('فعل', 'Verb');
    case 'particle':
      return tx('حرف', 'Particle');
    case 'adjective':
      return tx('صفة', 'Adjective');
    case 'phrase':
      return tx('عبارة', 'Phrase');
    case 'name':
      return tx('اسم علم', 'Proper name');
    case 'other':
      return tx('أخرى', 'Other');
    default:
      return pos || '';
  }
}

export { normalizeArabic } from './arabicNormalize';
