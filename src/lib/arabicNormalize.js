/** Same rules as SQL public.arabic_normalize(): drop tashkeel/tatweel/Quranic marks,
 * unify alef/hamza/ya/ta-marbuta, keep Arabic letters only. */
export function normalizeArabic(text) {
  return String(text || '')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/[ئى]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0621-\u064A]/g, '');
}
