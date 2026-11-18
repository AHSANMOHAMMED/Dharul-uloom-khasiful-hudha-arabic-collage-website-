/**
 * Locale-aware date/number helpers for EN/AR shells.
 * Tamil linguistic review is explicitly not claimed.
 */
export function formatLocaleDate(value, lang = 'en', opts = {}) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const locale = lang === 'ar' ? 'ar-LK' : 'en-LK';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...opts,
  }).format(d);
}

export function formatLocaleNumber(value, lang = 'en', opts = {}) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  const locale = lang === 'ar' ? 'ar-LK' : 'en-LK';
  return new Intl.NumberFormat(locale, opts).format(n);
}

export function portalDir(lang) {
  return lang === 'ar' ? 'rtl' : 'ltr';
}
