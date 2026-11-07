import { toast } from 'react-toastify';
import { tx } from '../../../lib/tx';
import { rpc } from '../../../lib/erp/rpc';
import { num, runAction } from '../../../lib/erp/financeApi';
import { printReceipt, receiptPdfUrl, receiptPublicUrl } from '../../../lib/receiptPrint';
import { downloadReceiptPrn, printReceiptDotMatrix } from '../../../lib/receiptText';

const cents = (v) => Math.round(num(v) * 100);

/** Client-side mirror of receive_student_payment: oldest open month first. */
export function allocateOldestFirst(months, amount) {
  let left = Math.max(cents(amount), 0);
  const sorted = [...(months || [])].sort(
    (a, b) => String(a.month).localeCompare(String(b.month)) || String(a.due_date || '').localeCompare(String(b.due_date || '')),
  );
  const rows = sorted.map((m) => {
    const bal = Math.max(cents(m.balance), 0);
    const take = Math.min(left, bal);
    left -= take;
    return { ...m, paid_now: take / 100, balance_after: (bal - take) / 100 };
  });
  return { rows, unallocated: left / 100 };
}

export function openReceiptPdf(token) {
  const url = receiptPdfUrl(token);
  if (url) window.open(url, '_blank', 'noopener');
  else toast.error(tx('خدمة PDF غير مهيأة.', 'PDF service is not configured.'));
}

export async function copyReceiptLink(token, t) {
  const url = receiptPublicUrl(token);
  try {
    await navigator.clipboard.writeText(url);
    toast.success(t('Receipt link copied', 'تم نسخ رابط الإيصال'));
  } catch {
    window.prompt(t('Copy this link', 'انسخ هذا الرابط'), url);
  }
}

/**
 * Load the full receipt JSON (fee_receipt_details) and print the official slip.
 * payer_name is not part of the receipt JSON, so callers pass it from fee_receipts.
 */
export async function printReceiptById(id, extra = {}, opts = {}) {
  const res = await runAction(() => rpc('fee_receipt_details', { p_receipt: id }));
  if (res && typeof res === 'object') printWithPrinter({ ...res, payer_name: res.payer_name ?? extra.payer_name ?? null }, opts.printer, opts);
}

// ---------------------------------------------------------------------------
// Counter printer preference (per browser): 'a5' (laser/inkjet, A5 slip),
// 'a4x2' (office + parent copy on A4) or 'lq310' (Epson LQ-310 dot-matrix).
// ---------------------------------------------------------------------------
export const PRINTERS = [
  { value: 'a5', en: 'A5 slip (laser / inkjet)', ar: 'إيصال A5 (ليزر / حبر)' },
  { value: 'a4x2', en: '2 copies on A4 (office + parent)', ar: 'نسختان على A4 (المكتب + ولي الأمر)' },
  { value: 'lq310', en: 'Epson LQ-310 dot-matrix (A5)', ar: 'طابعة نقطية Epson LQ-310 (A5)' },
];
const PRINTER_KEY = 'kh_receipt_printer';

export function getPrinterPref() {
  try {
    const v = localStorage.getItem(PRINTER_KEY);
    return PRINTERS.some((p) => p.value === v) ? v : 'a5';
  } catch {
    return 'a5';
  }
}

export function setPrinterPref(value) {
  try {
    localStorage.setItem(PRINTER_KEY, value);
  } catch {
    /* storage blocked — preference lasts for this page only */
  }
}

/** Print with the chosen (or remembered) printer profile. */
export function printWithPrinter(receipt, printer = getPrinterPref(), opts = {}) {
  if (printer === 'lq310') return printReceiptDotMatrix(receipt);
  if (printer === 'a4x2') return printReceipt(receipt, { ...opts, copies: 2 });
  return printReceipt(receipt, { ...opts, copies: 1 });
}

/** Raw ESC/P job for the Epson LQ-310 (fastest, printer fonts). */
export function downloadPrn(receipt) {
  downloadReceiptPrn(receipt);
}
