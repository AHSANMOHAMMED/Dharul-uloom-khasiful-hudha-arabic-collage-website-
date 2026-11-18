import { supabase, isSupabaseConfigured, fetchWithTimeout } from './supabaseClient';
import { PaymentApiError, paymentErrorMessage } from './paymentErrors';

/**
 * Initiate PayHere checkout for a student fee row.
 * Returns checkout URL + form params to POST to PayHere.
 */
export async function createPaymentCheckout(feeId) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  if (!feeId) throw new PaymentApiError('Fee ID is required', 'fee_id_required', 400);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new PaymentApiError('Not authenticated', 'unauthorized', 401);

  const functionBaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!functionBaseUrl) throw new Error('Supabase function URL is not configured');

  const url = `${functionBaseUrl}/functions/v1/create-payment`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ fee_id: feeId }),
  });

  let json = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }

  if (!res.ok) {
    const code = json.code || null;
    const message = paymentErrorMessage(code, json.error || 'Payment initiation failed', 'en');
    throw new PaymentApiError(message, code, res.status);
  }
  if (!json.checkout_url || !json.params) {
    throw new Error('Payment gateway response is incomplete');
  }
  return json;
}

/** Submit hidden form to PayHere checkout. */
const PAYHERE_URL = /^https:\/\/(sandbox\.)?payhere\.lk\//;

export function redirectToPayHere(checkoutUrl, params) {
  if (!PAYHERE_URL.test(String(checkoutUrl))) throw new Error('Invalid payment checkout URL');
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = checkoutUrl;
  Object.entries(params).forEach(([key, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = String(value ?? '');
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

export async function payFeeOnline(feeId) {
  const { checkout_url, params } = await createPaymentCheckout(feeId);
  if (!checkout_url || typeof checkout_url !== 'string') {
    throw new Error('Invalid payment checkout URL');
  }
  redirectToPayHere(checkout_url, params);
}

/** Poll payment_transactions until webhook settles (or timeout). */
export async function waitForPayment(orderId, { timeoutMs = 30000, intervalMs = 2500, isCancelled } = {}) {
  if (!orderId || !isSupabaseConfigured) return { status: 'processing', txn: null };
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
