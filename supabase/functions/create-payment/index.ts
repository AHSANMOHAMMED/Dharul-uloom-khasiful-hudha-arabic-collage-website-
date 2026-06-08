// supabase/functions/create-payment/index.ts
// Creates a PayHere checkout session for student tuition fees.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import md5 from 'npm:blueimp-md5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const merchantId = Deno.env.get('PAYHERE_MERCHANT_ID') || '';
  const merchantSecret = Deno.env.get('PAYHERE_MERCHANT_SECRET') || '';
  const sandbox = Deno.env.get('PAYHERE_SANDBOX') !== 'false';
  const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:3000';

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  let body: { fee_id: string; student_id?: string } = {};
  try { body = await req.json(); } catch { /* */ }

  if (!body.fee_id) {
    return new Response(JSON.stringify({ error: 'fee_id required' }), { status: 400, headers: corsHeaders });
  }

  const { data: fee, error: feeErr } = await admin
    .from('student_fees')
    .select('*, profiles!student_fees_student_id_fkey(full_name, email)')
    .eq('id', body.fee_id)
    .single();

  if (feeErr || !fee) {
    return new Response(JSON.stringify({ error: 'Fee not found' }), { status: 404, headers: corsHeaders });
  }

  const studentId = fee.student_id as string;

  // Authorization: student pays own fee, parent pays linked child, staff can pay any
  const { data: profile } = await admin.from('profiles').select('role, account_type').eq('id', user.id).single();
  const isStaff = profile?.role === 'admin' || profile?.role === 'librarian';
  const isOwnFee = user.id === studentId;

  let isParent = false;
  if (!isOwnFee && !isStaff) {
    const { data: link } = await admin
      .from('parent_children')
      .select('child_id')
      .eq('parent_id', user.id)
      .eq('child_id', studentId)
      .maybeSingle();
    isParent = Boolean(link);
  }

  if (!isOwnFee && !isParent && !isStaff) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
  }

  const remaining = Number(fee.total_due) - Number(fee.paid_amount);
  if (remaining <= 0 || fee.status === 'completed') {
    return new Response(JSON.stringify({ error: 'No balance due' }), { status: 400, headers: corsHeaders });
  }

  const orderId = `KH-${fee.id.slice(0, 8)}-${Date.now()}`;
  const amountFormatted = remaining.toFixed(2);
  const currency = 'LKR';

  const { data: txn, error: txnErr } = await admin.from('payment_transactions').insert({
    student_id: studentId,
    fee_id: fee.id,
    payer_id: user.id,
    amount: remaining,
    currency,
    gateway: 'payhere',
    status: 'pending',
    gateway_order_id: orderId,
    metadata: { month: fee.month },
  }).select().single();

  if (txnErr) {
    return new Response(JSON.stringify({ error: txnErr.message }), { status: 500, headers: corsHeaders });
  }

  const secretHash = md5(merchantSecret);
  const hash = md5(merchantId + orderId + amountFormatted + currency + secretHash);

  const studentProfile = fee.profiles as { full_name?: string; email?: string } | null;
  const checkoutUrl = sandbox
    ? 'https://sandbox.payhere.lk/pay/checkout'
    : 'https://www.payhere.lk/pay/checkout';

  return new Response(JSON.stringify({
    checkout_url: checkoutUrl,
    params: {
      merchant_id: merchantId,
      return_url: `${siteUrl}/payment/success?order_id=${orderId}`,
      cancel_url: `${siteUrl}/payment/cancel?order_id=${orderId}`,
      notify_url: `${supabaseUrl}/functions/v1/payhere-notify`,
      order_id: orderId,
      items: `Tuition ${fee.month}`,
      currency,
      amount: amountFormatted,
      first_name: studentProfile?.full_name?.split(' ')[0] || 'Student',
      last_name: studentProfile?.full_name?.split(' ').slice(1).join(' ') || 'Fee',
      email: studentProfile?.email || user.email,
      phone: '',
      address: 'Kalpitiya',
      city: 'Puttalam',
      country: 'Sri Lanka',
      hash,
    },
    transaction_id: txn.id,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
