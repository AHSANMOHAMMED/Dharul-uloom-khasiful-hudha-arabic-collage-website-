// supabase/functions/create-payment/index.ts
// Creates a PayHere checkout session for a student fee invoice.
//
// Body: { fee_id: uuid, client?: 'web' | 'mobile' }
// Returns: { checkout_url, params, transaction_id, hosted_checkout_url }
//   * web     → POST `params` to `checkout_url` (PayFeeButton)
//   * mobile  → open `hosted_checkout_url` (auto-submitting form) in an auth
//               session; PayHere returns to SITE_URL/payment/*?app=1 which
//               deep-links back to kashifulhudha://payment-*.
//
// Error body always includes { error: string, code: string } for client mapping.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { bearerOf, callerMfaOk } from '../_shared/authz.ts';
import { checkoutHash, checkoutSignature, checkoutUrl } from '../_shared/payhere.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const fail = (status: number, code: string, error: string) => json({ error, code }, status);

/** Malformed JSON ⇒ deny. Missing `fees` key ⇒ allow (matches DB default). Explicit false ⇒ deny. */
function feesPermissionAllowed(permissions: unknown): boolean {
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) return false;
  const fees = (permissions as Record<string, unknown>).fees;
  if (fees === undefined || fees === null) return true;
  return fees === true || fees === 'true';
}

// deno-lint-ignore no-explicit-any
async function orgPaymentsEnabled(admin: any, orgId: string): Promise<boolean> {
  const [{ data: platform }, { data: org }] = await Promise.all([
    admin.from('platform_settings').select('features').eq('id', 1).maybeSingle(),
    admin.from('organizations').select('settings').eq('id', orgId).maybeSingle(),
  ]);
  // Mirrors resolve_org_features: defaults ⊕ global ⊕ org.settings.features
  const platformFeatures =
    platform?.features && typeof platform.features === 'object' ? platform.features as Record<string, unknown> : {};
  const orgFeatures =
    org?.settings?.features && typeof org.settings.features === 'object'
      ? org.settings.features as Record<string, unknown>
      : {};
  const merged: Record<string, unknown> = { payments: true, ...platformFeatures, ...orgFeatures };
  return merged.payments !== false && merged.payments !== 'false';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Method not allowed');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const merchantId = Deno.env.get('PAYHERE_MERCHANT_ID') || '';
  const merchantSecret = Deno.env.get('PAYHERE_MERCHANT_SECRET') || '';
  const sandbox = Deno.env.get('PAYHERE_SANDBOX') !== 'false';
  const configuredSiteUrl = (Deno.env.get('SITE_URL') || '').trim().replace(/\/$/, '');

  if (!merchantId || !merchantSecret || !configuredSiteUrl) {
    return fail(503, 'gateway_not_configured', 'Payment gateway is not configured');
  }
  let siteUrl: URL;
  try {
    siteUrl = new URL(configuredSiteUrl);
    if (!['http:', 'https:'].includes(siteUrl.protocol)) throw new Error('Unsupported protocol');
  } catch {
    return fail(503, 'return_url_misconfigured', 'Payment return URL is not configured correctly');
  }
  const siteOrigin = siteUrl.toString().replace(/\/$/, '');

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return fail(401, 'unauthorized', 'Unauthorized');

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return fail(401, 'unauthorized', 'Unauthorized');

  let body: { fee_id?: string; client?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }
  if (!body.fee_id) return fail(400, 'fee_id_required', 'fee_id required');
  const client = body.client === 'mobile' ? 'mobile' : 'web';

  const { data: fee, error: feeErr } = await admin
    .from('student_fees')
    .select('id, org_id, student_id, month, invoice_no, total_due, paid_amount, status, currency, cancelled_at')
    .eq('id', body.fee_id)
    .maybeSingle();
  if (feeErr || !fee) return fail(404, 'fee_not_found', 'Fee not found');

  if (!(await orgPaymentsEnabled(admin, fee.org_id))) {
    return fail(403, 'payments_disabled', 'Online payments are disabled for this organization');
  }

  // Authorization: own fee, active parent with fees permission, or MFA'd org admin.
  const { data: profile } = await admin
    .from('profiles').select('role, org_id, full_name, email, phone').eq('id', user.id).maybeSingle();
  const isOwnFee = user.id === fee.student_id;
  const isOrgAdmin =
    ((profile?.role === 'admin' && profile?.org_id === fee.org_id) || profile?.role === 'super_admin') &&
    (await callerMfaOk(bearerOf(req)));

  let isParent = false;
  if (!isOwnFee && !isOrgAdmin) {
    const { data: link } = await admin
      .from('parent_children')
      .select('child_id, status, permissions, org_id')
      .eq('parent_id', user.id)
      .eq('child_id', fee.student_id)
      .eq('org_id', fee.org_id)
      .maybeSingle();

    if (!link) {
      return fail(403, 'forbidden', 'Forbidden');
    }
    if (link.status !== 'active') {
      return fail(403, 'guardian_inactive', 'Guardian link is not active');
    }
    if (!feesPermissionAllowed(link.permissions)) {
      return fail(403, 'fees_permission_denied', 'Guardian is not permitted to pay fees');
    }
    isParent = true;
  }
  if (!isOwnFee && !isParent && !isOrgAdmin) return fail(403, 'forbidden', 'Forbidden');

  const remaining = Math.round((Number(fee.total_due) - Number(fee.paid_amount)) * 100) / 100;
  if (fee.cancelled_at || fee.status === 'cancelled') {
    return fail(400, 'invoice_cancelled', 'Invoice is cancelled');
  }
  if (remaining <= 0 || fee.status === 'completed') {
    return fail(400, 'no_balance', 'No balance due');
  }
  if (fee.status !== 'unpaid' && fee.status !== 'partial') {
    return fail(400, 'invoice_not_payable', 'Invoice is not payable online');
  }

  // Same rule as the counter / web dashboards: online pay must target the oldest open month.
  const { data: olderOpen } = await admin
    .from('student_fees')
    .select('id, month')
    .eq('student_id', fee.student_id)
    .eq('org_id', fee.org_id)
    .in('status', ['unpaid', 'partial'])
    .is('cancelled_at', null)
    .lt('month', fee.month)
    .order('month', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (olderOpen?.id) {
    return fail(400, 'pay_oldest_first', 'Please pay the oldest unpaid invoice first');
  }

  // Supersede any open pending checkouts for this invoice (stale or duplicate).
  await admin
    .from('payment_transactions')
    .update({ status: 'cancelled' })
    .eq('fee_id', fee.id)
    .eq('status', 'pending');

  const { data: student } = await admin
    .from('profiles').select('full_name, email, phone').eq('id', fee.student_id).maybeSingle();

  const { data: org } = await admin
    .from('organizations')
    .select('name_en, address, country')
    .eq('id', fee.org_id)
    .maybeSingle();

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
  if (txnErr) {
    console.error('[create-payment]', txnErr);
    return fail(500, 'txn_create_failed', 'Could not start payment');
  }

  const appFlag = client === 'mobile' ? '&app=1' : '';
  const fullName = (student?.full_name || profile?.full_name || 'Student Fee').trim();
  // Prefer payer contact for parent-paid invoices; fall back to student / auth email.
  const email = (isParent ? profile?.email : null) || student?.email || user.email || profile?.email || '';
  const phone = (isParent ? profile?.phone : null) || student?.phone || profile?.phone || '';
  const params = {
    merchant_id: merchantId,
    return_url: `${siteOrigin}/payment/success?order_id=${orderId}${appFlag}`,
    cancel_url: `${siteOrigin}/payment/cancel?order_id=${orderId}${appFlag}`,
    notify_url: `${supabaseUrl}/functions/v1/payhere-notify`,
    order_id: orderId,
    items: `Fees ${fee.month}${fee.invoice_no ? ` (${fee.invoice_no})` : ''}`,
    currency,
    amount: amountFormatted,
    first_name: fullName.split(' ')[0] || 'Student',
    last_name: fullName.split(' ').slice(1).join(' ') || 'Fee',
    email,
    phone,
    address: (org?.address || 'Kalpitiya').toString(),
    city: 'Puttalam',
    country: (org?.country === 'LK' ? 'Sri Lanka' : (org?.country || 'Sri Lanka')).toString(),
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
