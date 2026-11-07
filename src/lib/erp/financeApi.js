import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { query, formatMoney, formatDate } from './rpc';

/**
 * Finance-module helpers (lookups, labels, printable documents). All data
 * access goes through rpc.js; permissions are enforced by the database.
 */

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------
export const PAYMENT_METHODS = {
  cash: ['Cash', 'نقدًا'],
  bank_transfer: ['Bank transfer', 'تحويل بنكي'],
  cheque: ['Cheque', 'شيك'],
  online: ['Online', 'عبر الإنترنت'],
  other: ['Other', 'أخرى'],
  payhere: ['PayHere (gateway)', 'بي هير (بوابة)'],
};

export const FUND_TYPES = {
  general: ['General', 'عام'],
  zakat: ['Zakat', 'زكاة'],
  sadaqah: ['Sadaqah', 'صدقة'],
  waqf: ['Waqf', 'وقف'],
  sponsorship: ['Sponsorship', 'كفالة'],
  building: ['Building fund', 'صندوق البناء'],
};

export const ACCOUNT_TYPES = {
  asset: ['Asset', 'أصول'],
  liability: ['Liability', 'خصوم'],
  equity: ['Equity', 'حقوق الملكية'],
  income: ['Income', 'إيرادات'],
  expense: ['Expense', 'مصروفات'],
};

export const ACCOUNT_SUBTYPES = {
  cash: ['Cash', 'نقد'],
  bank: ['Bank', 'بنك'],
  receivable: ['Receivable', 'مدينون'],
  payable: ['Payable', 'دائنون'],
  fixed_asset: ['Fixed asset', 'أصل ثابت'],
  contra: ['Contra', 'مقابل'],
  other: ['Other', 'أخرى'],
};

export const FEE_FREQUENCIES = {
  monthly: ['Monthly', 'شهري'],
  term: ['Per term', 'فصلي'],
  annual: ['Annual', 'سنوي'],
  once: ['One-time', 'مرة واحدة'],
};

export const FEE_STATUSES = {
  unpaid: ['Unpaid', 'غير مدفوع'],
  partial: ['Partial', 'جزئي'],
  completed: ['Paid', 'مدفوع'],
  cancelled: ['Cancelled', 'ملغى'],
};

export const EXPENSE_STATUSES = {
  submitted: ['Submitted', 'مقدَّم'],
  approved: ['Approved', 'معتمد'],
  rejected: ['Rejected', 'مرفوض'],
  paid: ['Paid', 'مدفوع'],
  void: ['Void', 'ملغى'],
  draft: ['Draft', 'مسودة'],
};

export const CLASS_OPTIONS = Array.from({ length: 20 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

/** Turn a { key: [en, ar] } map into Select options. */
export function toOptions(map, t) {
  return Object.entries(map).map(([value, [en, ar]]) => ({ value, label: t(en, ar) }));
}

export function labelOf(map, key, t) {
  const pair = map[key];
  return pair ? t(pair[0], pair[1]) : String(key ?? '—').replace(/_/g, ' ');
}

export function firstOfMonth() {
  return `${new Date().toISOString().slice(0, 7)}-01`;
}

export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Run a mutating action with toast feedback. Returns the result or undefined on failure. */
export async function runAction(fn, successMessage) {
  try {
    const result = await fn();
    if (successMessage) toast.success(successMessage);
    return result ?? true;
  } catch (error) {
    toast.error(error?.message || String(error));
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------
const PROFILE_COLS = 'id, full_name, index_number, class_number, account_type';

/** Fetch profiles by id → { [id]: profile }. */
export async function profilesMap(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  const map = {};
  for (let i = 0; i < unique.length; i += 150) {
    const chunk = unique.slice(i, i + 150);
    const rows = await query('profiles', (q) => q.select(PROFILE_COLS).in('id', chunk));
    (rows || []).forEach((r) => {
      map[r.id] = r;
    });
  }
  return map;
}

export function listStudents() {
  return query('profiles', (q) =>
    q.select(PROFILE_COLS).eq('account_type', 'student').order('full_name').limit(5000),
  );
}

export function listEmployees() {
  return query('profiles', (q) =>
    q.select(PROFILE_COLS).in('account_type', ['tutor', 'staff']).eq('is_approved', true).order('full_name').limit(2000),
  );
}

export function listAccounts(build = (q) => q) {
  return query('accounts', (q) =>
    build(q.select('id, code, name, name_ar, type, subtype, is_system, is_active, parent_id, description').order('code')),
  );
}

/** Cash/bank accounts usable as a payment source. */
export function listCashBankAccounts() {
  return listAccounts((q) => q.in('subtype', ['cash', 'bank']).eq('is_active', true));
}

export function accountLabel(a, ar) {
  if (!a) return '—';
  return `${a.code} · ${ar && a.name_ar ? a.name_ar : a.name}`;
}

const orgCache = new Map();
export function fetchOrg(orgId) {
  if (!orgId) return Promise.resolve(null);
  if (!orgCache.has(orgId)) {
    orgCache.set(
      orgId,
      query('organizations', (q) => q.select('id, name_en, name_ar, books_locked_until, currency').eq('id', orgId).maybeSingle()).catch(
        (e) => {
          orgCache.delete(orgId);
          throw e;
        },
      ),
    );
  }
  return orgCache.get(orgId);
}

export function invalidateOrg(orgId) {
  orgCache.delete(orgId);
}

/** Organization row (name for printable documents). */
export function useOrg(orgId) {
  const [org, setOrg] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchOrg(orgId)
      .then((o) => alive && setOrg(o))
      .catch(() => alive && setOrg(null));
    return () => {
      alive = false;
    };
  }, [orgId]);
  return org;
}

// ---------------------------------------------------------------------------
// Printable documents
// ---------------------------------------------------------------------------
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const money = (v) => esc(formatMoney(v));
export const date = (v) => esc(formatDate(v));

/**
 * Open a clean printable window.
 * @param {{ title: string, org?: object, body: string, rtl?: boolean }} opts
 */
export function printDocument({ title, org, body, rtl = false }) {
  const html = `<!DOCTYPE html>
<html lang="${rtl ? 'ar' : 'en'}" dir="${rtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="UTF-8" />
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; padding: 32px; max-width: 820px; margin: 0 auto; font-size: 13px; }
  .head { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1a5c38; padding-bottom: 12px; margin-bottom: 20px; gap: 16px; }
  .org { font-size: 18px; font-weight: 800; color: #1a5c38; }
  .org-ar { font-size: 20px; color: #c9a227; font-weight: 700; direction: rtl; }
  h1 { font-size: 17px; text-align: center; color: #1a5c38; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 16px; }
  h2 { font-size: 14px; color: #1a5c38; margin: 18px 0 8px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; background: #f7faf8; border: 1px solid #d4e8dc; border-radius: 8px; padding: 14px; margin-bottom: 16px; }
  .lbl { color: #666; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
  .val { font-weight: 700; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th { background: #1a5c38; color: #fff; padding: 7px 10px; text-align: start; font-size: 12px; }
  td { padding: 7px 10px; border-bottom: 1px solid #eee; text-align: start; }
  td.num, th.num { text-align: end; white-space: nowrap; }
  tr.total td { font-weight: 800; border-top: 2px solid #1a5c38; background: #f7faf8; }
  .muted { color: #777; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-weight: 700; font-size: 11px; text-transform: uppercase; background: #eee; }
  .big { font-size: 20px; font-weight: 900; color: #1a5c38; }
  .foot { margin-top: 36px; display: flex; justify-content: space-between; color: #888; font-size: 11px; border-top: 1px solid #eee; padding-top: 12px; gap: 16px; }
  .sig { border-top: 1px solid #999; width: 170px; margin-top: 36px; padding-top: 4px; text-align: center; }
  @media print { body { padding: 12px; } .no-print { display: none; } }
</style>
</head>
<body>
  <div class="head">
    <div><div class="org">${esc(org?.name_en || 'Institution')}</div></div>
    ${org?.name_ar ? `<div class="org-ar">${esc(org.name_ar)}</div>` : ''}
  </div>
  <h1>${esc(title)}</h1>
  ${body}
  <div class="foot">
    <div>Printed ${esc(new Date().toLocaleString('en-GB'))}</div>
    <div>This is a computer-generated document.</div>
  </div>
  <div class="no-print" style="text-align:center;margin-top:24px;">
    <button onclick="window.print()" style="padding:9px 26px;background:#1a5c38;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;">Print</button>
  </div>
</body>
</html>`;
  const win = window.open('', '_blank', 'width=860,height=960');
  if (!win) {
    toast.error('Pop-up blocked: allow pop-ups to print.');
    return;
  }
  win.document.write(html);
  win.document.close();
}

/** Simple two-column key/value grid for print bodies. */
export function printGrid(pairs) {
  return `<div class="grid">${pairs
    .map(([k, v]) => `<div><div class="lbl">${esc(k)}</div><div class="val">${v ?? '—'}</div></div>`)
    .join('')}</div>`;
}

/** Table for print bodies. columns: [{ label, num? }], rows: string[][] (already escaped) */
export function printTable(columns, rows, totalRow) {
  const head = columns.map((c) => `<th class="${c.num ? 'num' : ''}">${esc(c.label)}</th>`).join('');
  const body = rows
    .map((r) => `<tr>${r.map((cell, i) => `<td class="${columns[i]?.num ? 'num' : ''}">${cell ?? ''}</td>`).join('')}</tr>`)
    .join('');
  const total = totalRow
    ? `<tr class="total">${totalRow.map((cell, i) => `<td class="${columns[i]?.num ? 'num' : ''}">${cell ?? ''}</td>`).join('')}</tr>`
    : '';
  return `<table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${columns.length}" class="muted">—</td></tr>`}${total}</tbody></table>`;
}
