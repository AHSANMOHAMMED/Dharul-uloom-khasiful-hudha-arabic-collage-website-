// supabase/functions/payment-checkout/index.ts
// Hosted PayHere checkout page for the mobile app (opened in an in-app
// browser, which cannot POST a form itself).
//
// GET ?order=<gateway_order_id>&sig=<hmac>  → auto-submitting PayHere form.
// The HMAC (issued by create-payment) prevents rendering arbitrary orders.
// Only `pending` transactions are rendered; the amount comes from the DB row.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkoutHash, checkoutSignature, checkoutUrl, escapeHtml } from '../_shared/payhere.ts';

const html = (body: string, status = 200) =>
  new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Kashiful Hudha – Payment</title>
<style>body{font-family:system-ui,sans-serif;background:#f8fafc;color:#064e3b;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{background:#fff;border-radius:16px;padding:28px;max-width:360px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.08)}
button{background:#047857;color:#fff;border:0;border-radius:12px;padding:12px 20px;font-weight:700;font-size:16px}</style></head><body>${body}</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

Deno.serve(async (req) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const url = new URL(req.url);
  const orderId = url.searchParams.get('order') || '';
  const sig = url.searchParams.get('sig') || '';

  const merchantId = Deno.env.get('PAYHERE_MERCHANT_ID') || '';
  const merchantSecret = Deno.env.get('PAYHERE_MERCHANT_SECRET') || '';
  const sandbox = Deno.env.get('PAYHERE_SANDBOX') !== 'false';
  const siteUrl = (Deno.env.get('SITE_URL') || 'http://localhost:3000').replace(/\/$/, '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  if (!orderId || !merchantSecret || sig !== await checkoutSignature(orderId, merchantSecret)) {
    return html('<div class="card"><h2>Invalid payment link</h2><p>Please start the payment again from the app.</p></div>', 400);
  }

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: txn } = await admin
    .from('payment_transactions')
    .select('amount, currency, status, student_id, metadata, gateway_order_id')
    .eq('gateway_order_id', orderId)
    .maybeSingle();

  if (!txn || txn.status !== 'pending') {
    return html('<div class="card"><h2>Payment link expired</h2><p>This payment was already processed or cancelled.</p></div>', 410);
  }

  const { data: student } = await admin.from('profiles').select('full_name, email, phone').eq('id', txn.student_id).maybeSingle();
  const amount = Number(txn.amount).toFixed(2);
  const currency = txn.currency || 'LKR';
  const name = (student?.full_name || 'Student Fee').trim();
  const fields: Record<string, string> = {
    merchant_id: merchantId,
    return_url: `${siteUrl}/payment/success?order_id=${orderId}&app=1`,
    cancel_url: `${siteUrl}/payment/cancel?order_id=${orderId}&app=1`,
    notify_url: `${supabaseUrl}/functions/v1/payhere-notify`,
    order_id: orderId,
    items: `Fees ${txn.metadata?.month ?? ''}`.trim(),
    currency,
    amount,
    first_name: name.split(' ')[0] || 'Student',
    last_name: name.split(' ').slice(1).join(' ') || 'Fee',
    email: student?.email || '',
    phone: student?.phone || '',
    address: 'Kalpitiya',
    city: 'Puttalam',
    country: 'Sri Lanka',
    hash: checkoutHash(merchantId, orderId, amount, currency, merchantSecret),
  };
  const inputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(String(v))}">`)
    .join('');

  return html(`<div class="card"><h2>Redirecting to PayHere…</h2><p>${escapeHtml(currency)} ${escapeHtml(amount)}</p>
<form id="f" method="post" action="${checkoutUrl(sandbox)}">${inputs}<button type="submit">Continue to payment</button></form></div>
<script>document.getElementById('f').submit();</script>`);
});
