// supabase/functions/generate-monthly-fees/index.ts
// Monthly invoice generator.
//
// All billing logic (fee structures per class, hostel charges, concessions,
// ledger posting, student + parent notifications, idempotency) lives in the
// SQL function public.generate_monthly_invoices() — see
// supabase/migrations/0018_student_finance.sql. This function is a thin
// trigger for it:
//
//   * Scheduled run (cron) → Authorization: Bearer <service_role key>
//       generates for EVERY active organization.
//   * Staff click (treasurer / accountant / admin) → user JWT
//       the RPC runs as that user, so the database enforces the role and
//       restricts generation to the caller's organization.
//
// Body (optional): { "month": "YYYY-MM", "default_fee": 2000 }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { triggerOutboundWorker } from '../_shared/notify.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const BATCH = 300;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Unauthorized' }, 401);

  let body: { month?: string; default_fee?: number } = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const now = new Date();
  const month = body.month ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return json({ error: 'month must be YYYY-MM' }, 400);
  const defaultFee = typeof body.default_fee === 'number' ? body.default_fee : null;

  try {
    if (token === serviceKey) {
      // Scheduled: every active tenant.
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const { data: orgs, error: orgErr } = await admin
        .from('organizations').select('id, slug').in('status', ['trial', 'active']);
      if (orgErr) throw orgErr;

      const results: Record<string, unknown> = {};
      let generated = 0;
      for (const org of orgs || []) {
        // bounded batches: each RPC stays ~1 s regardless of college size
        let orgGenerated = 0;
        let last: Record<string, unknown> | null = null;
        for (let round = 0; round < 500; round++) {
          const { data, error } = await admin.rpc('generate_monthly_invoices', {
            p_month: month, p_org: org.id, p_default_tuition: defaultFee, p_limit: BATCH,
          });
          if (error) { last = { error: error.message }; break; }
          last = data;
          orgGenerated += Number(data?.generated || 0);
          if (!Number(data?.remaining) || !Number(data?.generated)) break;
        }
        results[org.slug] = { ...(last || {}), generated: orgGenerated };
        generated += orgGenerated;
      }
      if (generated > 0) await triggerOutboundWorker(supabaseUrl, serviceKey);
      return json({ month, generated, organizations: results });
    }

    // Interactive: run as the caller (DB checks is_finance_staff + tenant).
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    // Interactive: batches until done or the 7 s response budget is used;
    // the caller repeats while `remaining` > 0 (UI shows progress).
    const started = Date.now();
    let generated = 0;
    // deno-lint-ignore no-explicit-any
    let data: any = null;
    while (Date.now() - started < 7000) {
      const res = await userClient.rpc('generate_monthly_invoices', {
        p_month: month, p_org: null, p_default_tuition: defaultFee, p_limit: BATCH,
      });
      if (res.error) {
        const forbidden = res.error.code === '42501' || /forbidden/i.test(res.error.message);
        return json({ error: forbidden ? 'Forbidden' : res.error.message }, forbidden ? 403 : 400);
      }
      data = res.data;
      generated += Number(data?.generated || 0);
      if (!Number(data?.remaining) || !Number(data?.generated)) break;
    }
    if (generated > 0) await triggerOutboundWorker(supabaseUrl, serviceKey);
    return json({ ...data, generated,
                  message: `Generated ${generated} invoice(s) for ${month}.${Number(data?.remaining) ? ` ${data.remaining} remaining — run again.` : ''}` });
  } catch (err) {
    console.error('[generate-monthly-fees] Fatal error:', err);
    return json({ error: (err as Error).message || 'Internal error' }, 500);
  }
});
