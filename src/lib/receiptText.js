import { amountInWords, colomboDateTime, methodLabel, money, monthLabel, receiptPublicUrl } from './receiptPrint';

/**
 * Dot-matrix receipts (Epson LQ-310 and other ESC/P 24-pin printers).
 *
 * Layout: A5 portrait (148 × 210 mm) printed at 12 cpi (elite) → 66 columns,
 * 6 lines per inch → 49 lines per page. Plain ASCII only: impact printers in
 * text mode have no Arabic/Tamil glyphs, so names are transliterated by the
 * office as entered in English; anything else is stripped.
 *
 * Two ways to print:
 *   1. printReceiptDotMatrix() – browser print of a monospaced 12 cpi page
 *      (Courier 10 pt = 12 cpi). Works with the Epson LQ-310 driver or the
 *      Windows "Generic / Text Only" driver.
 *   2. receiptEscp() / downloadReceiptPrn() – raw ESC/P bytes (.prn): fastest,
 *      crispest (printer's own fonts). Send raw to the printer:
 *        Windows:  copy /b receipt.prn \\localhost\LQ310      (shared printer)
 *        Linux:    lp -d LQ310 -o raw receipt.prn
 */

/** Line prefix that marks an emphasised (bold) line. */
const MARK = String.fromCharCode(1);

export const DOT_MATRIX = {
  columns: 66, // 5.5 in at 12 cpi (A5 is 5.83 in wide)
  linesPerPage: 49, // 8.17 in at 6 lpi (A5 is 8.27 in tall)
};

/** Keep printable ASCII only (impact printers in text mode). */
export function ascii(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const pad = (s, n) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));
const padL = (s, n) => (s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s);
const center = (s, n) => {
  const t = s.slice(0, n);
  const left = Math.floor((n - t.length) / 2);
  return ' '.repeat(left) + t;
};

/** Word-wrap to width; continuation lines indented by `indent`. */
function wrap(text, width, indent = 0) {
  const words = ascii(text).split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const limit = lines.length ? width - indent : width;
    if ((line ? line.length + 1 : 0) + w.length > limit) {
      if (line) lines.push(line);
      line = w.slice(0, limit);
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  return lines.map((l, i) => (i ? ' '.repeat(indent) + l : l));
}

/** "Label            : value" with the value wrapped under itself (column 20). */
const kv = (k, v, W) => {
  const body = wrap(v, W - 20);
  const first = `${pad(ascii(k), 18)}: ${body[0] || ''}`;
  return [first, ...body.slice(1).map((l) => ' '.repeat(20) + l)];
};

/**
 * Receipt as an array of fixed-width lines. Lines that start with MARK
 * are emphasised (bold) by the ESC/P renderer; the marker is removed for the
 * plain-text print.
 */
export function receiptLines(r, { columns = DOT_MATRIX.columns } = {}) {
  const W = columns;
  const org = r?.organization || {};
  const st = r?.student || {};
  const cur = r?.currency || 'LKR';
  const amt = (v) => ascii(money(v, cur).replace(cur, '').trim());
  const rule = '-'.repeat(W);
  const dbl = '='.repeat(W);
  const B = MARK;
  const out = [];

  out.push(B + center(ascii(org.name_en || org.short_name || 'Institution').toUpperCase(), W));
  const contact = [org.address, org.phone ? `Tel ${org.phone}` : null].filter(Boolean).map(ascii).join(' | ');
  if (contact) wrap(contact, W).forEach((l) => out.push(center(l, W)));
  if (org.registration_no) out.push(center(`Reg. No: ${ascii(org.registration_no)}`, W));
  out.push(dbl);
  const title = 'OFFICIAL PAYMENT RECEIPT';
  const no = `No. ${ascii(r?.receipt_no || '-')}`;
  out.push(B + pad(title, W - no.length) + no);
  out.push(`Date: ${ascii(colomboDateTime(r?.paid_at))}`);
  if (r?.status === 'reversed') out.push(B + center('*** REVERSED - NOT VALID ***', W));
  out.push(rule);

  const parents = Array.isArray(st.parents) ? st.parents.filter(Boolean).join(', ') : '';
  kv('Student', ascii(st.full_name) || '-', W).forEach((l) => out.push(l));
  kv('Index No.', ascii(st.index_number) || '-', W).forEach((l) => out.push(l));
  kv('Class', st.class_number ? `Class ${st.class_number}` : '-', W).forEach((l) => out.push(l));
  kv('Parent/guardian', ascii(parents || st.guardian_name) || '-', W).forEach((l) => out.push(l));
  if (r?.payer_name) kv('Paid by', ascii(r.payer_name), W).forEach((l) => out.push(l));
  out.push(rule);

  // Month | Total | Paid now | Balance   (monetary columns right-aligned)
  const cM = W - 3 * 14;
  out.push(B + pad('Month', cM) + padL('Total', 14) + padL('Paid now', 14) + padL('Balance', 14));
  for (const a of r?.allocations || []) {
    const bal = Number(a.balance_after) > 0 ? amt(a.balance_after) : 'PAID';
    out.push(pad(ascii(a.month_label || monthLabel(a.month)), cM) + padL(amt(a.invoice_total), 14)
      + padL(amt(a.paid_now), 14) + padL(bal, 14));
    if (a.invoice_no) out.push(`  Invoice ${ascii(a.invoice_no)}`);
  }
  out.push(rule);
  const total = `${cur} ${amt(r?.amount)}`;
  out.push(B + pad('TOTAL RECEIVED', W - total.length) + total);
  wrap(amountInWords(r?.amount, cur), W).forEach((l) => out.push(l));
  out.push(rule);

  kv('Payment method', ascii(methodLabel(r?.method)), W).forEach((l) => out.push(l));
  if (r?.reference) kv('Reference', ascii(r.reference), W).forEach((l) => out.push(l));
  out.push(B + kv('Arrears after', `${cur} ${amt(r?.arrears_after)}`, W)[0]);
  const open = (r?.open_months || []).map((m) => `${ascii(monthLabel(m.month))} (${amt(m.balance)})`).join(', ');
  kv('Outstanding', open || 'None', W).forEach((l) => out.push(l));
  if (r?.notes) kv('Note', ascii(r.notes), W).forEach((l) => out.push(l));
  kv('Received by', ascii(r?.received_by) || 'Accounts office', W).forEach((l) => out.push(l));
  out.push('');
  out.push('');
  out.push(pad('....................', W - 20) + '....................');
  out.push(pad('Cashier signature', W - 20) + padL('Official seal', 20));
  const link = receiptPublicUrl(r?.public_token);
  if (link) wrap(`Verify: ${link}`, W).forEach((l) => out.push(l));
  out.push('Computer-generated receipt. Please keep it for your records.');

  // never exceed one A5 page: drop the verification/footer lines first
  while (out.length > DOT_MATRIX.linesPerPage) out.splice(out.length - 2, 1);
  return out;
}

/** Plain text (no emphasis markers), one string. */
export function receiptText(r, opts) {
  return receiptLines(r, opts).map((l) => l.replaceAll(MARK, '')).join('\n');
}

// ESC/P command bytes
const ESC = 0x1b;
const CMD = {
  init: [ESC, 0x40], // ESC @  reset
  lq: [ESC, 0x78, 0x01], // ESC x 1  letter quality
  draft: [ESC, 0x78, 0x00], // ESC x 0  draft (fastest)
  elite: [ESC, 0x4d], // ESC M  12 cpi
  lineSpacing6: [ESC, 0x32], // ESC 2  1/6 inch
  pageLines: (n) => [ESC, 0x43, n], // ESC C n  page length in lines
  leftMargin: (n) => [ESC, 0x6c, n], // ESC l n  left margin (columns)
  boldOn: [ESC, 0x45], // ESC E
  boldOff: [ESC, 0x46], // ESC F
  formFeed: [0x0c],
};

/**
 * Raw ESC/P bytes for an Epson LQ-310 (A5 cut sheet / continuous form).
 * @param {object} r receipt JSON
 * @param {{ quality?: 'lq'|'draft', leftMargin?: number }} [opts]
 */
export function receiptEscp(r, { quality = 'lq', leftMargin = 2 } = {}) {
  const bytes = [
    ...CMD.init,
    ...(quality === 'draft' ? CMD.draft : CMD.lq),
    ...CMD.elite,
    ...CMD.lineSpacing6,
    ...CMD.pageLines(DOT_MATRIX.linesPerPage),
    ...CMD.leftMargin(leftMargin),
  ];
  const enc = new TextEncoder();
  for (const line of receiptLines(r)) {
    const bold = line.startsWith(MARK);
    if (bold) bytes.push(...CMD.boldOn);
    bytes.push(...enc.encode(line.replaceAll(MARK, '')), 0x0d, 0x0a);
    if (bold) bytes.push(...CMD.boldOff);
  }
  bytes.push(...CMD.formFeed);
  return new Uint8Array(bytes);
}

/** Download the raw ESC/P job as receipt-<no>.prn */
export function downloadReceiptPrn(r, opts) {
  const blob = new Blob([receiptEscp(r, opts)], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `receipt-${ascii(r?.receipt_no || 'slip').replace(/[^A-Za-z0-9_-]/g, '_')}.prn`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Monospaced 12 cpi page for the LQ-310 / Generic-Text-Only driver. */
export function dotMatrixHtml(r) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = receiptLines(r)
    .map((l) => (l.startsWith(MARK) ? `<b>${esc(l.slice(1))}</b>` : esc(l)))
    .join('\n');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />
<title>Receipt ${esc(ascii(r?.receipt_no || ''))}</title>
<style>
  @page { size: 148mm 210mm; margin: 5mm 6mm; }
  * { margin: 0; padding: 0; }
  body { background: #fff; color: #000; }
  /* Courier 10 pt = 12 characters per inch = 66 columns on A5 */
  pre { font-family: 'Courier New', Courier, monospace; font-size: 10pt; line-height: 12pt; white-space: pre; }
  b { font-weight: bold; }
  .bar { margin: 12px 0; font-family: sans-serif; }
  .bar button { padding: 6px 18px; }
  @media print { .bar { display: none; } }
</style></head>
<body><pre>${body}</pre>
<div class="bar"><button onclick="window.print()">Print (Epson LQ-310 / Generic Text)</button></div>
</body></html>`;
}

export function printReceiptDotMatrix(r) {
  if (!r) return;
  const win = window.open('', '_blank', 'width=720,height=900');
  if (!win) return;
  win.document.write(dotMatrixHtml(r));
  win.document.close();
  win.focus();
  setTimeout(() => {
    try {
      win.print();
    } catch {
      /* the Print button remains */
    }
  }, 300);
}
