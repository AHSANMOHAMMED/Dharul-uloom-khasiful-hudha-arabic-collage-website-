import { toast } from 'react-toastify';
import { tx } from './tx';
import { supabaseFunctionBaseUrl } from './supabaseClient';

/**
 * Printable official payment slip built from the receipt JSON returned by
 * fee_receipt_details / fee_receipt_by_token / receive_student_payment.
 * Same content as the receipt-pdf edge function (the downloadable PDF).
 */

const METHOD_LABELS = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  online: 'Online',
  payhere: 'PayHere (online gateway)',
  other: 'Other',
};

export function methodLabel(m) {
  return METHOD_LABELS[m] || String(m ?? '—').replace(/_/g, ' ');
}

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** URL of the official receipt PDF (edge function, no login needed). */
export function receiptPdfUrl(token) {
  if (!token || !supabaseFunctionBaseUrl) return null;
  return `${supabaseFunctionBaseUrl.replace(/\/$/, '')}/functions/v1/receipt-pdf?t=${encodeURIComponent(token)}`;
}

/** Public verification link printed on the slip and sent by SMS. */
export function receiptPublicUrl(token) {
  if (!token) return null;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/r/${encodeURIComponent(token)}`;
}

export function money(value, currency = 'LKR') {
  const n = Number(value || 0);
  return `${currency} ${n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Date + time in Sri Lanka time (Asia/Colombo). */
export function colomboDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Colombo',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return d.toLocaleString('en-GB');
  }
}

export function monthLabel(month) {
  if (!month) return '—';
  const m = /^(\d{4})-(\d{2})/.exec(String(month));
  if (!m) return String(month);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// ---------------------------------------------------------------------------
// Amount in words (English, Sri Lankan rupees and cents)
// ---------------------------------------------------------------------------
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowThousand(n) {
  const parts = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(' ');
}

function integerWords(n) {
  if (n === 0) return 'Zero';
  const scales = [
    [1e9, 'Billion'],
    [1e6, 'Million'],
    [1e3, 'Thousand'],
  ];
  const parts = [];
  let rest = n;
  for (const [size, name] of scales) {
    if (rest >= size) {
      parts.push(`${belowThousand(Math.floor(rest / size))} ${name}`);
      rest %= size;
    }
  }
  if (rest > 0) parts.push(belowThousand(rest));
  return parts.join(' ');
}

export function amountInWords(value, currency = 'LKR') {
  const n = Math.round(Math.abs(Number(value || 0)) * 100);
  const rupees = Math.floor(n / 100);
  const cents = n % 100;
  const unit = currency === 'LKR' ? 'Rupees' : currency;
  let out = `${unit} ${integerWords(rupees)}`;
  if (cents) out += ` and ${integerWords(cents)} Cents`;
  return `${out} Only`;
}

// ---------------------------------------------------------------------------
// Slip markup
// ---------------------------------------------------------------------------
function slipHtml(r, copyLabel) {
  const org = r.organization || {};
  const st = r.student || {};
  const cur = r.currency || 'LKR';
  const reversed = r.status === 'reversed';
  const parents = Array.isArray(st.parents) ? st.parents.filter(Boolean) : [];
  const allocations = Array.isArray(r.allocations) ? r.allocations : [];
  const openMonths = Array.isArray(r.open_months) ? r.open_months : [];
  const link = receiptPublicUrl(r.public_token);
  const orgLine = [org.address, org.phone ? `Tel: ${org.phone}` : null, org.email].filter(Boolean).map(esc).join(' · ');

  const row = (k, v) => `<div><span class="lbl">${esc(k)}</span><span class="val">${v}</span></div>`;
  const allocRows = allocations
    .map(
      (a) => `<tr>
        <td>${esc(a.month_label || monthLabel(a.month))}</td>
        <td class="mono">${esc(a.invoice_no || '—')}</td>
        <td class="num">${esc(money(a.invoice_total, cur))}</td>
        <td class="num">${esc(money(a.paid_now, cur))}</td>
        <td class="num">${Number(a.balance_after) > 0 ? esc(money(a.balance_after, cur)) : 'Paid'}</td>
      </tr>`,
    )
    .join('');

  return `<section class="slip${reversed ? ' reversed' : ''}">
    ${reversed ? '<div class="watermark">REVERSED</div>' : ''}
    <header class="head">
      ${org.logo_url ? `<img class="logo" src="${esc(org.logo_url)}" alt="" />` : ''}
      <div class="org">
        <div class="org-en">${esc(org.name_en || org.short_name || 'Institution')}</div>
        ${org.name_ar ? `<div class="org-ar" dir="rtl" lang="ar">${esc(org.name_ar)}</div>` : ''}
        ${orgLine ? `<div class="org-line">${orgLine}</div>` : ''}
        ${org.registration_no ? `<div class="org-line">Reg. No: ${esc(org.registration_no)}</div>` : ''}
      </div>
      ${copyLabel ? `<div class="copy">${esc(copyLabel)}</div>` : ''}
    </header>
    <div class="title">
      <h1>Official Payment Receipt</h1>
      <div class="rno">No. <strong>${esc(r.receipt_no || '—')}</strong></div>
    </div>
    <div class="grid">
      ${row('Date / time', esc(colomboDateTime(r.paid_at)))}
      ${row('Student', esc(st.full_name || '—'))}
      ${row('Index No.', esc(st.index_number || '—'))}
      ${row('Class', esc(st.class_number || '—'))}
      ${row('Parent / guardian', esc(parents.length ? parents.join(', ') : st.guardian_name || '—'))}
      ${row('Paid by', esc(r.payer_name || '—'))}
    </div>
    <table>
      <thead><tr><th>Month</th><th>Invoice</th><th class="num">Total</th><th class="num">Paid now</th><th class="num">Balance</th></tr></thead>
      <tbody>${allocRows || '<tr><td colspan="5" class="muted">—</td></tr>'}</tbody>
      <tfoot><tr><td colspan="3">TOTAL RECEIVED</td><td class="num" colspan="2">${esc(money(r.amount, cur))}</td></tr></tfoot>
    </table>
    <p class="words"><span class="lbl">Amount in words</span> ${esc(amountInWords(r.amount, cur))}</p>
    <div class="grid">
      ${row('Method', esc(methodLabel(r.method)))}
      ${row('Reference', esc(r.reference || '—'))}
      ${row('Total arrears after this payment', `<strong class="${Number(r.arrears_after) > 0 ? 'due' : 'ok'}">${esc(money(r.arrears_after, cur))}</strong>`)}
      ${row('Outstanding months', openMonths.length ? openMonths.map((m) => `${esc(monthLabel(m.month))} (${esc(money(m.balance, cur))})`).join(', ') : 'None')}
      ${r.notes ? row('Note', esc(r.notes)) : ''}
      ${row('Received by', esc(r.received_by || '—'))}
    </div>
    <div class="sigs"><div class="sig">Cashier signature</div><div class="sig">Official seal</div></div>
    ${link ? `<p class="verify">Verify this receipt: <span class="mono">${esc(link)}</span></p>` : ''}
    <p class="foot">Computer-generated receipt · printed ${esc(colomboDateTime(new Date()))}</p>
  </section>`;
}

const STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; font-size: 11.5px; background: #fff; }
  .wrap { max-width: 190mm; margin: 0 auto; padding: 8px; }
  .slip { position: relative; border: 1.5px solid #1a5c38; border-radius: 8px; padding: 12px 14px; overflow: hidden; page-break-inside: avoid; }
  .two .slip { min-height: 132mm; }
  .cut { border-top: 1.5px dashed #999; margin: 6mm 0; position: relative; text-align: center; color: #999; font-size: 10px; }
  .cut span { position: relative; top: -7px; background: #fff; padding: 0 8px; }
  .head { display: flex; gap: 10px; align-items: center; border-bottom: 2px solid #1a5c38; padding-bottom: 6px; }
  .logo { width: 46px; height: 46px; object-fit: contain; }
  .org { flex: 1; }
  .org-en { font-size: 15px; font-weight: 800; color: #1a5c38; }
  .org-ar { font-size: 15px; font-weight: 700; color: #a8841c; font-family: 'Amiri', 'Noto Naskh Arabic', serif; }
  .org-line { font-size: 10px; color: #555; }
  .copy { font-size: 10px; font-weight: 800; text-transform: uppercase; border: 1px solid #1a5c38; color: #1a5c38; padding: 3px 8px; border-radius: 10px; white-space: nowrap; }
  .title { display: flex; justify-content: space-between; align-items: baseline; margin: 8px 0; }
  h1 { font-size: 14px; letter-spacing: 1px; text-transform: uppercase; color: #1a5c38; }
  .rno { font-size: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 16px; background: #f7faf8; border: 1px solid #d4e8dc; border-radius: 6px; padding: 7px 9px; margin-bottom: 7px; }
  .lbl { color: #666; font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; margin-inline-end: 6px; }
  .val { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  th { background: #1a5c38; color: #fff; padding: 4px 7px; text-align: start; font-size: 10.5px; }
  td { padding: 4px 7px; border-bottom: 1px solid #eee; text-align: start; }
  .num { text-align: end; white-space: nowrap; }
  tfoot td { font-weight: 800; font-size: 13px; border-top: 2px solid #1a5c38; background: #f7faf8; }
  .mono { font-family: Consolas, monospace; font-size: 10.5px; word-break: break-all; }
  .muted { color: #888; }
  .words { margin-bottom: 7px; font-style: italic; }
  .due { color: #b45309; }
  .ok { color: #1a5c38; }
  .sigs { display: flex; justify-content: space-between; margin-top: 20px; }
  .sig { border-top: 1px solid #999; width: 150px; padding-top: 3px; text-align: center; font-size: 10px; color: #555; }
  .verify { margin-top: 8px; font-size: 10px; color: #444; }
  .foot { margin-top: 3px; font-size: 9.5px; color: #888; }
  .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 64px; font-weight: 900; color: rgba(185, 28, 28, .16); transform: rotate(-22deg); pointer-events: none; letter-spacing: 6px; }
  .reversed { border-color: #b91c1c; }
  .bar { text-align: center; margin: 14px 0; }
  .bar button { padding: 8px 24px; background: #1a5c38; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; }
  @media print { .no-print { display: none; } .wrap { padding: 0; } }
`;

// A5 portrait (148 × 210 mm) is the standard slip; two copies go on one A4.
const PAPER_CSS = {
  A5: `@page { size: 148mm 210mm; margin: 6mm; }
       body { font-size: 10.5px; }
       .wrap { max-width: 134mm; padding: 0; margin: 0 auto; }
       .slip { padding: 9px 10px; }
       .grid { grid-template-columns: 1fr; }
       .org-en, .org-ar { font-size: 13.5px; }
       .sigs { margin-top: 16px; }
       .sig { width: 120px; }`,
  A4: `@page { size: A4; margin: 10mm; }`,
};

/**
 * Full HTML document for the slip (exported for tests / previews).
 * @param {object} receipt
 * @param {{ copies?: 1|2, paper?: 'A5'|'A4' }} [opts] default: one slip on A5;
 *   copies: 2 → office + parent copy on one A4 sheet.
 */
export function receiptHtml(receipt, { copies = 1, paper } = {}) {
  const two = copies >= 2;
  const size = paper || (two ? 'A4' : 'A5');
  const body = two
    ? `${slipHtml(receipt, 'Office copy')}<div class="cut"><span>--- cut here ---</span></div>${slipHtml(receipt, 'Parent copy')}`
    : slipHtml(receipt, '');
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head><meta charset="UTF-8" /><title>Receipt ${esc(receipt?.receipt_no || '')}</title><style>${STYLES}${PAPER_CSS[size] || PAPER_CSS.A5}</style></head>
<body>
  <div class="wrap${two ? ' two' : ''}">${body}</div>
  <div class="bar no-print"><button onclick="window.print()">Print</button></div>
</body>
</html>`;
}

/**
 * Open a print window with the official payment slip.
 * @param {object} receipt receipt JSON
 * @param {{ copies?: 1|2, paper?: 'A5'|'A4' }} [opts] default A5; copies: 2 → office + parent copy on one A4
 */
export function printReceipt(receipt, opts = {}) {
  if (!receipt) return;
  const win = window.open('', '_blank', 'width=860,height=960');
  if (!win) {
    toast.error(tx('تم حظر النافذة المنبثقة: اسمح بالنوافذ المنبثقة للطباعة.', 'Pop-up blocked: allow pop-ups to print.'));
    return;
  }
  win.document.write(receiptHtml(receipt, opts));
  win.document.close();
  win.focus();
  // let images (logo) load before the print dialog opens
  setTimeout(() => {
    try {
      win.print();
    } catch {
      /* user can still use the Print button */
    }
  }, 400);
}
