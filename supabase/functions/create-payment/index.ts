// supabase/functions/create-payment/index.ts
// Creates a PayHere checkout session for a student fee invoice.
//
// Body: { fee_id: uuid, client?: 'web' | 'mobile' }
// Returns: { checkout_url, params, transaction_id, hosted_checkout_url }
//   * web     → POST `params` to `checkout_url` (PayFeeButton)
//   * mobile  → open `hosted_checkout_url` (auto-submitting form) in an auth
//               session; PayHere returns to SITE_URL/payment/*?app=1 which
//               deep-links back to kashifulhudha://payment-*.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkoutHash, checkoutSignature, checkoutUrl } from '../_shared/payhere.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const merchantId = Deno.env.get('PAYHERE_MERCHANT_ID') || '';
  const merchantSecret = Deno.env.get('PAYHERE_MERCHANT_SECRET') || '';
  const sandbox = Deno.env.get('PAYHERE_SANDBOX') !== 'false';
  const siteUrl = (Deno.env.get('SITE_URL') || 'http://localhost:3000').replace(/\/$/, '');

  if (!merchantId || !merchantSecret) return json({ error: 'Payment gateway is not configured' }, 503);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

  let body: { fee_id?: string; client?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }
  if (!body.fee_id) return json({ error: 'fee_id required' }, 400);
  const client = body.client === 'mobile' ? 'mobile' : 'web';

  const { data: fee, error: feeErr } = await admin
    .from('student_fees')
    .select('id, org_id, student_id, month, invoice_no, total_due, paid_amount, status, currency, cancelled_at')
    .eq('id', body.fee_id)
    .maybeSingle();
  if (feeErr || !fee) return json({ error: 'Fee not found' }, 404);

  // Authorization: own fee, linked parent, or an admin of the same organization.
  const { data: profile } = await admin
    .from('profiles').select('role, org_id').eq('id', user.id).maybeSingle();
  const isOwnFee = user.id === fee.student_id;
  const isOrgAdmin = (profile?.role === 'admin' && profile?.org_id === fee.org_id) || profile?.role === 'super_admin';
  let isParent = false;
  if (!isOwnFee && !isOrgAdmin) {
    const { data: link } = await admin
      .from('parent_children').select('child_id')
      .eq('parent_id', user.id).eq('child_id', fee.student_id).maybeSingle();
    isParent = Boolean(link);
  }
  if (!isOwnFee && !isParent && !isOrgAdmin) return json({ error: 'Forbidden' }, 403);

  const remaining = Math.round((Number(fee.total_due) - Number(fee.paid_amount)) * 100) / 100;
  if (fee.cancelled_at || fee.status === 'cancelled') return json({ error: 'Invoice is cancelled' }, 400);
  if (remaining <= 0 || fee.status === 'completed') return json({ error: 'No balance due' }, 400);

  const { data: student } = await admin
    .from('profiles').select('full_name, email, phone').eq('id', fee.student_id).maybeSingle();

  const orderId = `KH-${fee.id.slice(0, 8)}-${Date.now()}`;
  const amountFormatted = remaining.toFixed(2);
  const currency = fee.currency || 'LKR';

  const { data: txn, error: txnErr } = await admin.from('payment_transactions').insert({
    org_id: fee.org_id,
    student_id: fee.student_id,
    fee_id: fee.id,
    payer_id: user.id,
    amount: remaining,
    currency,
    gateway: 'payhere',
    status: 'pending',
    gateway_order_id: orderId,
    metadata: { month: fee.month, invoice_no: fee.invoice_no, client },
  }).select('id').single();
  if (txnErr) return json({ error: txnErr.message }, 500);

  const appFlag = client === 'mobile' ? '&app=1' : '';
  const fullName = (student?.full_name || 'Student Fee').trim();
  const params = {
    merchant_id: merchantId,
    return_url: `${siteUrl}/payment/success?order_id=${orderId}${appFlag}`,
    cancel_url: `${siteUrl}/payment/cancel?order_id=${orderId}${appFlag}`,
    notify_url: `${supabaseUrl}/functions/v1/payhere-notify`,
    order_id: orderId,
    items: `Fees ${fee.month}${fee.invoice_no ? ` (${fee.invoice_no})` : ''}`,
    currency,
    amount: amountFormatted,
    first_name: fullName.split(' ')[0] || 'Student',
    last_name: fullName.split(' ').slice(1).join(' ') || 'Fee',
    email: student?.email || user.email || '',
    phone: student?.phone || '',
    address: 'Kalpitiya',
    city: 'Puttalam',
    country: 'Sri Lanka',
    hash: checkoutHash(merchantId, orderId, amountFormatted, currency, merchantSecret),
  };

  const sig = await checkoutSignature(orderId, merchantSecret);
  return json({
    checkout_url: checkoutUrl(sandbox),
    params,
    transaction_id: txn.id,
    order_id: orderId,
    hosted_checkout_url: `${supabaseUrl}/functions/v1/payment-checkout?order=${encodeURIComponent(orderId)}&sig=${sig}`,
  });
});
