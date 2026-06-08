import { supabase, isSupabaseConfigured } from './supabaseClient';

/**
 * Initiate PayHere checkout for a student fee row.
 * Returns checkout URL + form params to POST to PayHere.
 */
export async function createPaymentCheckout(feeId) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  if (!feeId) throw new Error('Fee ID is required');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const functionBaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!functionBaseUrl) throw new Error('Supabase function URL is not configured');

  const url = `${functionBaseUrl}/functions/v1/create-payment`;
  const res = await fetch(url, {
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

  if (!res.ok) throw new Error(json.error || 'Payment initiation failed');
  if (!json.checkout_url || !json.params) {
    throw new Error('Payment gateway response is incomplete');
  }
  return json;
}

/** Submit hidden form to PayHere checkout. */
export function redirectToPayHere(checkoutUrl, params) {
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
