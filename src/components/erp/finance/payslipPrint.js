import { esc, money, printDocument, printGrid, printTable } from '../../../lib/erp/financeApi';

function payslipBody(ps) {
  const earnings = [['Basic salary', money(ps.basic)], ...(ps.earnings || []).map((e) => [esc(e.name || e.code), money(e.amount)])];
  const deductions = (ps.deductions || []).map((d) => [esc(d.name || d.code), money(d.amount)]);
  const employer = (ps.employer_contributions || []).map((c) => [esc(c.name || c.code), money(c.amount)]);
  return `
    ${printGrid([
      ['Employee', esc(ps.staff_name)],
      ['Employee No.', esc(ps.employee_no || '—')],
      ['Pay period', esc(ps.period)],
      ['Status', `<span class="badge">${esc(ps.status)}</span>`],
      ['Working days', esc(ps.working_days ?? '—')],
      ['Unpaid days', esc(ps.unpaid_days ?? 0)],
      ['Payment reference', esc(ps.payment_reference || '—')],
    ])}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div><h2>Earnings</h2>${printTable([{ label: 'Item' }, { label: 'Amount', num: true }], earnings, ['Gross pay', money(ps.gross)])}</div>
      <div><h2>Deductions</h2>${printTable([{ label: 'Item' }, { label: 'Amount', num: true }], deductions, ['Total deductions', money(ps.total_deductions)])}</div>
    </div>
    <p class="lbl">Net pay</p>
    <p class="big" style="margin-bottom:12px;">${money(ps.net)}</p>
    <h2>Employer contributions (not deducted from pay)</h2>
    ${printTable([{ label: 'Item' }, { label: 'Amount', num: true }], employer, ['Total employer cost', money(ps.employer_total)])}`;
}

export function printPayslip(org, ps) {
  printDocument({ title: `Payslip ${ps.period}`, org, body: payslipBody(ps) });
}

export function printPayslips(org, slips) {
  const body = slips.map((ps, i) => `<div style="${i ? 'page-break-before:always;padding-top:12px;' : ''}">${payslipBody(ps)}</div>`).join('');
  printDocument({ title: `Payslips ${slips[0]?.period || ''}`, org, body });
}
