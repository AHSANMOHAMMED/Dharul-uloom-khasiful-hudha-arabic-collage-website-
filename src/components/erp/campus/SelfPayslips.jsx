import { toast } from 'react-toastify';
import { AsyncView, Button, Card, StatusBadge, Table, useAsync, useLang } from '../ui';
import { formatDate, formatMoney, query } from '../../../lib/erp/rpc';
import { errMsg, escapeHtml, fetchMyOrg, openPrintWindow, printHeader } from '../../../lib/erp/campusApi';

function lines(list) {
  return (Array.isArray(list) ? list : [])
    .map((l) => `<tr><td>${escapeHtml(l.name || l.code)}</td><td class="num">${escapeHtml(formatMoney(l.amount))}</td></tr>`)
    .join('');
}

async function printPayslip(ps, orgId) {
  const org = await fetchMyOrg(orgId).catch(() => null);
  const body = `${printHeader(org)}
<h1>Payslip · ${escapeHtml(ps.period)}</h1>
<div class="meta">
  <div><div class="k">Employee</div><div class="v">${escapeHtml(ps.staff_name)}</div></div>
  <div><div class="k">Employee no.</div><div class="v">${escapeHtml(ps.employee_no || '—')}</div></div>
  <div><div class="k">Period</div><div class="v">${escapeHtml(ps.period)}</div></div>
  <div><div class="k">Status</div><div class="v">${escapeHtml(ps.status)}${ps.paid_at ? ` · ${escapeHtml(formatDate(ps.paid_at))}` : ''}</div></div>
  <div><div class="k">Working days</div><div class="v">${escapeHtml(ps.working_days ?? '—')}</div></div>
  <div><div class="k">Unpaid days</div><div class="v">${escapeHtml(ps.unpaid_days ?? 0)}</div></div>
</div>
<table><thead><tr><th>Earnings</th><th class="num">Amount</th></tr></thead><tbody>
<tr><td>Basic salary</td><td class="num">${escapeHtml(formatMoney(ps.basic))}</td></tr>
${lines(ps.earnings)}
<tr class="total"><td>Gross pay</td><td class="num">${escapeHtml(formatMoney(ps.gross))}</td></tr>
</tbody></table>
<table><thead><tr><th>Deductions</th><th class="num">Amount</th></tr></thead><tbody>
${lines(ps.deductions) || '<tr><td colspan="2">—</td></tr>'}
<tr class="total"><td>Total deductions</td><td class="num">${escapeHtml(formatMoney(ps.total_deductions))}</td></tr>
</tbody></table>
<table><tbody><tr class="total"><td>NET PAY</td><td class="num">${escapeHtml(formatMoney(ps.net))}</td></tr></tbody></table>
<table><thead><tr><th>Employer contributions (not deducted)</th><th class="num">Amount</th></tr></thead><tbody>
${lines(ps.employer_contributions) || '<tr><td colspan="2">—</td></tr>'}
</tbody></table>
${ps.payment_reference ? `<p class="muted">Payment reference: ${escapeHtml(ps.payment_reference)}</p>` : ''}
<div class="foot"><div class="sig"><div class="line"></div>Employee</div><div class="sig"><div class="line"></div>Authorised signatory</div></div>
<p class="muted" style="margin-top:16px">Computer-generated payslip · ${escapeHtml(new Date().toLocaleString('en-GB'))}</p>`;
  openPrintWindow(`Payslip ${ps.period} — ${ps.staff_name}`, body);
}

export default function SelfPayslips({ user }) {
  const { t } = useLang();
  const [state] = useAsync(
    () => query('payslips', (q) => q.select('*').eq('staff_id', user.id).order('period', { ascending: false })),
    [user.id]
  );
  const onPrint = async (ps) => {
    try {
      await printPayslip(ps, user.orgId);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <Card title={t('My payslips', 'قسائم راتبي')}>
      <AsyncView state={state}>
        {(rows) => (
          <Table
            rows={rows}
            empty={t('No approved payslips yet.', 'لا توجد قسائم معتمدة بعد.')}
            columns={[
              { key: 'period', label: t('Period', 'الفترة') },
              { key: 'gross', label: t('Gross', 'الإجمالي'), render: (r) => formatMoney(r.gross) },
              { key: 'total_deductions', label: t('Deductions', 'الاستقطاعات'), render: (r) => formatMoney(r.total_deductions) },
              { key: 'net', label: t('Net', 'الصافي'), render: (r) => <span className="font-bold text-emerald-300">{formatMoney(r.net)}</span> },
              { key: 'status', label: t('Status', 'الحالة'), render: (r) => <StatusBadge status={r.status} /> },
              { key: 'act', label: '', render: (r) => <Button size="sm" variant="secondary" onClick={() => onPrint(r)}>{t('Print', 'طباعة')}</Button> },
            ]}
          />
        )}
      </AsyncView>
    </Card>
  );
}
