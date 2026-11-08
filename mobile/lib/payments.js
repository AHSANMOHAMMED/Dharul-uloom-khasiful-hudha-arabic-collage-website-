import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY, fetchWithTimeout } from './supabase';

export const RETURN_URL = 'kashifulhudha://';

// Order ids whose payment-success / payment-cancel screen already opened via
// the OS deep link, so the auth-session result does not navigate twice.
const handledOrders = new Set();
export function markOrderHandled(orderId) {
  if (orderId) handledOrders.add(orderId);
}

async function createCheckout(feeId) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');

  const res = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/create-payment`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fee_id: feeId, client: 'mobile' }),
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) throw new Error(json.error || `Payment service error (${res.status})`);
  if (!json.hosted_checkout_url) throw new Error('Payment service did not return a checkout page');
  return json;
}

/**
 * Starts the PayHere checkout for an invoice and routes to the result screen.
 * Returns 'success' | 'cancel' | 'dismissed'.
 */
export async function payFee(feeId) {
  const checkout = await createCheckout(feeId);
  const result = await WebBrowser.openAuthSessionAsync(checkout.hosted_checkout_url, RETURN_URL);

  if (result.type !== 'success' || !result.url) return 'dismissed';

  const parsed = Linking.parse(result.url);
  const path = [parsed.hostname, parsed.path].filter(Boolean).join('/');
  const orderId = parsed.queryParams?.order_id || checkout.order_id || '';
  const outcome = path.includes('payment-cancel') ? 'cancel' : path.includes('payment-success') ? 'success' : 'dismissed';
  if (outcome === 'dismissed') return outcome;

  // On Android the OS may also deliver the deep link to the router; give it a
  // moment and only navigate if that did not happen.
  setTimeout(() => {
    if (handledOrders.has(orderId)) return;
    router.push({ pathname: outcome === 'cancel' ? '/payment-cancel' : '/payment-success', params: { order_id: orderId } });
  }, 400);
  return outcome;
}

/** Polls payment_transactions until the webhook marks it paid (≈30s). */
export async function waitForPayment(orderId, { timeoutMs = 30000, intervalMs = 2500, isCancelled } = {}) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    if (isCancelled?.()) return { status: 'aborted', txn: last };
    const { data } = await supabase
      .from('payment_transactions')
      .select('id, status, amount, currency, fee_id, student_id, gateway_order_id, updated_at')
      .eq('gateway_order_id', orderId)
      .maybeSingle();
    last = data || last;
    if (data?.status === 'paid' || data?.status === 'failed' || data?.status === 'cancelled') {
      return { status: data.status, txn: data };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { status: 'processing', txn: last };
}

export async function receiptForTxn(txnId) {
  if (!txnId) return null;
  const { data } = await supabase
    .from('fee_payments')
    .select('receipt_no, amount, paid_at, method')
    .eq('gateway_txn_id', txnId)
    .maybeSingle();
  return data || null;
}
