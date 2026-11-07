// supabase/functions/payhere-notify/index.ts
// PayHere payment notification webhook (server-to-server, no user JWT).
//
// Security:
//   * MD5 signature verified against the merchant secret (constant-time compare)
//   * merchant_id must match ours
//   * settlement is delegated to the idempotent SQL function
//     apply_gateway_payment(), which locks the transaction row, rejects amount /
//     currency tampering, ignores duplicate notifications (PayHere retries) and
//     posts the receipt to the ledger (fee_payments + journal).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { triggerOutboundWorker } from '../_shared/notify.ts';
import { notifySignature, safeEqual } from '../_shared/payhere.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const merchantId = Deno.env.get('PAYHERE_MERCHANT_ID') || '';
  const merchantSecret = Deno.env.get('PAYHERE_MERCHANT_SECRET') || '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!merchantId || !merchantSecret) {
    console.error('[payhere-notify] PAYHERE_MERCHANT_ID / PAYHERE_MERCHANT_SECRET not configured');
    return new Response('Gateway not configured', { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const get = (k: string) => form.get(k)?.toString() ?? '';

  const notifiedMerchant = get('merchant_id');
  const orderId = get('order_id');
  const payhereAmount = get('payhere_amount');
  const payhereCurrency = get('payhere_currency');
  const statusCode = get('status_code');
  const md5sig = get('md5sig').toUpperCase();
  const paymentId = get('payment_id');

  const localSig = notifySignature(notifiedMerchant, orderId, payhereAmount, payhereCurrency, statusCode, merchantSecret);

  if (notifiedMerchant !== merchantId || !safeEqual(localSig, md5sig)) {
    console.error('[payhere-notify] Invalid signature or merchant', { orderId });
    return new Response('Invalid signature', { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc('apply_gateway_payment', {
    p_order_id: orderId,
    p_payment_id: paymentId,
    p_amount: Number(payhereAmount),
    p_currency: payhereCurrency,
    p_status_code: statusCode,
  });

  if (error) {
    // 500 makes PayHere retry later; the SQL function is idempotent.
    console.error('[payhere-notify] apply_gateway_payment failed', error);
    return new Response('Settlement error', { status: 500 });
  }

  console.log('[payhere-notify]', orderId, data);
  if (data?.ok === false && data?.error === 'order_not_found') {
    return new Response('Order not found', { status: 404 });
  }

  if (data?.receipt_no && !data?.duplicate) {
    await triggerOutboundWorker(supabaseUrl, serviceKey);
  }
  return new Response('OK');
});
