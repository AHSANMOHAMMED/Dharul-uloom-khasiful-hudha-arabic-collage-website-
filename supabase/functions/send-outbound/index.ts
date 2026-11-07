// Processes pending rows in message_outbox (SMS / WhatsApp / email).
// Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER,
//          WHATSAPP_FROM (e.g. whatsapp:+1415...), RESEND_API_KEY, MAIL_FROM
// Missing secrets → row marked skipped (not failed), so local/dev stays safe.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type OutboxRow = {
  id: string;
  channel: 'sms' | 'whatsapp' | 'email' | 'push';
  to_address: string;
  subject: string | null;
  body: string;
};

async function sendSms(to: string, body: string): Promise<{ ok: boolean; id?: string; error?: string; skipped?: boolean }> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_FROM_NUMBER');
  if (!sid || !token || !from) return { ok: false, skipped: true, error: 'Twilio not configured' };

  const auth = btoa(`${sid}:${token}`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.message || res.statusText };
  return { ok: true, id: json.sid };
}

async function sendWhatsApp(to: string, body: string): Promise<{ ok: boolean; id?: string; error?: string; skipped?: boolean }> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('WHATSAPP_FROM') || Deno.env.get('TWILIO_WHATSAPP_FROM');
  if (!sid || !token || !from) return { ok: false, skipped: true, error: 'WhatsApp/Twilio not configured' };

  const toAddr = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const fromAddr = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
  const auth = btoa(`${sid}:${token}`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: toAddr, From: fromAddr, Body: body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.message || res.statusText };
  return { ok: true, id: json.sid };
}

async function sendEmail(to: string, subject: string | null, body: string): Promise<{ ok: boolean; id?: string; error?: string; skipped?: boolean }> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM') || 'noreply@kashifulhudha.lk';
  if (!apiKey) return { ok: false, skipped: true, error: 'RESEND_API_KEY not configured' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: subject || 'Dharul Uloom notification',
      text: body,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.message || res.statusText };
  return { ok: true, id: json.id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (token !== serviceKey) {
    // Allow staff JWT as well
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'admin' && profile?.role !== 'librarian') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  let limit = 50;
  try {
    const body = await req.json();
    if (body?.limit) limit = Math.min(Number(body.limit) || 50, 200);
  } catch { /* default */ }

  const { data: rows, error } = await admin
    .from('message_outbox')
    .select('id, channel, to_address, subject, body')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of (rows || []) as OutboxRow[]) {
    let result: { ok: boolean; id?: string; error?: string; skipped?: boolean } = { ok: false, error: 'unknown channel' };
    if (row.channel === 'sms') result = await sendSms(row.to_address, row.body);
    else if (row.channel === 'whatsapp') result = await sendWhatsApp(row.to_address, row.body);
    else if (row.channel === 'email') result = await sendEmail(row.to_address, row.subject, row.body);
    else if (row.channel === 'push') result = { ok: false, skipped: true, error: 'push handled client-side' };

    if (result.skipped) {
      skipped++;
      await admin.from('message_outbox').update({
        status: 'skipped',
        error: result.error,
        sent_at: new Date().toISOString(),
      }).eq('id', row.id);
    } else if (result.ok) {
      sent++;
      await admin.from('message_outbox').update({
        status: 'sent',
        provider_id: result.id || null,
        sent_at: new Date().toISOString(),
        error: null,
      }).eq('id', row.id);
    } else {
      failed++;
      await admin.from('message_outbox').update({
        status: 'failed',
        error: result.error || 'send failed',
        sent_at: new Date().toISOString(),
      }).eq('id', row.id);
    }
  }

  return new Response(JSON.stringify({ processed: rows?.length || 0, sent, failed, skipped }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
