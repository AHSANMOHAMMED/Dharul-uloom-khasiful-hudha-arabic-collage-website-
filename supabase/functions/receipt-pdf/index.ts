// supabase/functions/receipt-pdf/index.ts
// GET ?t=<receipt public_token>  →  application/pdf (exact receipt snapshot).
// Linked from the payment SMS / e-mail / app; the 128-bit token is the
// capability (same model as a bank's e-receipt link).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildReceiptPdf, pdfSafe } from '../_shared/receiptPdf.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors });

  const token = new URL(req.url).searchParams.get('t') || '';
  if (!/^[0-9a-f]{32}$/.test(token)) return new Response('Invalid receipt link', { status: 400, headers: cors });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const { data, error } = await admin.rpc('fee_receipt_by_token', { p_token: token });
  if (error) return new Response('Receipt service error', { status: 500, headers: cors });
  if (!data) return new Response('Receipt not found', { status: 404, headers: cors });

  const site = (Deno.env.get('SITE_URL') || '').replace(/\/$/, '');
  const pdf = await buildReceiptPdf(data, { verifyUrl: site ? `${site}/r/${token}` : undefined });
  const name = pdfSafe(`receipt-${data.receipt_no}.pdf`).replace(/\s+/g, '_');
  const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
  return new Response(body, {
    headers: {
      ...cors,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${name}"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
});
