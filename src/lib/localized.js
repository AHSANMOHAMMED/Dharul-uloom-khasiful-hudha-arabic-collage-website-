import i18n from '../i18n';

/**
 * Pick the current UI language from a content object { en, ar, ta }
 * (CMS rows mapped by contentApi), falling back to English.
 */
export function localized(value) {
  if (value == null) return '';
  if (typeof value !== 'object') return value;
  return value[i18n.language] || value.en || value.ar || '';
}
