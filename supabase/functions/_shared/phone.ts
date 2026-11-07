/** Sri Lankan numbers: 0771234567 / 771234567 / +94 77 123 4567 → 94771234567 */
export function normalizeLkPhone(raw: string): string {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('94') && d.length === 11) return d;
  if (d.startsWith('0') && d.length === 10) return `94${d.slice(1)}`;
  if (d.length === 9 && d.startsWith('7')) return `94${d}`;
  return d;
}
