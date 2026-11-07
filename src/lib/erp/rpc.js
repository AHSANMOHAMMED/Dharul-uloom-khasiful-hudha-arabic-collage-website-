import { supabase, isSupabaseConfigured } from '../supabaseClient';

/**
 * Thin data helpers shared by all ERP modules. Authorization lives in the
 * database (RLS + SECURITY DEFINER RPC checks, see supabase/migrations
 * 0015–0020); these helpers only normalise errors for the UI.
 */

export class ErpError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'ErpError';
    this.cause = cause;
  }
}

function friendly(error) {
  if (!error) return 'Unknown error';
  const msg = error.message || String(error);
  if (error.code === '42501' || /forbidden|permission denied/i.test(msg)) {
    return 'You do not have permission for this action.';
  }
  if (error.code === '23505') return 'A record with the same unique value already exists.';
  return msg;
}

function ensureClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new ErpError('Supabase is not configured (set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  }
  return supabase;
}

/** Call a Postgres function (RPC). Throws ErpError with a readable message. */
export async function rpc(name, params = {}) {
  const client = ensureClient();
  const { data, error } = await client.rpc(name, params);
  if (error) throw new ErpError(friendly(error), error);
  return data;
}

/** Run a query builder callback against a table and unwrap the result. */
export async function query(table, build = (q) => q.select('*')) {
  const client = ensureClient();
  const { data, error } = await build(client.from(table));
  if (error) throw new ErpError(friendly(error), error);
  return data;
}

export async function insertRow(table, row, select = '*') {
  return query(table, (q) => q.insert(row).select(select).single());
}

export async function insertRows(table, rows) {
  return query(table, (q) => q.insert(rows).select());
}

export async function updateRow(table, id, patch, idColumn = 'id') {
  return query(table, (q) => q.update(patch).eq(idColumn, id).select().single());
}

export async function deleteRow(table, id, idColumn = 'id') {
  return query(table, (q) => q.delete().eq(idColumn, id));
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function formatMoney(value, currency = 'LKR') {
  const n = Number(value || 0);
  return `${currency} ${n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Download rows as CSV (client-side export for reports). */
export function downloadCsv(filename, rows) {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
  const blob = new Blob([String.fromCharCode(0xfeff) + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Generate a month's invoices in bounded batches (each RPC ~1 s, far inside the
 * 10 s API budget) and report progress. Returns the merged totals.
 */
export async function generateInvoicesInBatches({ month, defaultTuition = null, batchSize = 300, onProgress } = {}) {
  const total = { month, generated: 0, skipped: 0, total_amount: 0, remaining: 0, message: '' };
  for (let round = 0; round < 1000; round += 1) {
    const r = (await rpc('generate_monthly_invoices', {
      p_month: month,
      p_default_tuition: defaultTuition,
      p_limit: batchSize,
    })) || {};
    total.generated += Number(r.generated || 0);
    total.total_amount += Number(r.total_amount || 0);
    total.skipped = Number(r.skipped || 0);
    total.remaining = Number(r.remaining || 0);
    onProgress?.({ ...total });
    if (!total.remaining || !Number(r.generated)) break;
  }
  total.message = `Generated ${total.generated} invoice(s) for ${month}. ${total.skipped} already existed.`;
  return total;
}
