import { SUPABASE_URL } from './supabase';

export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'cheque', 'online', 'other'];

/** Public PDF of a receipt (the 128-bit token is the credential). */
export function receiptPdfUrl(token) {
  if (!token || !SUPABASE_URL) return null;
  return `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/receipt-pdf?t=${encodeURIComponent(token)}`;
}

/** Translated label for a payment method, falling back to the raw value. */
export function methodLabel(t, method) {
  if (!method) return '—';
  const key = `method.${method}`;
  const label = t(key);
  return label === key ? String(method).replace(/_/g, ' ') : label;
}
