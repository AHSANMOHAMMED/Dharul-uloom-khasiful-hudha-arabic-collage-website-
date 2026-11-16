import { amountInWords, colomboDateTime, methodLabel, monthLabel, receiptPublicUrl } from '../receiptPrint';

/** Slip builders: turn each ERP record into the common slip model (see slipRender.js). */

const n2 = (v) => Number(v || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amt = (v, cur = 'LKR') => `${cur} ${n2(v)}`;
const day = (v) => {
  if (!v) return '';
  const d = new Date(String(v).length === 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const FUNDS = { general: 'General', zakat: 'Zakat', sadaqah: 'Sadaqah', waqf: 'Waqf', sponsorship: 'Sponsorship', building: 'Building fund' };

/** Organization row (organizations / receipt JSON) → slip header. */
export function slipOrg(o = {}) {
  return {
    name_en: o.name_en || o.short_name || 'Institution',
    name_ar: o.name_ar || '',
    address: o.address || '',
    phone: o.phone || o.contact_phone || '',
    email: o.email || o.contact_email || '',
    registration_no: o.registration_no || o.settings?.registration_no || '',
    logo_url: o.logo_url || o.branding?.logo_url || '',
  };
}

/** Fee receipt JSON (fee_receipt_details / receive_student_payment). */
export function feeReceiptSlip(r) {
  const st = r?.student || {};
  const cur = r?.currency || 'LKR';
  const parents = Array.isArray(st.parents) ? st.parents.filter(Boolean).join(', ') : '';
  const open = (r?.open_months || []).map((m) => `${monthLabel(m.month)} (${n2(m.balance)})`).join(', ');
  const link = receiptPublicUrl(r?.public_token);
  return {
    title: 'Official Receipt',
    number: r?.receipt_no,
    date: colomboDateTime(r?.paid_at),
    org: slipOrg(r?.organization),
    status: r?.status === 'reversed' ? 'REVERSED' : null,
    party: [
      ['Student', st.full_name || '—'],
      ['Index No.', st.index_number || '—'],
      ['Class', st.class_number ? `Class ${st.class_number}` : '—'],
      ['Parent / guardian', parents || st.guardian_name || '—'],
      ['Paid by', r?.payer_name || ''],
    ],
    columns: [
      { label: 'Month', kind: 'text' },
      { label: 'Invoice', kind: 'text', rawSkip: true },
      { label: 'Fee', kind: 'num', align: 'right' },
      { label: 'Paid now', kind: 'num', align: 'right' },
      { label: 'Balance', kind: 'num', align: 'right' },
    ],
    rows: (r?.allocations || []).map((a) => [
      a.month_label || monthLabel(a.month), a.invoice_no || '', n2(a.invoice_total), n2(a.paid_now),
      Number(a.balance_after) > 0 ? n2(a.balance_after) : 'PAID',
    ]),
    totals: [{ label: 'TOTAL RECEIVED', value: amt(r?.amount, cur), strong: true }],
    words: amountInWords(r?.amount, cur),
    details: [
      ['Method', methodLabel(r?.method)],
      ['Reference', r?.reference || ''],
      ['Arrears after', amt(r?.arrears_after, cur)],
      ['Outstanding', open || 'None'],
      ['Received by', r?.received_by || 'Accounts office'],
    ],
    notes: r?.notes || '',
    signatures: ['Cashier', 'Official seal'],
    footer: link ? `Verify: ${link}` : 'Computer-generated receipt.',
  };
}

/** donations row. */
export function donationSlip(org, d, student) {
  const cur = d?.currency || 'LKR';
  return {
    title: 'Donation Receipt',
    number: d?.receipt_no,
    date: day(d?.donation_date || d?.created_at),
    org: slipOrg(org),
    status: d?.status === 'reversed' ? 'REVERSED' : null,
    party: [
      ['Donor', d?.is_anonymous ? 'Anonymous donor' : d?.donor_name || '—'],
      ['Contact', d?.is_anonymous ? '' : [d?.donor_phone, d?.donor_email].filter(Boolean).join(', ')],
      ['Fund', FUNDS[d?.fund_type] || d?.fund_type || 'General'],
      ['Sponsored student', student?.full_name || ''],
    ],
    totals: [{ label: 'AMOUNT RECEIVED', value: amt(d?.amount, cur), strong: true }],
    words: amountInWords(d?.amount, cur),
    details: [
      ['Method', methodLabel(d?.method)],
      ['Reference', d?.reference || ''],
    ],
    notes: [d?.notes, 'Jazakumullahu khairan - may Allah reward you abundantly.'].filter(Boolean).join('\n'),
    signatures: ['Received by', 'Official seal'],
    footer: 'Thank you for your support.',
  };
}

const DOC_TITLES = {
  quotation: 'Quotation', bill: 'Invoice / Bill', sale: 'Sales Bill', fee_invoice: 'Fee Invoice',
  donation: 'Donation Receipt', sadaqah: 'Sadaqah Receipt', receipt: 'Receipt',
};

/** finance_documents row + lines (+ payments). */
export function financeDocSlip(org, doc, lines = [], payments = []) {
  const cur = doc?.currency || 'LKR';
  const paid = Number(doc?.paid_amount || 0);
  const balance = Number(doc?.total || 0) - paid;
  const isQuote = doc?.doc_type === 'quotation';
  const isGift = doc?.doc_type === 'donation' || doc?.doc_type === 'sadaqah';
  const totals = [{ label: isQuote ? 'QUOTED TOTAL' : 'TOTAL', value: amt(doc?.total, cur), strong: true }];
  if (!isQuote && !isGift) {
    totals.push({ label: 'Paid', value: amt(paid, cur) });
    totals.push({ label: 'BALANCE DUE', value: amt(balance, cur), strong: balance > 0 });
  }
  const recorded = (payments || []).filter((p) => p.status !== 'reversed');
  return {
    title: DOC_TITLES[doc?.doc_type] || 'Document',
    number: doc?.doc_number || 'DRAFT',
    date: day(doc?.issued_at || doc?.created_at),
    org: slipOrg(org),
    status: doc?.status === 'void' ? 'VOID' : doc?.status === 'draft' ? 'DRAFT' : doc?.status === 'paid' && !isGift ? 'PAID' : null,
    party: [
      [isGift ? 'Donor' : isQuote ? 'Quoted to' : 'Bill to', doc?.party_name || '—'],
      ['Phone', doc?.party_phone || ''],
      ['Valid until', isQuote ? day(doc?.valid_until) : ''],
      ['Status', doc?.status],
    ],
    columns: [
      { label: 'Description', kind: 'text' },
      { label: 'Qty', kind: 'qty', align: 'right' },
      { label: 'Rate', kind: 'num', align: 'right' },
      { label: 'Amount', kind: 'num', align: 'right' },
    ],
    rows: (lines || []).map((l) => [l.description, String(Number(l.qty)), n2(l.unit_amount), n2(l.line_total ?? Number(l.qty) * Number(l.unit_amount))]),
    totals,
    words: amountInWords(doc?.total, cur),
    details: recorded.length ? [['Payments', recorded.map((p) => `${p.receipt_no} ${day(p.paid_on)} ${n2(p.amount)}`).join('; ')]] : [],
    notes: [doc?.notes, doc?.status === 'amended' && doc?.amend_reason ? `Amended: ${doc.amend_reason}` : '', doc?.status === 'void' ? `Void: ${doc?.void_reason || doc?.amend_reason || ''}` : '']
      .filter(Boolean).join('\n'),
    signatures: isQuote ? ['Prepared by', 'Authorised signature'] : ['Prepared by', 'Customer signature'],
    footer: doc?.public_token && typeof window !== 'undefined'
      ? `View online: ${window.location.origin}${isQuote ? '/q/' : '/b/'}${doc.public_token}` : '',
  };
}

/** One payment on a bill (finance_document_payments row). */
export function financePaymentSlip(org, doc, p) {
  const cur = doc?.currency || 'LKR';
  return {
    title: 'Payment Receipt',
    number: p?.receipt_no,
    date: day(p?.paid_on || p?.created_at),
    org: slipOrg(org),
    status: p?.status === 'reversed' ? 'REVERSED' : null,
    party: [
      ['Received from', doc?.party_name || '—'],
      ['Against', `${DOC_TITLES[doc?.doc_type] || 'Bill'} ${doc?.doc_number || ''}`],
      ['Bill total', amt(doc?.total, cur)],
      ['Balance now', amt(Number(doc?.total || 0) - Number(doc?.paid_amount || 0), cur)],
    ],
    totals: [{ label: 'AMOUNT RECEIVED', value: amt(p?.amount, cur), strong: true }],
    words: amountInWords(p?.amount, cur),
    details: [
      ['Method', methodLabel(p?.method)],
      ['Reference', p?.reference || ''],
    ],
    notes: p?.status === 'reversed' ? `Reversed: ${p?.reversal_reason || ''}` : '',
    signatures: ['Cashier', 'Official seal'],
    footer: 'Computer-generated receipt.',
  };
}

/** expenses row → payment voucher signed by the payee. */
export function expenseVoucherSlip(org, e, people = {}) {
  const cur = e?.currency || 'LKR';
  const who = (id) => people[id]?.full_name || '';
  return {
    title: 'Payment Voucher',
    number: e?.expense_no,
    date: day(e?.paid_at || e?.expense_date),
    org: slipOrg(org),
    status: e?.status === 'void' ? 'VOID' : e?.status === 'rejected' ? 'REJECTED' : e?.status !== 'paid' ? 'NOT PAID' : null,
    party: [
      ['Pay to', e?.payee || '—'],
      ['Expense date', day(e?.expense_date)],
      ['Account', e?.account ? `${e.account.code} ${e.account.name}` : ''],
      ['Status', e?.status],
    ],
    columns: [
      { label: 'Particulars', kind: 'text' },
      { label: 'Amount', kind: 'num', align: 'right' },
    ],
    rows: [[e?.description || '—', n2(e?.amount)]],
    totals: [{ label: 'TOTAL PAID', value: amt(e?.amount, cur), strong: true }],
    words: amountInWords(e?.amount, cur),
    details: [
      ['Method', e?.payment_method ? methodLabel(e.payment_method) : ''],
      ['Cheque / ref.', e?.reference || ''],
      ['Requested by', who(e?.submitted_by)],
      ['Approved by', who(e?.approved_by)],
      ['Paid by', who(e?.paid_by)],
    ],
    signatures: ['Prepared by', 'Approved by', 'Received by (payee)'],
    footer: 'Attach the bill / invoice to this voucher.',
  };
}

/** petty_cash_entries row → petty cash voucher. */
export function pettyVoucherSlip(org, e, { fundTitle = '', holder = '', account = null } = {}) {
  const kind = e?.entry_type === 'topup' ? 'Petty Cash Top-up' : e?.entry_type === 'return' ? 'Petty Cash Return' : 'Petty Cash Voucher';
  return {
    title: kind,
    number: `PCV-${String(e?.id || '').slice(0, 8).toUpperCase()}`,
    date: day(e?.entry_date),
    org: slipOrg(org),
    status: e?.status === 'rejected' ? 'REJECTED' : e?.status === 'void' ? 'VOID' : null,
    party: [
      ['Fund / duty', fundTitle],
      ['Holder', holder],
      ['Vendor', e?.vendor || ''],
      ['Account', account ? `${account.code} ${account.name}` : ''],
    ],
    columns: [
      { label: 'Particulars', kind: 'text' },
      { label: 'Amount', kind: 'num', align: 'right' },
    ],
    rows: [[e?.description || '—', n2(e?.amount)]],
    totals: [{ label: 'TOTAL', value: amt(e?.amount), strong: true }],
    words: amountInWords(e?.amount),
    details: [['Status', e?.status]],
    signatures: ['Holder', 'Approved by', 'Received by'],
    footer: 'Attach the original bill to this voucher.',
  };
}

/** payslip (payroll_payslips view row). */
export function payslipSlip(org, ps) {
  const rows = [
    ['Basic salary', n2(ps?.basic), ''],
    ...(ps?.earnings || []).map((x) => [x.name || x.code, n2(x.amount), '']),
    ...(ps?.deductions || []).map((x) => [x.name || x.code, '', n2(x.amount)]),
  ];
  return {
    title: 'Pay Slip',
    number: ps?.employee_no ? `${ps.employee_no} / ${ps?.period || ''}` : ps?.period,
    date: ps?.period ? monthLabel(ps.period) : '',
    org: slipOrg(org),
    status: ps?.status === 'void' ? 'VOID' : null,
    party: [
      ['Employee', ps?.staff_name || '—'],
      ['Employee No.', ps?.employee_no || ''],
      ['Working days', ps?.working_days ?? ''],
      ['Unpaid days', ps?.unpaid_days ? String(ps.unpaid_days) : ''],
    ],
    columns: [
      { label: 'Item', kind: 'text' },
      { label: 'Earnings', kind: 'num', align: 'right' },
      { label: 'Deductions', kind: 'num', align: 'right' },
    ],
    rows,
    totals: [
      { label: 'Gross pay', value: n2(ps?.gross) },
      { label: 'Total deductions', value: n2(ps?.total_deductions) },
      { label: 'NET PAY', value: amt(ps?.net), strong: true },
    ],
    words: amountInWords(ps?.net),
    details: [
      ['Employer EPF/ETF', (ps?.employer_contributions || []).map((c) => `${c.name || c.code} ${n2(c.amount)}`).join(', ')],
      ['Payment ref.', ps?.payment_reference || ''],
    ],
    signatures: ['Prepared by', 'Employee signature'],
    footer: 'Confidential.',
  };
}

/** Sample used by the settings dialog ("Print sample slip"). */
export function sampleSlip(org) {
  return {
    ...feeReceiptSlip({
      receipt_no: 'SAMPLE-0001', amount: 3000, method: 'cash', paid_at: new Date().toISOString(), arrears_after: 2000,
      organization: org, received_by: 'Accounts office', payer_name: 'Parent',
      student: { full_name: 'Sample Student', index_number: 'IDX-001', class_number: 3, parents: ['Sample Parent'] },
      allocations: [
        { month: '2026-10', invoice_no: 'INV-1', invoice_total: 2500, paid_now: 2500, balance_after: 0 },
        { month: '2026-11', invoice_no: 'INV-2', invoice_total: 2500, paid_now: 500, balance_after: 2000 },
      ],
      open_months: [{ month: '2026-11', balance: 2000 }],
    }),
    footer: 'Sample slip - check alignment and fonts.',
  };
}
