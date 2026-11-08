import { useState } from 'react';
import { AsyncView, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Stat, Table, Tabs, Textarea, useAsync, useLang } from '../ui';
import { useAuth } from '../../../context/AuthContext';
import { query, rpc, insertRow, formatMoney, formatDate, today, downloadCsv } from '../../../lib/erp/rpc';
import {
  EXPENSE_STATUSES,
  PAYMENT_METHODS,
  accountLabel,
  labelOf,
  listAccounts,
  listCashBankAccounts,
  num,
  profilesMap,
  runAction,
  toOptions,
} from '../../../lib/erp/financeApi';
import { ConfirmModal, DateRange, FilterBar, Num } from './shared';
import { dutyName, listAssignments, listDutyRoles } from '../../../lib/erp/governanceApi';

const STATUS_TONE = { submitted: 'amber', draft: 'amber', approved: 'blue', paid: 'green', rejected: 'red', void: 'red' };

function ExpenseStatus({ status }) {
  const { t } = useLang();
  return <Badge tone={STATUS_TONE[status] || 'gray'}>{labelOf(EXPENSE_STATUSES, status, t)}</Badge>;
}

/** Duties the claimant may tag: finance staff → every active duty; others → their own active duties. */
function useClaimDuties() {
  const { user, isFinanceStaff } = useAuth();
  const [state] = useAsync(async () => {
    if (isFinanceStaff) return listDutyRoles({ activeOnly: true });
    const mine = await listAssignments({ status: 'active', assigneeId: user?.id });
    const seen = new Map();
    mine.forEach((a) => a.duty && seen.set(a.duty.id, a.duty));
    return [...seen.values()];
  }, [isFinanceStaff, user?.id]);
  return state;
}

const METHODS = ['cash', 'bank_transfer', 'cheque', 'online', 'other'];

function ExpenseForm({ onClose, onSaved }) {
  const { t, ar, lang } = useLang();
  const [form, setForm] = useState({ account_id: '', payee: '', description: '', amount: '', expense_date: today(), reference: '', payment_method: 'cash', duty_role_id: '' });
  const duties = useClaimDuties();
  const [busy, setBusy] = useState(false);
  const [accounts] = useAsync(() => listAccounts((q) => q.eq('type', 'expense').eq('is_active', true)), []);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const valid = form.account_id && form.payee.trim() && form.description.trim() && num(form.amount) > 0 && form.expense_date;

  const save = async () => {
    setBusy(true);
    const ok = await runAction(
      () =>
        insertRow('expenses', {
          account_id: form.account_id,
          payee: form.payee.trim(),
          description: form.description.trim(),
          amount: Math.round(num(form.amount) * 100) / 100,
          expense_date: form.expense_date,
          reference: form.reference.trim() || null,
          payment_method: form.payment_method,
          duty_role_id: form.duty_role_id || null,
          status: 'submitted',
        }),
      t('Expense claim submitted', 'تم تقديم طلب المصروف'),
    );
    setBusy(false);
    if (ok) onSaved();
  };

  return (
    <Modal
      open
      title={t('Submit expense claim', 'تقديم طلب مصروف')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button onClick={save} disabled={!valid || busy}>
            {busy ? t('Submitting…', 'جارٍ التقديم…') : t('Submit', 'تقديم')}
          </Button>
        </>
      }
    >
      <Field label={t('Expense account', 'حساب المصروف')} hint={accounts.error?.message}>
        <Select
          value={form.account_id}
          onChange={(e) => set({ account_id: e.target.value })}
          placeholder={accounts.loading ? t('Loading…', 'جارٍ التحميل…') : t('Select…', 'اختر…')}
          options={(accounts.data || []).map((a) => ({ value: a.id, label: accountLabel(a, ar) }))}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('Payee', 'المستفيد')}>
          <Input value={form.payee} onChange={(e) => set({ payee: e.target.value })} />
        </Field>
        <Field label={t('Amount', 'المبلغ')}>
          <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
        </Field>
        <Field label={t('Date', 'التاريخ')}>
          <Input type="date" max={today()} value={form.expense_date} onChange={(e) => set({ expense_date: e.target.value })} />
        </Field>
        <Field label={t('Preferred payment', 'طريقة الدفع المفضلة')}>
          <Select
            value={form.payment_method}
            onChange={(e) => set({ payment_method: e.target.value })}
            options={METHODS.map((m) => ({ value: m, label: t(PAYMENT_METHODS[m][0], PAYMENT_METHODS[m][1]) }))}
          />
        </Field>
      </div>
      <Field label={t('Description', 'الوصف')}>
        <Textarea rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <Field label={t('Reference / bill no.', 'المرجع / رقم الفاتورة')}>
        <Input value={form.reference} onChange={(e) => set({ reference: e.target.value })} />
      </Field>
      {(duties.data || []).length > 0 && (
        <Field label={t('Duty (optional)', 'المسؤولية (اختياري)')} hint={t('Tag this purchase to a duty so it appears in the duty history', 'اربط هذه المشتريات بمسؤولية لتظهر في سجلها')}>
          <Select
            value={form.duty_role_id}
            onChange={(e) => set({ duty_role_id: e.target.value })}
            placeholder={t('— None —', '— لا شيء —')}
            options={(duties.data || []).map((d) => ({ value: d.id, label: dutyName(d, lang) }))}
          />
        </Field>
      )}
    </Modal>
  );
}

function PayModal({ expense, onClose, onPaid }) {
  const { t, ar } = useLang();
  const [code, setCode] = useState('1000');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [accounts] = useAsync(() => listCashBankAccounts(), []);
  const options = (accounts.data || []).length
    ? accounts.data.map((a) => ({ value: a.code, label: accountLabel(a, ar) }))
    : [
        { value: '1000', label: t('1000 · Cash in Hand', '1000 · النقد في الصندوق') },
        { value: '1010', label: t('1010 · Bank - Current Account', '1010 · الحساب البنكي الجاري') },
      ];

  const pay = async () => {
    if (!window.confirm(`${t('Pay', 'دفع')} ${formatMoney(expense.amount)} → ${expense.payee}?`)) return;
    setBusy(true);
    const ok = await runAction(
      () => rpc('pay_expense', { p_expense: expense.id, p_paid_from_code: code, p_reference: reference.trim() || null }),
      t('Expense paid and posted', 'تم دفع المصروف وترحيله'),
    );
    setBusy(false);
    if (ok) onPaid();
  };

  return (
    <Modal
      open
      title={t('Pay expense', 'دفع المصروف')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button onClick={pay} disabled={busy}>
            {t('Pay', 'دفع')}
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-300">
        {expense.expense_no} · {expense.payee} · <b>{formatMoney(expense.amount)}</b>
      </p>
      <Field label={t('Pay from', 'الدفع من')}>
        <Select value={code} onChange={(e) => setCode(e.target.value)} options={options} />
      </Field>
      <Field label={t('Reference (voucher / cheque no.)', 'المرجع (رقم السند / الشيك)')}>
        <Input value={reference} onChange={(e) => setReference(e.target.value)} />
      </Field>
    </Modal>
  );
}

export default function ExpensesPanel() {
  const { t, ar, lang } = useLang();
  const { user, isAdmin, isAccountant, isPrincipal, isFinanceStaff, isFinanceViewer } = useAuth();
  const canApprove = isAccountant || isPrincipal;
  const [scope, setScope] = useState(isFinanceViewer ? 'all' : 'mine');
  const [filters, setFilters] = useState({ status: '', from: '', to: '' });
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [voiding, setVoiding] = useState(null);

  const [state, reload] = useAsync(async () => {
    const rows = await query('expenses', (q) => {
      let b = q
        .select('*, account:accounts!expenses_account_id_fkey(code, name, name_ar), duty:duty_roles(id, code, name_en, name_ar, name_ta)')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500);
      if (scope === 'mine') b = b.eq('submitted_by', user?.id);
      if (filters.status) b = b.eq('status', filters.status);
      if (filters.from) b = b.gte('expense_date', filters.from);
      if (filters.to) b = b.lte('expense_date', filters.to);
      return b;
    });
    const people = await profilesMap(rows.flatMap((r) => [r.submitted_by, r.approved_by, r.paid_by]));
    return { rows, people };
  }, [scope, filters.status, filters.from, filters.to, user?.id]);

  const approve = async (e) => {
    if (!window.confirm(`${t('Approve', 'اعتماد')} ${e.expense_no} · ${formatMoney(e.amount)}?`)) return;
    if (await runAction(() => rpc('approve_expense', { p_expense: e.id, p_approve: true }), t('Expense approved', 'تم اعتماد المصروف'))) reload();
  };

  const tabs = [
    ...(isFinanceViewer ? [{ id: 'all', label: t('All claims', 'كل الطلبات') }] : []),
    { id: 'mine', label: t('My claims', 'طلباتي') },
  ];

  return (
    <div>
      <PageHeader
        title={t('Expenses', 'المصروفات')}
        subtitle={t('Submit claims, approve, pay and post to the ledger.', 'تقديم الطلبات واعتمادها ودفعها وترحيلها.')}
        actions={<Button onClick={() => setCreating(true)}>+ {t('New expense claim', 'طلب مصروف جديد')}</Button>}
      />
      <Tabs tabs={tabs} active={scope} onChange={setScope} />
      <Card
        actions={
          <>
            <Button size="sm" variant="secondary" disabled={!state.data?.rows.length} onClick={() => downloadCsv('expenses.csv', (state.data?.rows || []).map(({ account, duty, ...r }) => ({ ...r, account: account?.code, duty: duty?.name_en || '' })))}>
              {t('Export CSV', 'تصدير CSV')}
            </Button>
            <Button size="sm" variant="secondary" onClick={reload}>
              {t('Refresh', 'تحديث')}
            </Button>
          </>
        }
      >
        <FilterBar>
          <Field label={t('Status', 'الحالة')}>
            <Select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              placeholder={t('All', 'الكل')}
              options={toOptions(EXPENSE_STATUSES, t)}
            />
          </Field>
          <DateRange from={filters.from} to={filters.to} onChange={(r) => setFilters((f) => ({ ...f, ...r }))} />
        </FilterBar>
        <AsyncView state={state}>
          {({ rows, people }) => {
            const sum = (st) => rows.filter((r) => r.status === st).reduce((s, r) => s + num(r.amount), 0);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Stat label={t('Awaiting approval', 'بانتظار الاعتماد')} value={formatMoney(sum('submitted'))} tone="amber" />
                  <Stat label={t('Approved, unpaid', 'معتمد غير مدفوع')} value={formatMoney(sum('approved'))} tone="blue" />
                  <Stat label={t('Paid', 'مدفوع')} value={formatMoney(sum('paid'))} />
                  <Stat label={t('Rejected / void', 'مرفوض / ملغى')} value={formatMoney(sum('rejected') + sum('void'))} tone="red" />
                </div>
                <Table
                  rows={rows}
                  empty={t('No expense claims', 'لا توجد طلبات مصروفات')}
                  columns={[
                    {
                      key: 'expense_no',
                      label: t('Claim', 'الطلب'),
                      render: (e) => (
                        <div>
                          <div className="font-mono text-xs">{e.expense_no}</div>
                          <div className="text-xs text-gray-500">{formatDate(e.expense_date)}</div>
                        </div>
                      ),
                    },
                    {
                      key: 'payee',
                      label: t('Payee / description', 'المستفيد / الوصف'),
                      render: (e) => (
                        <div className="min-w-[12rem]">
                          <div>{e.payee}</div>
                          <div className="text-xs text-gray-500">{e.description}</div>
                          {e.reference && <div className="text-xs text-gray-500">{t('Ref', 'مرجع')}: {e.reference}</div>}
                          {e.rejection_reason && <div className="text-xs text-red-400">{e.rejection_reason}</div>}
                        </div>
                      ),
                    },
                    { key: 'account', label: t('Account', 'الحساب'), render: (e) => (e.account ? accountLabel(e.account, ar) : '—') },
                    { key: 'duty', label: t('Duty', 'المسؤولية'), render: (e) => (e.duty ? dutyName(e.duty, lang) : '—') },
                    { key: 'amount', label: t('Amount', 'المبلغ'), render: (e) => <Num>{formatMoney(e.amount)}</Num> },
                    {
                      key: 'people',
                      label: t('Submitted / approved', 'المقدِّم / المعتمِد'),
                      render: (e) => (
                        <div className="text-xs">
                          <div>{people[e.submitted_by]?.full_name || '—'}</div>
                          {e.approved_by && <div className="text-gray-500 flex items-center gap-1"><span className="material-symbols-outlined text-[13px] text-emerald-500">check_circle</span><span>{people[e.approved_by]?.full_name || '—'}</span></div>}
                          {e.paid_by && <div className="text-gray-500 flex items-center gap-1"><span className="material-symbols-outlined text-[13px] text-amber-500">payments</span><span>{people[e.paid_by]?.full_name || '—'}</span></div>}
                        </div>
                      ),
                    },
                    { key: 'status', label: t('Status', 'الحالة'), render: (e) => <ExpenseStatus status={e.status} /> },
                    {
                      key: 'actions',
                      label: '',
                      render: (e) => {
                        const own = e.submitted_by === user?.id;
                        return (
                          <div className="flex flex-wrap gap-1 justify-end">
                            {e.status === 'submitted' && canApprove && (!own || isAdmin) && (
                              <>
                                <Button size="sm" onClick={() => approve(e)}>
                                  {t('Approve', 'اعتماد')}
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => setRejecting(e)}>
                                  {t('Reject', 'رفض')}
                                </Button>
                              </>
                            )}
                            {e.status === 'approved' && isFinanceStaff && (
                              <Button size="sm" onClick={() => setPaying(e)}>
                                {t('Pay', 'دفع')}
                              </Button>
                            )}
                            {isAccountant && !['void', 'rejected'].includes(e.status) && (
                              <Button size="sm" variant="ghost" onClick={() => setVoiding(e)}>
                                {t('Void', 'إلغاء')}
                              </Button>
                            )}
                          </div>
                        );
                      },
                    },
                  ]}
                />
              </div>
            );
          }}
        </AsyncView>
      </Card>

      {creating && (
        <ExpenseForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
      {paying && (
        <PayModal
          expense={paying}
          onClose={() => setPaying(null)}
          onPaid={() => {
            setPaying(null);
            reload();
          }}
        />
      )}
      <ConfirmModal
        open={Boolean(rejecting)}
        title={t('Reject expense', 'رفض المصروف')}
        message={rejecting ? `${rejecting.expense_no} · ${rejecting.payee} · ${formatMoney(rejecting.amount)}` : ''}
        requireReason
        confirmLabel={t('Reject', 'رفض')}
        onClose={() => setRejecting(null)}
        onConfirm={async (reason) => {
          const ok = await runAction(() => rpc('approve_expense', { p_expense: rejecting.id, p_approve: false, p_reason: reason }), t('Expense rejected', 'تم رفض المصروف'));
          if (ok) reload();
          return ok;
        }}
      />
      <ConfirmModal
        open={Boolean(voiding)}
        title={t('Void expense', 'إلغاء المصروف')}
        message={
          voiding
            ? voiding.status === 'paid'
              ? t('This expense is paid; voiding posts a reversing journal.', 'هذا المصروف مدفوع؛ الإلغاء يرحّل قيدًا عكسيًا.')
              : t('The claim will be voided.', 'سيتم إلغاء الطلب.')
            : ''
        }
        requireReason
        confirmLabel={t('Void', 'إلغاء')}
        onClose={() => setVoiding(null)}
        onConfirm={async (reason) => {
          const ok = await runAction(() => rpc('void_expense', { p_expense: voiding.id, p_reason: reason }), t('Expense voided', 'تم إلغاء المصروف'));
          if (ok) reload();
          return ok;
        }}
      />
    </div>
  );
}
