import { toast } from 'react-toastify';
import { tx } from '../../../lib/tx';
import { rpc } from '../../../lib/erp/rpc';
import { num, runAction } from '../../../lib/erp/financeApi';
import { printReceipt, receiptPdfUrl, receiptPublicUrl } from '../../../lib/receiptPrint';
import { getSlipSettings } from '../../../lib/slip/slipSettings';
import { printSlip } from '../../../lib/slip/slipRender';
import { feeReceiptSlip } from '../../../lib/slip/slipModels';

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
    toast.info(url);
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
// Printing follows this counter's slip printer settings (Printer settings
// dialog): Epson LQ-310 driver slip, raw ESC/P (.prn) or laser / inkjet.
// ---------------------------------------------------------------------------
/** Print with the counter settings, or force a mode: 'lq310' | 'raw' | 'laser'. */
export function printWithPrinter(receipt, mode, opts = {}) {
  if (!receipt) return;
  const s = getSlipSettings();
  const m = ['lq310', 'raw', 'laser'].includes(mode) ? mode : s.mode;
  if (m === 'laser') {
    return printReceipt(receipt, { ...opts, copies: s.copies, paper: s.paper === 'a4' ? 'A4' : 'A5' });
  }
  return printSlip(feeReceiptSlip(receipt), { mode: m });
}

/** Raw ESC/P job for the Epson LQ-310 (printer fonts, fastest). */
export function downloadPrn(receipt) {
  printSlip(feeReceiptSlip(receipt), { mode: 'raw' });
}
