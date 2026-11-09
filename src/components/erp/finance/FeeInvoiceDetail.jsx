import { useState } from 'react';
import { toast } from 'react-toastify';
import { AsyncView, Badge, Button, Field, Input, Modal, Select, StatusBadge, Table, Textarea, useAsync, useLang } from '../ui';
import { useAuth } from '../../../context/AuthContext';
import { query, rpc, formatMoney, formatDate, today } from '../../../lib/erp/rpc';
import { PAYMENT_METHODS, labelOf, num, runAction, useOrg } from '../../../lib/erp/financeApi';
import { ConfirmModal, Num } from './shared';
import FeeChargeForm from './FeeChargeForm';
import { printFeeInvoice, printFeeReceipt } from './feePrint';
import { openReceiptPdf, printReceiptById } from './receiptActions';

const MANUAL_METHODS = ['cash', 'bank_transfer', 'cheque', 'online', 'other'];

function PaymentForm({ invoice, onDone, onCancel }) {
  const { t } = useLang();
  const balance = num(invoice.total_due) - num(invoice.paid_amount);
  const [form, setForm] = useState({ amount: balance > 0 ? balance.toFixed(2) : '', method: 'cash', reference: '', notes: '', date: today() });
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const amount = num(form.amount);
  const needsRef = form.method !== 'cash';
  const valid = amount > 0 && amount <= balance + 0.001 && (!needsRef || form.reference.trim());

  const submit = async () => {
    if (!window.confirm(t(`Record a payment of ${formatMoney(amount)}?`, `تسجيل دفعة بقيمة ${formatMoney(amount)}؟`))) return;
    setBusy(true);
    const paidAt = form.date === today() ? new Date().toISOString() : `${form.date}T12:00:00`;
    const res = await runAction(() =>
      rpc('record_fee_payment', {
        p_fee: invoice.id,
        p_amount: amount,
        p_method: form.method,
        p_reference: form.reference.trim() || null,
        p_notes: form.notes.trim() || null,
        p_paid_at: paidAt,
      }),
    );
    setBusy(false);
    if (res) onDone(res);
  };

  return (
    <div className="space-y-3 rounded-xl border border-gray-800 p-4 bg-gray-900/40">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('Amount', 'المبلغ')} hint={`${t('Balance', 'الرصيد')}: ${formatMoney(balance)}`}>
          <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
        </Field>
        <Field label={t('Method', 'طريقة الدفع')}>
          <Select
            value={form.method}
            onChange={(e) => set({ method: e.target.value })}
            options={MANUAL_METHODS.map((m) => ({ value: m, label: labelOf(PAYMENT_METHODS, m, t) }))}
          />
        </Field>
        <Field label={needsRef ? t('Reference (required)', 'المرجع (مطلوب)') : t('Reference', 'المرجع')}>
          <Input value={form.reference} onChange={(e) => set({ reference: e.target.value })} placeholder={t('Cheque / transfer no.', 'رقم الشيك / التحويل')} />
        </Field>
        <Field label={t('Payment date', 'تاريخ الدفع')}>
          <Input type="date" max={today()} value={form.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
      </div>
      <Field label={t('Notes', 'ملاحظات')}>
        <Textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
      {amount > balance + 0.001 && <p className="text-xs text-red-400">{t('Amount exceeds the outstanding balance.', 'المبلغ يتجاوز الرصيد المستحق.')}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {t('Cancel', 'إلغاء')}
        </Button>
        <Button onClick={submit} disabled={!valid || busy}>
          {busy ? t('Saving…', 'جارٍ الحفظ…') : t('Record payment', 'تسجيل الدفعة')}
        </Button>
      </div>
    </div>
  );
}

export default function FeeInvoiceDetail({ invoiceId, student, onClose, onChanged }) {
  const { t } = useLang();
  const { isFinanceStaff, isAccountant, isPrincipal, user } = useAuth();
  const org = useOrg(user?.orgId);
  const [mode, setMode] = useState(null); // 'pay' | 'charge' | 'waive' | 'cancel'
  const [reversing, setReversing] = useState(null);
  const [waiveAmount, setWaiveAmount] = useState('');

  const [state, reload] = useAsync(async () => {
    const [invoice, lines, payments] = await Promise.all([
      query('student_fees', (q) => q.select('*').eq('id', invoiceId).single()),
      query('fee_invoice_lines', (q) => q.select('id, kind, description, amount, created_at').eq('fee_id', invoiceId).order('created_at')),
      query('fee_payments', (q) =>
        q.select('id, receipt_no, receipt_id, amount, method, reference, paid_at, status, reversal_reason, notes, fee_receipts(public_token, payer_name)').eq('fee_id', invoiceId).order('paid_at'),
      ),
    ]);
    return { invoice, lines, payments };
  }, [invoiceId]);

  const refresh = () => {
    setMode(null);
    reload();
    onChanged?.();
  };

  const canWaive = isAccountant || isPrincipal;

  return (
    <Modal open title={t('Invoice details', 'تفاصيل الفاتورة')} onClose={onClose}>
      <AsyncView state={state}>
        {({ invoice, lines, payments }) => {
          const balance = num(invoice.total_due) - num(invoice.paid_amount);
          const open = invoice.status !== 'cancelled';
          const overdue = ['unpaid', 'partial'].includes(invoice.status) && invoice.due_date && invoice.due_date < today();
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-400">{t('Invoice', 'الفاتورة')}</div>
                <div className="text-white font-semibold">{invoice.invoice_no || '—'}</div>
                <div className="text-gray-400">{t('Student', 'الطالب')}</div>
                <div className="text-white">
                  {student?.full_name || '—'} {student?.index_number ? `(${student.index_number})` : ''}
                </div>
                <div className="text-gray-400">{t('Month / due', 'الشهر / الاستحقاق')}</div>
                <div className="text-white">
                  {invoice.month} · {formatDate(invoice.due_date)}
                </div>
                <div className="text-gray-400">{t('Status', 'الحالة')}</div>
                <div className="flex gap-2 flex-wrap">
                  <StatusBadge status={invoice.status} />
                  {overdue && <Badge tone="red">{t('Overdue', 'متأخر')}</Badge>}
                </div>
                <div className="text-gray-400">{t('Total / paid / balance', 'الإجمالي / المدفوع / الرصيد')}</div>
                <div className="text-white tabular-nums">
                  {formatMoney(invoice.total_due)} / {formatMoney(invoice.paid_amount)} /{' '}
                  <span className={balance > 0 ? 'text-amber-300' : 'text-emerald-300'}>{formatMoney(balance)}</span>
                </div>
                {invoice.cancel_reason && (
                  <>
                    <div className="text-gray-400">{t('Cancel reason', 'سبب الإلغاء')}</div>
                    <div className="text-red-300">{invoice.cancel_reason}</div>
                  </>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-2">{t('Invoice lines', 'بنود الفاتورة')}</h4>
                <Table
                  rows={lines}
                  empty={t('No lines', 'لا توجد بنود')}
                  columns={[
                    { key: 'description', label: t('Description', 'الوصف') },
                    { key: 'kind', label: t('Type', 'النوع'), render: (l) => <Badge>{l.kind}</Badge> },
                    { key: 'amount', label: t('Amount', 'المبلغ'), render: (l) => <Num>{formatMoney(l.amount)}</Num> },
                  ]}
                />
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-2">{t('Receipts', 'الإيصالات')}</h4>
                <Table
                  rows={payments}
                  empty={t('No payments yet', 'لا توجد مدفوعات بعد')}
                  columns={[
                    {
                      key: 'receipt_no',
                      label: t('Receipt', 'الإيصال'),
                      render: (p) => (
                        <div>
                          <div className="font-mono text-xs">{p.receipt_no}</div>
                          <div className="text-xs text-gray-500">
                            {formatDate(p.paid_at)} · {labelOf(PAYMENT_METHODS, p.method, t)}
                            {p.reference ? ` · ${p.reference}` : ''}
                          </div>
                          {p.reversal_reason && <div className="text-xs text-red-400">{p.reversal_reason}</div>}
                        </div>
                      ),
                    },
                    { key: 'amount', label: t('Amount', 'المبلغ'), render: (p) => <Num>{formatMoney(p.amount)}</Num> },
                    { key: 'status', label: t('Status', 'الحالة'), render: (p) => <StatusBadge status={p.status} /> },
                    {
                      key: 'actions',
                      label: '',
                      render: (p) => (
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              p.receipt_id
                                ? printReceiptById(p.receipt_id, p.fee_receipts || {})
                                : printFeeReceipt({ org, invoice, student, payment: p })
                            }
                          >
                            {t('Print', 'طباعة')}
                          </Button>
                          {p.fee_receipts?.public_token && (
                            <Button size="sm" variant="ghost" onClick={() => openReceiptPdf(p.fee_receipts.public_token)}>
                              {t('PDF', 'PDF')}
                            </Button>
                          )}
                          {isAccountant && p.status === 'posted' && (
                            <Button size="sm" variant="danger" onClick={() => setReversing(p)}>
                              {t('Reverse', 'عكس')}
                            </Button>
                          )}
                        </div>
                      ),
                    },
                  ]}
                />
              </div>

              <div className="flex flex-wrap gap-2 border-t border-gray-800 pt-4">
                <Button variant="secondary" size="sm" onClick={() => printFeeInvoice({ org, invoice, student, lines, payments })}>
                  {t('Print invoice', 'طباعة الفاتورة')}
                </Button>
                {open && isFinanceStaff && balance > 0 && (
                  <Button size="sm" onClick={() => setMode('pay')}>
                    {t('Record payment', 'تسجيل دفعة')}
                  </Button>
                )}
                {open && isFinanceStaff && (
                  <Button size="sm" variant="secondary" onClick={() => setMode('charge')}>
                    {t('Add charge', 'إضافة رسم')}
                  </Button>
                )}
                {open && canWaive && balance > 0 && (
                  <Button size="sm" variant="secondary" onClick={() => setMode('waive')}>
                    {t('Waive balance', 'إعفاء الرصيد')}
                  </Button>
                )}
                {open && canWaive && balance > 0 && (
                  <Button size="sm" variant="secondary" onClick={() => setMode('credit')}>
                    {t('Credit invoice', 'قيد دائن')}
                  </Button>
                )}
                {open && canWaive && balance > 0 && (
                  <Button size="sm" variant="secondary" onClick={() => setMode('writeoff')}>
                    {t('Write off', 'شطب')}
                  </Button>
                )}
                {open && isFinanceStaff && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setMode('cancel')}
                    disabled={num(invoice.paid_amount) > 0}
                    title={num(invoice.paid_amount) > 0 ? t('Reverse payments first', 'اعكس المدفوعات أولاً') : undefined}
                  >
                    {t('Cancel invoice', 'إلغاء الفاتورة')}
                  </Button>
                )}
              </div>

              {mode === 'pay' && (
                <PaymentForm
                  invoice={invoice}
                  onCancel={() => setMode(null)}
                  onDone={(res) => {
                    toast.success(t(`Receipt ${res.receipt_no} recorded`, `تم تسجيل الإيصال ${res.receipt_no}`));
                    refresh();
                  }}
                />
              )}
              {mode === 'charge' && (
                <FeeChargeForm studentId={invoice.student_id} month={invoice.month} onCancel={() => setMode(null)} onDone={refresh} />
              )}

              <ConfirmModal
                open={mode === 'waive'}
                title={t('Waive balance', 'إعفاء الرصيد')}
                message={t(
                  `Write off up to ${formatMoney(balance)} of this invoice (posted to Fee Discounts & Waivers).`,
                  `شطب حتى ${formatMoney(balance)} من هذه الفاتورة (يُرحَّل إلى خصومات وإعفاءات الرسوم).`,
                )}
                requireReason
                danger={false}
                confirmLabel={t('Waive', 'إعفاء')}
                onClose={() => {
                  setMode(null);
                  setWaiveAmount('');
                }}
                onConfirm={async (reason) => {
                  const ok = await runAction(
                    () =>
                      rpc('waive_fee_balance', {
                        p_fee: invoice.id,
                        p_reason: reason,
                        p_amount: num(waiveAmount) > 0 ? num(waiveAmount) : null,
                      }),
                    t('Balance waived', 'تم إعفاء الرصيد'),
                  );
                  if (ok) {
                    setWaiveAmount('');
                    refresh();
                  }
                  return ok;
                }}
              >
                <Field label={t('Amount (blank = full balance)', 'المبلغ (فارغ = كامل الرصيد)')}>
                  <Input type="number" min="0" step="0.01" value={waiveAmount} onChange={(e) => setWaiveAmount(e.target.value)} />
                </Field>
              </ConfirmModal>

              <ConfirmModal
                open={mode === 'credit'}
                title={t('Credit invoice', 'قيد دائن على الفاتورة')}
                message={t(
                  `Post a credit adjustment up to ${formatMoney(balance)} without rewriting issued lines.`,
                  `تسجيل قيد دائن حتى ${formatMoney(balance)} دون تعديل بنود الفاتورة الأصلية.`,
                )}
                requireReason
                danger={false}
                confirmLabel={t('Post credit', 'ترحيل القيد')}
                onClose={() => {
                  setMode(null);
                  setWaiveAmount('');
                }}
                onConfirm={async (reason) => {
                  const amt = num(waiveAmount);
                  if (!(amt > 0)) {
                    window.alert(t('Enter a credit amount.', 'أدخل مبلغ القيد الدائن.'));
                    return false;
                  }
                  const ok = await runAction(
                    () => rpc('credit_fee_invoice', { p_fee: invoice.id, p_amount: amt, p_reason: reason }),
                    t('Credit posted', 'تم ترحيل القيد الدائن'),
                  );
                  if (ok) {
                    setWaiveAmount('');
                    refresh();
                  }
                  return ok;
                }}
              >
                <Field label={t('Credit amount', 'مبلغ القيد الدائن')}>
                  <Input type="number" min="0" step="0.01" value={waiveAmount} onChange={(e) => setWaiveAmount(e.target.value)} />
                </Field>
              </ConfirmModal>

              <ConfirmModal
                open={mode === 'writeoff'}
                title={t('Write off balance', 'شطب الرصيد')}
                message={t(
                  `Write off up to ${formatMoney(balance)} with an audited adjustment.`,
                  `شطب حتى ${formatMoney(balance)} مع قيد تدقيق.`,
                )}
                requireReason
                danger={false}
                confirmLabel={t('Write off', 'شطب')}
                onClose={() => {
                  setMode(null);
                  setWaiveAmount('');
                }}
                onConfirm={async (reason) => {
                  const ok = await runAction(
                    () =>
                      rpc('write_off_fee_invoice', {
                        p_fee: invoice.id,
                        p_reason: reason,
                        p_amount: num(waiveAmount) > 0 ? num(waiveAmount) : null,
                      }),
                    t('Balance written off', 'تم شطب الرصيد'),
                  );
                  if (ok) {
                    setWaiveAmount('');
                    refresh();
                  }
                  return ok;
                }}
              >
                <Field label={t('Amount (blank = full balance)', 'المبلغ (فارغ = كامل الرصيد)')}>
                  <Input type="number" min="0" step="0.01" value={waiveAmount} onChange={(e) => setWaiveAmount(e.target.value)} />
                </Field>
              </ConfirmModal>

              <ConfirmModal
                open={mode === 'cancel'}
                title={t('Cancel invoice', 'إلغاء الفاتورة')}
                message={t(
                  'The invoice will be cancelled and its charges reversed in the ledger. This cannot be undone.',
                  'سيتم إلغاء الفاتورة وعكس رسومها في الدفاتر. لا يمكن التراجع عن ذلك.',
                )}
                requireReason
                confirmLabel={t('Cancel invoice', 'إلغاء الفاتورة')}
                onClose={() => setMode(null)}
                onConfirm={async (reason) => {
                  const ok = await runAction(() => rpc('cancel_fee_invoice', { p_fee: invoice.id, p_reason: reason }), t('Invoice cancelled', 'تم إلغاء الفاتورة'));
                  if (ok) refresh();
                  return ok;
                }}
              />

              <ConfirmModal
                open={Boolean(reversing)}
                title={t('Reverse receipt', 'عكس الإيصال')}
                message={
                  reversing
                    ? t(
                        `Reverse receipt ${reversing.receipt_no} (${formatMoney(reversing.amount)})? A reversing journal will be posted.`,
                        `عكس الإيصال ${reversing.receipt_no} (${formatMoney(reversing.amount)})؟ سيتم ترحيل قيد عكسي.`,
                      )
                    : ''
                }
                requireReason
                confirmLabel={t('Reverse', 'عكس')}
                onClose={() => setReversing(null)}
                onConfirm={async (reason) => {
                  const ok = await runAction(
                    () => rpc('reverse_fee_payment', { p_payment: reversing.id, p_reason: reason }),
                    t('Receipt reversed', 'تم عكس الإيصال'),
                  );
                  if (ok) refresh();
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
