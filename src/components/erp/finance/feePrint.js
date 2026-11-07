import { PAYMENT_METHODS, esc, money, date, printDocument, printGrid, printTable } from '../../../lib/erp/financeApi';

const methodName = (m) => (PAYMENT_METHODS[m] ? PAYMENT_METHODS[m][0] : m);

/** Printable receipt for one fee payment. */
export function printFeeReceipt({ org, invoice, student, payment }) {
  const balance = Number(invoice.total_due || 0) - Number(invoice.paid_amount || 0);
  const body = `
    ${printGrid([
      ['Receipt No.', esc(payment.receipt_no)],
      ['Date', date(payment.paid_at)],
      ['Student', esc(student?.full_name)],
      ['Index No.', esc(student?.index_number)],
      ['Class', esc(student?.class_number)],
      ['Invoice', `${esc(invoice.invoice_no)} (${esc(invoice.month)})`],
      ['Method', esc(methodName(payment.method))],
      ['Reference', esc(payment.reference || '—')],
    ])}
    ${payment.status === 'reversed' ? `<p class="badge" style="background:#fee2e2;color:#991b1b;margin-bottom:12px;">REVERSED: ${esc(payment.reversal_reason)}</p>` : ''}
    <p class="lbl">Amount received</p>
    <p class="big" style="margin-bottom:16px;">${money(payment.amount)}</p>
    ${printTable(
      [{ label: 'Invoice summary' }, { label: 'Amount', num: true }],
      [
        ['Invoice total', money(invoice.total_due)],
        ['Total paid to date', money(invoice.paid_amount)],
      ],
      ['Balance remaining', money(balance)],
    )}
    <div style="display:flex;justify-content:space-between;"><div class="sig">Received by</div><div class="sig">Payer</div></div>`;
  printDocument({ title: 'Fee Payment Receipt', org, body });
}

/** Printable invoice / statement with lines and receipts. */
export function printFeeInvoice({ org, invoice, student, lines, payments }) {
  const body = `
    ${printGrid([
      ['Invoice No.', esc(invoice.invoice_no)],
      ['Month', esc(invoice.month)],
      ['Student', esc(student?.full_name)],
      ['Index No.', esc(student?.index_number)],
      ['Class', esc(student?.class_number)],
      ['Due date', date(invoice.due_date)],
      ['Status', `<span class="badge">${esc(invoice.status)}</span>`],
    ])}
    <h2>Charges</h2>
    ${printTable(
      [{ label: 'Description' }, { label: 'Type' }, { label: 'Amount', num: true }],
      (lines || []).map((l) => [esc(l.description), esc(l.kind), money(l.amount)]),
      ['Total due', '', money(invoice.total_due)],
    )}
    <h2>Payments</h2>
    ${printTable(
      [{ label: 'Receipt' }, { label: 'Date' }, { label: 'Method' }, { label: 'Status' }, { label: 'Amount', num: true }],
      (payments || []).map((p) => [esc(p.receipt_no), date(p.paid_at), esc(methodName(p.method)), esc(p.status), money(p.amount)]),
      ['Paid', '', '', '', money(invoice.paid_amount)],
    )}
    <p class="big">Balance: ${money(Number(invoice.total_due || 0) - Number(invoice.paid_amount || 0))}</p>`;
  printDocument({ title: 'Fee Invoice', org, body });
}
