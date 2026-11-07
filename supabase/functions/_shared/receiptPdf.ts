// Official payment receipt PDF (A5 portrait) built from the receipt snapshot
// returned by public.fee_receipt_by_token / _fee_receipt_json — the same data
// the printed slip, the app and the SMS use, so every copy matches exactly.
import { PDFDocument, StandardFonts, rgb, degrees } from 'npm:pdf-lib@1.17.1';

// deno-lint-ignore no-explicit-any
export type ReceiptJson = Record<string, any>;

const GREEN = rgb(0.016, 0.47, 0.34);
const DARK = rgb(0.1, 0.1, 0.12);
const GREY = rgb(0.42, 0.45, 0.5);

/** Standard PDF fonts are WinAnsi-only; drop characters they cannot encode. */
export function pdfSafe(v: unknown): string {
  return String(v ?? '')
    .normalize('NFKD')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim();
}

export function money(n: unknown): string {
  const v = Number(n || 0);
  return v.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function words999(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} hundred`);
  if (r) parts.push(r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? '-' + ONES[r % 10] : ''}`);
  return parts.join(' and ');
}

/** 3,000.50 → "Three thousand rupees and fifty cents only" */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const cents = Math.round((amount - rupees) * 100);
  const scales: [number, string][] = [[1_000_000_000, 'billion'], [1_000_000, 'million'], [1000, 'thousand'], [1, '']];
  let rest = rupees;
  const parts: string[] = [];
  for (const [size, name] of scales) {
    const chunk = Math.floor(rest / size);
    rest %= size;
    if (chunk) parts.push(`${words999(chunk)}${name ? ' ' + name : ''}`);
  }
  let out = `${parts.join(' ') || 'zero'} rupees`;
  if (cents) out += ` and ${words999(cents)} cents`;
  out = `${out} only`;
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export async function buildReceiptPdf(r: ReceiptJson, opts: { verifyUrl?: string } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Receipt ${r.receipt_no}`);
  doc.setAuthor(pdfSafe(r.organization?.name_en) || 'College');
  doc.setCreationDate(new Date(r.paid_at || Date.now()));

  const page = doc.addPage([420, 595]); // A5
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const M = 28;
  let y = height - M;

  const text = (s: string, x: number, size = 9, f = font, color = DARK) => {
    page.drawText(pdfSafe(s), { x, y, size, font: f, color });
  };
  const right = (s: string, xRight: number, size = 9, f = font, color = DARK) => {
    const t = pdfSafe(s);
    page.drawText(t, { x: xRight - f.widthOfTextAtSize(t, size), y, size, font: f, color });
  };
  const line = (thick = 0.6, color = GREY) => {
    page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: thick, color });
  };

  // Header
  const org = r.organization || {};
  page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: GREEN });
  y -= 10;
  text(org.name_en || 'College', M, 13, bold, GREEN);
  y -= 13;
  text([org.address, org.phone].filter(Boolean).join('  |  '), M, 8, font, GREY);
  y -= 10;
  text([org.email, org.registration_no ? `Reg. No: ${org.registration_no}` : ''].filter(Boolean).join('  |  '), M, 8, font, GREY);
  y -= 16;
  line(1.2, GREEN);
  y -= 20;
  text('OFFICIAL PAYMENT RECEIPT', M, 12, bold);
  right(`No. ${r.receipt_no}`, width - M, 10, bold);
  y -= 14;
  const paid = new Date(r.paid_at);
  text(`Date: ${paid.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Colombo' })}  ` +
       `${paid.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })}`, M, 9, font, GREY);
  y -= 20;

  // Student block
  const st = r.student || {};
  const kv = (k: string, v: string) => {
    text(k, M, 9, font, GREY);
    text(v || '-', M + 92, 9, bold);
    y -= 13;
  };
  kv('Student', st.full_name);
  kv('Index number', st.index_number);
  kv('Class', st.class_number ? `Class ${st.class_number}` : '-');
  const parents = (st.parents || []).join(', ') || st.guardian_name;
  kv('Parent / guardian', parents);
  if (r.payer_name) kv('Paid by', r.payer_name);
  y -= 6;

  // Allocation table
  // columns: Month | Invoice | Invoice total | Paid now | Balance (right-aligned money)
  const xMonth = M + 4, xInv = M + 92, rTotal = M + 248, rPaid = M + 306, rBal = width - M - 4;
  page.drawRectangle({ x: M, y: y - 4, width: width - 2 * M, height: 16, color: rgb(0.93, 0.97, 0.95) });
  y += 1;
  text('Month', xMonth, 8.5, bold);
  text('Invoice', xInv, 8.5, bold);
  right('Total', rTotal, 8.5, bold);
  right('Paid now', rPaid, 8.5, bold);
  right('Balance', rBal, 8.5, bold);
  y -= 18;
  for (const a of r.allocations || []) {
    const owing = Number(a.balance_after) > 0;
    text(a.month_label || a.month, xMonth, 8.5);
    text(a.invoice_no || '', xInv, 7.5, font, GREY);
    right(money(a.invoice_total), rTotal, 8.5);
    right(money(a.paid_now), rPaid, 8.5, bold);
    right(money(a.balance_after), rBal, 8.5, owing ? bold : font, owing ? rgb(0.7, 0.2, 0.1) : DARK);
    y -= 13;
    if (y < 190) break;
  }
  line();
  y -= 16;
  text('TOTAL RECEIVED', M, 10, bold);
  right(`${r.currency || 'LKR'} ${money(r.amount)}`, width - M, 11, bold, GREEN);
  y -= 13;
  text(amountInWords(Number(r.amount)), M, 8, font, GREY);
  y -= 16;
  kv('Payment method', String(r.method || '').replace(/_/g, ' '));
  if (r.reference) kv('Reference', r.reference);
  kv('Total arrears after', `${r.currency || 'LKR'} ${money(r.arrears_after)}`);
  const open = (r.open_months || []).map((m: { month: string; balance: number }) => `${m.month} (${money(m.balance)})`).join(', ');
  if (open) {
    text('Outstanding months', M, 9, font, GREY);
    text(open.length > 60 ? open.slice(0, 60) + '...' : open, M + 92, 8);
    y -= 13;
  }
  if (r.notes) kv('Note', String(r.notes).slice(0, 60));

  // Signatures
  y = 120;
  page.drawLine({ start: { x: M, y }, end: { x: M + 140, y }, thickness: 0.5, color: GREY });
  page.drawLine({ start: { x: width - M - 140, y }, end: { x: width - M, y }, thickness: 0.5, color: GREY });
  y -= 11;
  text(`Received by: ${r.received_by || 'Accounts office'}`, M, 8, font, GREY);
  right('Authorised signature / seal', width - M, 8, font, GREY);

  // Footer
  y = 60;
  line(0.4);
  y -= 12;
  text('This is a computer-generated receipt. Please keep it for your records.', M, 7.5, font, GREY);
  if (opts.verifyUrl) {
    y -= 10;
    text(`Verify: ${opts.verifyUrl}`, M, 7, font, GREY);
  }

  if (r.status === 'reversed') {
    page.drawText('REVERSED', {
      x: 70, y: 260, size: 64, font: bold, color: rgb(0.8, 0.1, 0.1), opacity: 0.25, rotate: degrees(30),
    });
  }
  return await doc.save();
}

export function base64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}
