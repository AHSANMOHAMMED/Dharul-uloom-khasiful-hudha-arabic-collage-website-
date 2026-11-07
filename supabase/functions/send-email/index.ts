// Generic transactional email via Resend (contact form / admissions).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('MAIL_FROM') || 'noreply@kashifulhudha.lk';
  const notifyTo = Deno.env.get('MAIL_NOTIFY_TO') || from;

  let body: { to?: string; subject?: string; text?: string; html?: string; type?: string } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // This endpoint is public (contact form). Anonymous callers may ONLY notify
  // the college inbox, as plain text — otherwise it would be an open relay.
  // Custom recipients / HTML require the service role or an admin JWT.
  let trusted = false;
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (token) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (token === serviceKey) {
      trusted = true;
    } else {
      const admin = createClient(supabaseUrl, serviceKey);
      const { data: { user } } = await admin.auth.getUser(token);
      if (user) {
        const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
        trusted = profile?.role === 'admin' || profile?.role === 'super_admin';
      }
    }
  }

  const clip = (v: string, n: number) => (v.length > n ? `${v.slice(0, n)}…` : v);
  const subject = clip(trusted ? body.subject || 'College notification' : `[Website] ${body.subject || 'Message'}`, 200);
  const text = clip(body.text || '', trusted ? 50000 : 5000);
  const to = trusted && body.to ? body.to : notifyTo;
  if (!trusted) body.html = undefined;

  // Always record in outbox for audit when Supabase is available
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);
    await admin.from('message_outbox').insert({
      channel: 'email',
      to_address: to,
      subject,
      body: text,
      status: apiKey ? 'pending' : 'skipped',
      metadata: { type: body.type || 'manual' },
      error: apiKey ? null : 'RESEND_API_KEY not configured',
    });
  } catch (e) {
    console.error('[send-email] outbox', e);
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'RESEND_API_KEY missing' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html: body.html,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return new Response(JSON.stringify({ error: json.message || 'send failed' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, id: json.id }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
