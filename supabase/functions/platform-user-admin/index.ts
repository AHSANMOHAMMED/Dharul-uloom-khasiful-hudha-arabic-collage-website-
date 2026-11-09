// Platform operator account actions that need the Supabase Auth admin API:
//   reset_mfa            remove every 2FA factor (lost phone)
//   send_password_reset  e-mail a password-reset link
//   set_sign_in          disable / re-enable sign-in (ban)
// The caller must be the platform super admin, checked AS THE CALLER so the
// database's 2FA gate applies. Super admin accounts cannot be targeted.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { bearerOf, callerIsSuperAdmin } from '../_shared/authz.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = bearerOf(req);
  if (!(await callerIsSuperAdmin(token))) return json({ error: 'Only the platform super admin can do this' }, 403);

  let body: { action?: string; user_id?: string; enabled?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const { action, user_id: userId } = body;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: 'user_id required' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: caller } = await admin.auth.getUser(token);

  const { data: profile } = await admin.from('profiles').select('id, email, role, org_id').eq('id', userId).maybeSingle();
  if (!profile) return json({ error: 'User not found' }, 404);
  if (profile.role === 'super_admin') return json({ error: 'Super admin accounts cannot be changed here' }, 403);
  if (caller?.user?.id === userId) return json({ error: 'You cannot change your own account here' }, 403);

  const log = (act: string, detail: Record<string, unknown> = {}) =>
    admin.rpc('platform_log', {
      p_actor: caller?.user?.id ?? null, p_action: act, p_table: 'profiles',
      p_record: userId, p_org: profile.org_id, p_detail: detail,
    });

  if (action === 'reset_mfa') {
    const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
    if (error) return json({ error: error.message }, 400);
    let removed = 0;
    for (const f of data?.factors ?? []) {
      const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({ userId, id: f.id });
      if (delErr) return json({ error: delErr.message }, 400);
      removed += 1;
    }
    await log('reset_mfa', { removed });
    return json({ ok: true, removed });
  }

  if (action === 'send_password_reset') {
    if (!profile.email) return json({ error: 'This account has no e-mail address' }, 400);
    const site = (Deno.env.get('SITE_URL') || '').replace(/\/$/, '');
    const { error } = await admin.auth.resetPasswordForEmail(profile.email, site ? { redirectTo: `${site}/reset-password` } : undefined);
    if (error) return json({ error: error.message }, 400);
    await log('send_password_reset', { email: profile.email });
    return json({ ok: true });
  }

  if (action === 'set_sign_in') {
    const enabled = body.enabled !== false;
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: enabled ? 'none' : '876000h' });
    if (error) return json({ error: error.message }, 400);
    await log(enabled ? 'enable_sign_in' : 'disable_sign_in');
    return json({ ok: true, enabled });
  }

  return json({ error: 'Unknown action' }, 400);
});
