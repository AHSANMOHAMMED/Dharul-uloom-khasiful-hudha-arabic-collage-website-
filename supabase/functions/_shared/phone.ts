/**
 * Sri Lankan numbers → E.164 digits without '+':
 *   0771234567 / 771234567 / +94 77 123 4567 / 0094 77 123 4567 / +94 077 123 4567 → 94771234567
 * A field holding several numbers ("077… / 071…") uses the first one.
 * Other international numbers (already with a country code) pass through as digits.
 */
export function normalizeLkPhone(raw: string): string {
  const first = String(raw || '').split(/[\/,;]|\s{2,}|\bor\b/i).find((p) => /\d/.test(p)) || '';
  let d = first.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);                        // 0094… international prefix
  if (d.startsWith('940') && d.length === 12) d = `94${d.slice(3)}`; // +94 0771234567 typo
  if (d.startsWith('94') && d.length === 11) return d;
  if (d.startsWith('0') && d.length === 10) return `94${d.slice(1)}`;
  if (d.length === 9 && !d.startsWith('0')) return `94${d}`;
  return d;
}

/** Plausible E.164 digit string (8–15 digits, no leading 0). */
export function isDialable(normalized: string): boolean {
  return /^[1-9]\d{7,14}$/.test(normalized) && !(normalized.startsWith('94') && normalized.length !== 11);
}
