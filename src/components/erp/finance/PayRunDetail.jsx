import { useState } from 'react';
import { AsyncView, Button, Field, Input, Modal, Select, Stat, StatusBadge, Table, useAsync, useLang } from '../ui';
import { useAuth } from '../../../context/AuthContext';
import { query, rpc, formatMoney, formatDate, downloadCsv } from '../../../lib/erp/rpc';
import { accountLabel, listCashBankAccounts, num, runAction, useOrg } from '../../../lib/erp/financeApi';
import { ConfirmModal, Num } from './shared';
import { printPayslip, printPayslips } from './payslipPrint';

function AdjustModal({ payslip, onClose, onDone }) {
  const { t } = useLang();
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [comps] = useAsync(() => query('salary_components', (q) => q.select('code, name, kind').eq('is_system', false).eq('is_active', true).order('kind').order('name')), []);
  const comp = (comps.data || []).find((c) => c.code === code);
  const amt = num(amount);
  const tooBig = comp?.kind === 'deduction' && amt > num(payslip.net);
  const valid = code && amt > 0 && !tooBig;

  const save = async () => {
    setBusy(true);
    const ok = await runAction(
      () => rpc('adjust_payslip', { p_payslip: payslip.id, p_code: code, p_amount: Math.round(amt * 100) / 100, p_note: note.trim() || null }),
      t('Payslip adjusted', 'تم تعديل قسيمة الراتب'),
    );
    setBusy(false);
    if (ok) onDone();
  };

  return (
    <Modal
      open
      title={`${t('Adjust payslip', 'تعديل قسيمة الراتب')} — ${payslip.staff_name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button onClick={save} disabled={!valid || busy}>
            {t('Apply', 'تطبيق')}
          </Button>
        </>
      }
    >
      <Field label={t('Component', 'البند')}>
        <Select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('Select…', 'اختر…')}
          options={(comps.data || []).map((c) => ({ value: c.code, label: `${c.kind === 'earning' ? '+' : '−'} ${c.name} (${c.code})` }))}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('Amount', 'المبلغ')} hint={tooBig ? t('Exceeds net pay', 'يتجاوز صافي الراتب') : `${t('Current net', 'الصافي الحالي')}: ${formatMoney(payslip.net)}`}>
          <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label={t('Note (shown on payslip)', 'ملاحظة (تظهر في القسيمة)')}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <p className="text-xs text-gray-500">
        {t('Adjustments do not recompute EPF/ETF. Regenerating the draft run discards adjustments.', 'التعديلات لا تعيد حساب صندوق الادخار/الثقة، وإعادة إنشاء المسودة تلغي التعديلات.')}
      </p>
    </Modal>
  );
}

function PayModal({ run, onClose, onDone }) {
  const { t, ar } = useLang();
  const [code, setCode] = useState('1010');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [accounts] = useAsync(() => listCashBankAccounts(), []);
  const options = (accounts.data || []).length
    ? accounts.data.map((a) => ({ value: a.code, label: accountLabel(a, ar) }))
    : [
        { value: '1010', label: '1010 · Bank - Current Account' },
        { value: '1000', label: '1000 · Cash in Hand' },
      ];

  const pay = async () => {
    if (!window.confirm(t(`Pay net salaries of ${formatMoney(run.total_net)} for ${run.period}?`, `دفع صافي رواتب ${formatMoney(run.total_net)} لشهر ${run.period}؟`))) return;
    setBusy(true);
    const ok = await runAction(
      () => rpc('pay_payroll', { p_run: run.id, p_account_code: code, p_reference: reference.trim() || null }),
      t('Payroll paid — staff notified', 'تم دفع الرواتب وإشعار الموظفين'),
    );
    setBusy(false);
    if (ok) onDone();
  };

  return (
    <Modal
      open
      title={`${t('Pay payroll', 'دفع الرواتب')} ${run.period}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button onClick={pay} disabled={busy}>
            {t('Pay', 'دفع')} {formatMoney(run.total_net)}
          </Button>
        </>
      }
    >
      <Field label={t('Pay from', 'الدفع من')}>
        <Select value={code} onChange={(e) => setCode(e.target.value)} options={options} />
      </Field>
      <Field label={t('Reference (bank batch / cheque no.)', 'المرجع (دفعة بنكية / رقم شيك)')}>
        <Input value={reference} onChange={(e) => setReference(e.target.value)} />
      </Field>
    </Modal>
  );
}

export default function PayRunDetail({ runId, onClose, onChanged }) {
  const { t } = useLang();
  const { user, isAdmin, isAccountant, isPrincipal, isHrStaff, isFinanceStaff } = useAuth();
  const org = useOrg(user?.orgId);
  const [adjusting, setAdjusting] = useState(null);
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [approving, setApproving] = useState(false);

  const [state, reload] = useAsync(async () => {
    const [run, slips] = await Promise.all([
      query('payroll_runs', (q) => q.select('*').eq('id', runId).single()),
      query('payslips', (q) => q.select('*').eq('run_id', runId).order('staff_name')),
    ]);
    return { run, slips };
  }, [runId]);

  const changed = () => {
    reload();
    onChanged?.();
  };

  return (
    <Modal open title={t('Payroll run', 'مسير الرواتب')} onClose={onClose}>
      <AsyncView state={state}>
        {({ run, slips }) => {
          const canApprove = (isAccountant || isPrincipal) && (run.created_by !== user?.id || isAdmin);
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl font-bold text-white">{run.period}</span>
                <StatusBadge status={run.status} />
                {run.paid_at && <span className="text-xs text-gray-400">{t('Paid', 'دُفع')} {formatDate(run.paid_at)} · {run.payment_reference || ''}</span>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat label={t('Gross', 'الإجمالي')} value={formatMoney(run.total_gross)} tone="blue" />
                <Stat label={t('Deductions', 'الاستقطاعات')} value={formatMoney(run.total_deductions)} tone="amber" />
                <Stat label={t('Net pay', 'الصافي')} value={formatMoney(run.total_net)} />
                <Stat label={t('Employer EPF/ETF', 'مساهمة صاحب العمل')} value={formatMoney(run.total_employer)} tone="gray" hint={`${run.staff_count} ${t('staff', 'موظف')}`} />
              </div>
              {run.notes && <p className="text-xs text-gray-400 whitespace-pre-line">{run.notes}</p>}

              <div className="flex flex-wrap gap-2">
                {run.status === 'draft' && canApprove && (
                  <Button size="sm" onClick={() => setApproving(true)} disabled={!run.staff_count}>
                    {t('Approve', 'اعتماد')}
                  </Button>
                )}
                {run.status === 'draft' && (isAccountant || isPrincipal) && !canApprove && (
                  <span className="text-xs text-amber-300 self-center">{t('You prepared this run — another approver is required.', 'أنت من أعدّ هذا المسير — يلزم معتمد آخر.')}</span>
                )}
                {run.status === 'approved' && isFinanceStaff && (
                  <Button size="sm" onClick={() => setPaying(true)}>
                    {t('Pay', 'دفع')}
                  </Button>
                )}
                {['draft', 'approved'].includes(run.status) && isAccountant && (
                  <Button size="sm" variant="danger" onClick={() => setCancelling(true)}>
                    {t('Cancel run', 'إلغاء المسير')}
                  </Button>
                )}
                <Button size="sm" variant="secondary" disabled={!slips.length} onClick={() => printPayslips(org, slips)}>
                  {t('Print all payslips', 'طباعة كل القسائم')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!slips.length}
                  onClick={() =>
                    downloadCsv(
                      `payroll-${run.period}.csv`,
                      slips.map((s) => ({
                        employee_no: s.employee_no,
                        staff_name: s.staff_name,
                        basic: s.basic,
                        gross: s.gross,
                        deductions: s.total_deductions,
                        net: s.net,
                        employer: s.employer_total,
                        unpaid_days: s.unpaid_days,
                        status: s.status,
                      })),
                    )
                  }
                >
                  {t('CSV', 'CSV')}
                </Button>
              </div>

              <Table
                rows={slips}
                empty={t('No payslips — add salary profiles and regenerate.', 'لا توجد قسائم — أضف ملفات رواتب وأعد الإنشاء.')}
                columns={[
                  {
                    key: 'staff_name',
                    label: t('Employee', 'الموظف'),
                    render: (s) => (
                      <div>
                        <div>{s.staff_name}</div>
                        <div className="text-xs text-gray-500">
                          {s.employee_no || ''} {num(s.unpaid_days) > 0 ? `· ${s.unpaid_days} ${t('unpaid days', 'أيام غير مدفوعة')}` : ''}
                        </div>
                      </div>
                    ),
                  },
                  { key: 'gross', label: t('Gross', 'الإجمالي'), render: (s) => <Num>{formatMoney(s.gross)}</Num> },
                  { key: 'total_deductions', label: t('Deductions', 'الاستقطاع'), render: (s) => <Num>{formatMoney(s.total_deductions)}</Num> },
                  { key: 'net', label: t('Net', 'الصافي'), render: (s) => <Num className="font-semibold">{formatMoney(s.net)}</Num> },
                  {
                    key: 'actions',
                    label: '',
                    render: (s) => (
                      <div className="flex gap-1 justify-end">
                        {s.status === 'draft' && (isHrStaff || isAccountant) && (
                          <Button size="sm" variant="ghost" onClick={() => setAdjusting(s)}>
                            {t('Adjust', 'تعديل')}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => printPayslip(org, s)}>
                          {t('Print', 'طباعة')}
                        </Button>
                      </div>
                    ),
                  },
                ]}
              />

              {adjusting && (
                <AdjustModal
                  payslip={adjusting}
                  onClose={() => setAdjusting(null)}
                  onDone={() => {
                    setAdjusting(null);
                    changed();
                  }}
                />
              )}
              {paying && (
                <PayModal
                  run={run}
                  onClose={() => setPaying(false)}
                  onDone={() => {
                    setPaying(false);
                    changed();
                  }}
                />
              )}
              <ConfirmModal
                open={approving}
                danger={false}
                title={t('Approve payroll', 'اعتماد الرواتب')}
                message={t(
                  `Approve ${run.period} (net ${formatMoney(run.total_net)})? The salary accrual is posted to the ledger and advance recoveries are applied.`,
                  `اعتماد ${run.period} (صافي ${formatMoney(run.total_net)})؟ سيتم ترحيل استحقاق الرواتب وتطبيق استرداد السلف.`,
                )}
                confirmLabel={t('Approve', 'اعتماد')}
                onClose={() => setApproving(false)}
                onConfirm={async () => {
                  const ok = await runAction(() => rpc('approve_payroll', { p_run: run.id }), t('Payroll approved', 'تم اعتماد الرواتب'));
                  if (ok) changed();
                  return ok;
                }}
              />
              <ConfirmModal
                open={cancelling}
                title={t('Cancel payroll run', 'إلغاء مسير الرواتب')}
                message={
                  run.status === 'approved'
                    ? t('The accrual journal will be reversed and advance recoveries restored.', 'سيتم عكس قيد الاستحقاق واستعادة استرداد السلف.')
                    : t('The draft run will be cancelled.', 'سيتم إلغاء مسودة المسير.')
                }
                requireReason
                confirmLabel={t('Cancel run', 'إلغاء المسير')}
                onClose={() => setCancelling(false)}
                onConfirm={async (reason) => {
                  const ok = await runAction(() => rpc('cancel_payroll', { p_run: run.id, p_reason: reason }), t('Payroll run cancelled', 'تم إلغاء المسير'));
                  if (ok) changed();
                  return ok;
                }}
              />
            </div>
          );
        }}
      </AsyncView>
    </Modal>
  );
}
