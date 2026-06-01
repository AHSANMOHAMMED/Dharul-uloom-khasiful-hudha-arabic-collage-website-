// supabase/functions/generate-monthly-fees/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Edge Function: Monthly Fee Generator
//
// Trigger options:
//   1. HTTP POST (admin clicks "Generate Fees" button)
//   2. pg_cron / Supabase scheduled trigger on the 1st of every month
//
// Behaviour:
//   - Reads all approved students from profiles
//   - For each student, checks if a fee row already exists for the current month
//   - Inserts a new student_fees row only if none exists (idempotent)
//   - Returns a summary: { generated, skipped, errors }
//
// Auth: Requires service_role key — called from admin backend only.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Supabase admin client (service_role — bypasses RLS)
  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase     = createClient(supabaseUrl, serviceKey);

  // Parse optional body params
  let body: { month?: string; default_fee?: number } = {};
  try { body = await req.json(); } catch { /* use defaults */ }

  // Current month in "YYYY-MM" format
  const now   = new Date();
  const month = body.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const defaultFee = body.default_fee ?? 2000; // LKR 2,000 default monthly tuition

  console.log(`[generate-monthly-fees] Running for month: ${month}, default_fee: ${defaultFee}`);

  try {
    // 1. Fetch all approved students
    const { data: students, error: stuErr } = await supabase
      .from('profiles')
      .select('id, full_name, class_number')
      .eq('account_type', 'student')
      .eq('is_approved', true);

    if (stuErr) throw stuErr;
    if (!students || students.length === 0) {
      return new Response(JSON.stringify({ message: 'No approved students found.', generated: 0, skipped: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch existing fee rows for this month (to avoid duplicates)
    const { data: existingFees, error: feeErr } = await supabase
      .from('student_fees')
      .select('student_id')
      .eq('month', month);

    if (feeErr) throw feeErr;
    const alreadyHasFee = new Set((existingFees || []).map((f: { student_id: string }) => f.student_id));

    // 3. Build insert payload for students without a fee this month
    const toInsert = students
      .filter((s: { id: string }) => !alreadyHasFee.has(s.id))
      .map((s: { id: string; class_number?: number }) => ({
        student_id:  s.id,
        month,
        total_due:   defaultFee,
        paid_amount: 0,
        status:      'unpaid',
        payments:    [],
      }));

    if (toInsert.length === 0) {
      return new Response(JSON.stringify({
        message:   `All students already have fee records for ${month}.`,
        generated: 0,
        skipped:   students.length,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4. Insert in batches of 50
    let generated = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 50;

    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error: insertErr } = await supabase.from('student_fees').insert(batch);
      if (insertErr) {
        console.error(`Batch insert error (offset ${i}):`, insertErr.message);
        errors.push(insertErr.message);
      } else {
        generated += batch.length;
      }
    }

    const result = {
      month,
      generated,
      skipped:  alreadyHasFee.size,
      errors:   errors.length > 0 ? errors : undefined,
      message:  `Generated ${generated} fee record(s) for ${month}. Skipped ${alreadyHasFee.size} (already existed).`,
    };

    console.log('[generate-monthly-fees] Result:', result);

    return new Response(JSON.stringify(result), {
      status:  errors.length > 0 ? 207 : 200, // 207 Multi-Status if partial failures
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[generate-monthly-fees] Fatal error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
