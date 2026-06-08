// supabase/functions/payhere-notify/index.ts
// PayHere payment notification webhook.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import md5 from 'npm:blueimp-md5';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const merchantId = Deno.env.get('PAYHERE_MERCHANT_ID') || '';
  const merchantSecret = Deno.env.get('PAYHERE_MERCHANT_SECRET') || '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const form = await req.formData();
  const get = (k: string) => form.get(k)?.toString() ?? '';

  const orderId = get('order_id');
  const payhereAmount = get('payhere_amount');
  const payhereCurrency = get('payhere_currency');
  const statusCode = get('status_code');
  const md5sig = get('md5sig');
  const paymentId = get('payment_id');

  const secretHash = md5(merchantSecret);
  const localSig = md5(merchantId + orderId + payhereAmount + payhereCurrency + statusCode + secretHash);

  if (localSig !== md5sig) {
    console.error('[payhere-notify] Invalid signature');
    return new Response('Invalid signature', { status: 400 });
  }

  const { data: txn } = await admin
    .from('payment_transactions')
    .select('*')
    .eq('gateway_order_id', orderId)
    .maybeSingle();

  if (!txn) {
    return new Response('Order not found', { status: 404 });
  }

  if (statusCode !== '2') {
    await admin.from('payment_transactions').update({ status: 'failed', gateway_payment_id: paymentId }).eq('id', txn.id);
    return new Response('Payment failed recorded');
  }

  const paidAmount = parseFloat(payhereAmount);
  const { data: fee } = await admin.from('student_fees').select('*').eq('id', txn.fee_id).single();

  if (fee) {
    const newPaid = Number(fee.paid_amount) + paidAmount;
    const totalDue = Number(fee.total_due);
    const newStatus = newPaid >= totalDue ? 'completed' : newPaid > 0 ? 'partial' : 'unpaid';
    const payments = [...(fee.payments || []), {
      amount: paidAmount,
      date: new Date().toISOString(),
      note: `PayHere ${paymentId}`,
      gateway: 'payhere',
    }];

    await admin.from('student_fees').update({
      paid_amount: newPaid,
      status: newStatus,
      payments,
    }).eq('id', fee.id);
  }

  await admin.from('payment_transactions').update({
    status: 'paid',
    gateway_payment_id: paymentId,
  }).eq('id', txn.id);

  await admin.from('notifications').insert({
    user_id: txn.student_id,
    title: 'Payment received',
    message: `Your tuition payment of LKR ${paidAmount} was received successfully.`,
  });

  return new Response('OK');
});
