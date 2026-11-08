// supabase/functions/send-outbound/index.ts
// Drains message_outbox: SMS, WhatsApp, e-mail and native push.
//
// SMS providers (SMS_PROVIDER):
//   notifylk  – Notify.lk (Sri Lanka, masked sender ID):  NOTIFYLK_USER_ID, NOTIFYLK_API_KEY
//   textlk    – Text.lk   (Sri Lanka, masked sender ID):  TEXTLK_API_TOKEN
//   twilio    – Twilio (default):  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
// Sender mask: organizations.settings.sms_sender_id (per college) → SMS_SENDER_ID.
// WhatsApp: Twilio (WHATSAPP_FROM). E-mail: Resend (RESEND_API_KEY, MAIL_FROM) —
// receipt messages carry the exact receipt PDF as an attachment.
// Push: Expo push service (EXPO_ACCESS_TOKEN optional).
// SITE_URL is used to append the receipt link to SMS / WhatsApp.
//
// Concurrency: rows are claimed with claim_outbox_batch() (FOR UPDATE SKIP
// LOCKED) so several workers can run at once without double-sending.
// Every provider call has an 8 s timeout to stay inside the 10 s API budget.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callerIsAdmin } from '../_shared/authz.ts';
import { base64, buildReceiptPdf } from '../_shared/receiptPdf.ts';
import { normalizeLkPhone } from '../_shared/phone.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

type Result = { ok: boolean; id?: string; error?: string; skipped?: boolean; blocked?: boolean; staleToken?: boolean };
type OutboxRow = {
  id: string;
  org_id: string;
  channel: 'sms' | 'whatsapp' | 'email' | 'push';
  to_address: string;
  subject: string | null;
  body: string;
  attempts: number;
  // deno-lint-ignore no-explicit-any
  metadata: Record<string, any> | null;
};

const TIMEOUT_MS = 8000;
async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

// ── SMS ─────────────────────────────────────────────────────────────────────
async function smsNotifyLk(to: string, body: string, sender: string): Promise<Result> {
  const user = Deno.env.get('NOTIFYLK_USER_ID');
  const key = Deno.env.get('NOTIFYLK_API_KEY');
  if (!user || !key) return { ok: false, blocked: true, error: 'Notify.lk not configured' };
  const q = new URLSearchParams({ user_id: user, api_key: key, sender_id: sender || 'NotifyDEMO', to: normalizeLkPhone(to), message: body });
  const res = await timedFetch(`https://app.notify.lk/api/v1/send?${q}`, { method: 'GET' });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.status !== 'success') return { ok: false, error: j.message || j.errors?.[0] || `notify.lk ${res.status}` };
  return { ok: true, id: String(j.data?.id ?? '') };
}

async function smsTextLk(to: string, body: string, sender: string): Promise<Result> {
  const token = Deno.env.get('TEXTLK_API_TOKEN');
  if (!token) return { ok: false, blocked: true, error: 'Text.lk not configured' };
  const res = await timedFetch('https://app.text.lk/api/v3/sms/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ recipient: normalizeLkPhone(to), sender_id: sender, type: 'plain', message: body }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.status === 'error') return { ok: false, error: j.message || `text.lk ${res.status}` };
  return { ok: true, id: String(j.data?.uid ?? '') };
}

async function smsTwilio(to: string, body: string, sender: string): Promise<Result> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  // An alphanumeric sender (mask) is used when the country allows it, else the number.
  const from = sender || Deno.env.get('TWILIO_FROM_NUMBER');
  if (!sid || !token || !from) return { ok: false, blocked: true, error: 'Twilio not configured' };
  const res = await timedFetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: `+${normalizeLkPhone(to)}`, From: from, Body: body }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: j.message || res.statusText };
  return { ok: true, id: j.sid };
}

function sendSms(to: string, body: string, sender: string): Promise<Result> {
  const provider = (Deno.env.get('SMS_PROVIDER') || 'twilio').toLowerCase();
  if (provider === 'notifylk') return smsNotifyLk(to, body, sender);
  if (provider === 'textlk') return smsTextLk(to, body, sender);
  return smsTwilio(to, body, sender);
}

async function sendWhatsApp(to: string, body: string): Promise<Result> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('WHATSAPP_FROM') || Deno.env.get('TWILIO_WHATSAPP_FROM');
  if (!sid || !token || !from) return { ok: false, blocked: true, error: 'WhatsApp/Twilio not configured' };
  const res = await timedFetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      To: to.startsWith('whatsapp:') ? to : `whatsapp:+${normalizeLkPhone(to)}`,
      From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
      Body: body,
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: j.message || res.statusText };
  return { ok: true, id: j.sid };
}

// ── E-mail (with optional PDF attachment) ──────────────────────────────────
async function sendEmail(to: string, subject: string | null, body: string,
                         attachment?: { filename: string; content: string }): Promise<Result> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM') || 'noreply@kashifulhudha.lk';
  if (!apiKey) return { ok: false, blocked: true, error: 'RESEND_API_KEY not configured' };
  const res = await timedFetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to: [to], subject: subject || 'College notification', text: body,
      ...(attachment ? { attachments: [attachment] } : {}),
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: j.message || res.statusText };
  return { ok: true, id: j.id };
}

// ── Native push (Expo) ─────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function sendExpoPush(token: string, title: string | null, body: string, data?: Record<string, any>): Promise<Result> {
  if (!/^(Exponent|Expo)PushToken\[.+\]$/.test(token)) return { ok: false, skipped: true, error: 'not an Expo push token' };
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await timedFetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify({ to: token, title: title || 'Kashiful Hudha', body, sound: 'default', priority: 'high', data: data || {} }),
  });
  const j = await res.json().catch(() => ({}));
  const ticket = Array.isArray(j?.data) ? j.data[0] : j?.data;
  if (!res.ok || ticket?.status === 'error') {
    const error = ticket?.details?.error || ticket?.message || j?.errors?.[0]?.message || `push ${res.status}`;
    return {
      ok: false,
      skipped: error === 'DeviceNotRegistered',
      staleToken: error === 'DeviceNotRegistered',
      error
    };
  }
  return { ok: true, id: ticket?.id };
}

async function reconcileExpoReceipts(admin: SupabaseClient<any, 'public', any>) {
  const { data: rows, error } = await admin
    .from('message_outbox')
    .select('id, provider_id, to_address')
    .eq('channel', 'push')
    .eq('status', 'sent')
    .not('provider_id', 'is', null)
    .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(100);
  if (error || !rows?.length) return;

  const response = await timedFetch('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ids: rows.map((row) => row.provider_id) }),
  });
  if (!response.ok) return;
  const payload = await response.json().catch(() => ({}));
  const receipts = payload?.data || {};

  for (const row of rows) {
    const receipt = receipts[row.provider_id];
    if (!receipt || receipt.status === 'ok') continue;
    const errorCode = receipt.details?.error || receipt.message || 'Expo push delivery failed';
    if (errorCode === 'DeviceNotRegistered') {
      await admin.from('device_push_tokens').delete().eq('token', row.to_address);
      await admin.from('message_outbox')
        .update({ status: 'skipped', error: errorCode })
        .eq('id', row.id);
    } else {
      await admin.from('message_outbox')
        .update({ status: 'failed', error: errorCode })
        .eq('id', row.id);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const siteUrl = (Deno.env.get('SITE_URL') || '').replace(/\/$/, '');
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const authHeader = req.headers.get('Authorization') || '';
  const bearer = authHeader.replace(/^Bearer\s+/i, '');
  if (bearer !== serviceKey) {
    const { data: { user } } = await admin.auth.getUser(bearer);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (!(await callerIsAdmin(bearer))) return json({ error: 'Forbidden' }, 403);
  }

  let limit = 50;
  try {
    const body = await req.json();
    if (body?.limit) limit = Math.min(Number(body.limit) || 50, 200);
  } catch { /* default */ }

  const started = Date.now();
  const { data: rows, error } = await admin.rpc('claim_outbox_batch', { p_limit: limit });
  if (error) return json({ error: error.message }, 500);

  // per-org SMS sender mask
  const orgIds = [...new Set(((rows || []) as OutboxRow[]).map((r) => r.org_id))];
  const senders: Record<string, string> = {};
  if (orgIds.length) {
    const { data: orgs } = await admin.from('organizations').select('id, code, settings').in('id', orgIds);
    for (const o of orgs || []) senders[o.id] = o.settings?.sms_sender_id || Deno.env.get('SMS_SENDER_ID') || o.code || '';
  }

  const pdfCache = new Map<string, { filename: string; content: string } | null>();
  async function receiptAttachment(token: string) {
    if (!pdfCache.has(token)) {
      const { data } = await admin.rpc('fee_receipt_by_token', { p_token: token });
      if (!data) pdfCache.set(token, null);
      else {
        const pdf = await buildReceiptPdf(data, { verifyUrl: siteUrl ? `${siteUrl}/r/${token}` : undefined });
        pdfCache.set(token, { filename: `receipt-${data.receipt_no}.pdf`, content: base64(pdf) });
      }
    }
    return pdfCache.get(token) || undefined;
  }

  let sent = 0, failed = 0, skipped = 0;
  for (const row of (rows || []) as OutboxRow[]) {
    // Stop early rather than exceed the request budget; remaining rows stay claimed and
    // are retried by the next run after the 5-minute claim window.
    if (Date.now() - started > 45_000) break;
    const meta = row.metadata || {};
    const receiptToken: string | undefined = meta.token || meta.receipt_token || meta.data?.token;
    const link = meta.type === 'fee_receipt' && receiptToken && siteUrl ? ` ${siteUrl}/r/${receiptToken}` : '';
    let result: Result;
    try {
      if (row.channel === 'sms') result = await sendSms(row.to_address, row.body + link, senders[row.org_id] || '');
      else if (row.channel === 'whatsapp') result = await sendWhatsApp(row.to_address, row.body + link);
      else if (row.channel === 'email') {
        const att = meta.attach_receipt && receiptToken ? await receiptAttachment(receiptToken) : undefined;
        result = await sendEmail(row.to_address, row.subject, row.body + (link ? `\n\nReceipt:${link}` : ''), att);
      } else if (row.channel === 'push') {
        result = await sendExpoPush(row.to_address, row.subject, row.body, { ...(meta.data || {}), link: meta.link, notification_id: meta.notification_id });
      } else result = { ok: false, error: 'unknown channel' };
    } catch (e) {
      result = { ok: false, error: (e as Error).name === 'TimeoutError' ? 'provider timeout (8s)' : (e as Error).message };
    }

    const now = new Date().toISOString();
    if (result.blocked) {
      skipped++;
      await admin.from('message_outbox').update({ status: 'blocked', error: result.error, sent_at: null }).eq('id', row.id);
    } else if (result.staleToken) {
      skipped++;
      await admin.from('device_push_tokens').delete().eq('token', row.to_address);
      await admin.from('message_outbox').update({ status: 'skipped', error: result.error, sent_at: now }).eq('id', row.id);
    } else if (result.skipped) {
      skipped++;
      await admin.from('message_outbox').update({ status: 'skipped', error: result.error, sent_at: now }).eq('id', row.id);
    } else if (result.ok) {
      sent++;
      await admin.from('message_outbox').update({ status: 'sent', provider_id: result.id || null, sent_at: now, error: null }).eq('id', row.id);
    } else {
      failed++;
      // retry later; give up after 5 attempts
      await admin.from('message_outbox')
        .update({ status: (row.attempts ?? 1) >= 5 ? 'failed' : 'pending', error: result.error || 'send failed' })
        .eq('id', row.id);
    }
  }

  try {
    await reconcileExpoReceipts(admin);
  } catch (error) {
    console.error('Expo receipt reconciliation failed', error);
  }

  return json({ processed: rows?.length || 0, sent, failed, skipped, ms: Date.now() - started });
});
