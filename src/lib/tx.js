import i18n from '../i18n';

/**
 * Trilingual string picker for EN / AR / TA.
 *
 * Most screens were written bilingually as `ar ? 'عربي' : 'English'`.
 * `tx('عربي', 'English')` keeps that call shape and adds Tamil: when the UI
 * language is `ta` the English text is looked up in the Tamil dictionary
 * (src/locales/ta.json, keyed by the exact English string) and falls back to
 * English when a string has not been translated yet.
 *
 * The Tamil dictionary is loaded lazily (see loadTamil) so EN/AR users do not
 * download it.
 */

let TA = null;
let loading = null;

export function loadTamil() {
  if (TA) return Promise.resolve(TA);
  if (!loading) {
    loading = import('../locales/ta.json').then((m) => {
      TA = m.default || m;
      return TA;
    });
  }
  return loading;
}

/** Tamil for an English source string (or the English itself). */
export function toTamil(en) {
  if (typeof en !== 'string') return en;
  return (TA && TA[en]) || en;
}

/** tx(arabic, english) → string in the current UI language. */
export function tx(ar, en) {
  const lang = i18n.language;
  if (lang === 'ar') return ar;
  if (lang === 'ta') return toTamil(en);
  return en;
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'ta', label: 'தமிழ்', dir: 'ltr' },
];

/** Switch language, loading the Tamil dictionary first when needed. */
export async function setLanguage(code) {
  if (code === 'ta') await loadTamil();
  await i18n.changeLanguage(code);
  try {
    localStorage.setItem('kh_lang', code);
  } catch {
    /* storage unavailable (private mode) — language still applies for this session */
  }
}
