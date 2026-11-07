import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { AsyncView, Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Stat, StatusBadge, Table, Textarea, useAsync, useLang } from '../ui';
import { useAuth } from '../../../context/AuthContext';
import { currentMonth, formatDate, formatMoney, query, rpc, today } from '../../../lib/erp/rpc';
import { PAYMENT_METHODS, labelOf, num, profilesMap, runAction } from '../../../lib/erp/financeApi';
import { monthLabel } from '../../../lib/receiptPrint';
import {
  PRINTERS, allocateOldestFirst, copyReceiptLink, downloadPrn, getPrinterPref, openReceiptPdf, printReceiptById,
  printWithPrinter, setPrinterPref,
} from './receiptActions';
import { ConfirmModal, Num, StudentPicker } from './shared';

const MANUAL_METHODS = ['cash', 'bank_transfer', 'cheque', 'online', 'other'];

const cents = (v) => Math.round(num(v) * 100);

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function ReceiptSuccess({ receipt, onAnother }) {
  const { t } = useLang();
  const cur = receipt.currency || 'LKR';
  return (
    <Card
      title={`${t('Payment received', 'تم استلام الدفعة')} · ${receipt.receipt_no}`}
      actions={<StatusBadge status={receipt.status} />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Stat label={t('Amount received', 'المبلغ المستلم')} value={formatMoney(receipt.amount, cur)} />
        <Stat
          label={t('Total arrears after', 'إجمالي المتأخرات بعد الدفع')}
          value={formatMoney(receipt.arrears_after, cur)}
          tone={num(receipt.arrears_after) > 0 ? 'amber' : 'emerald'}
        />
        <Stat label={t('Student', 'الطالب')} value={receipt.student?.full_name || '—'} hint={receipt.student?.index_number} tone="gray" />
      </div>
      <Table
        rows={receipt.allocations || []}
        rowKey="invoice_no"
        empty={t('No allocations', 'لا توجد توزيعات')}
        columns={[
          { key: 'month', label: t('Month', 'الشهر'), render: (a) => a.month_label || monthLabel(a.month) },
          { key: 'invoice_no', label: t('Invoice', 'الفاتورة'), render: (a) => <span className="font-mono text-xs">{a.invoice_no}</span> },
          { key: 'paid_now', label: t('Paid now', 'المدفوع الآن'), render: (a) => <Num>{formatMoney(a.paid_now, cur)}</Num> },
          { key: 'balance_after', label: t('Balance', 'الرصيد'), render: (a) => <Num>{formatMoney(a.balance_after, cur)}</Num> },
        ]}
      />
      <div className="flex flex-wrap gap-2 mt-4">
        <PrinterSelect />
        <Button onClick={() => printWithPrinter(receipt)}>{t('Print slip', 'طباعة الإيصال')}</Button>
        <Button variant="secondary" onClick={() => printWithPrinter(receipt, 'lq310')}>
          {t('Dot-matrix (LQ-310)', 'طباعة نقطية (LQ-310)')}
        </Button>
        <Button variant="secondary" onClick={() => downloadPrn(receipt)} title={t('Raw ESC/P file: copy /b receipt.prn to the printer share', 'ملف ESC/P خام')}>
          {t('Download .prn (ESC/P)', 'تنزيل ملف ‎.prn')}
        </Button>
        <Button variant="secondary" onClick={() => openReceiptPdf(receipt.public_token)}>
          {t('Download PDF', 'تنزيل PDF')}
        </Button>
        <Button variant="secondary" onClick={() => copyReceiptLink(receipt.public_token, t)}>
          {t('Copy receipt link', 'نسخ رابط الإيصال')}
        </Button>
        <Button variant="ghost" onClick={onAnother}>
          {t('Receive another', 'استلام دفعة أخرى')}
        </Button>
      </div>
    </Card>
  );
}

function PaymentPanel({ studentId, arrears, onReceived }) {
  const { t } = useLang();
  const months = useMemo(() => arrears?.months || [], [arrears]);
  const total = num(arrears?.total);
  const oldest = months[0] ? num(months[0].balance) : 0;
  const upToNow = months.filter((m) => String(m.month) <= currentMonth()).reduce((s, m) => s + num(m.balance), 0);

  const [form, setForm] = useState({
    amount: oldest > 0 ? oldest.toFixed(2) : '',
    method: 'cash',
    reference: '',
    payer: '',
    notes: '',
    date: today(),
  });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const amount = num(form.amount);
  const tooMuch = cents(amount) > cents(total);
  const needsRef = form.method !== 'cash';
  const valid = amount > 0 && !tooMuch && (!needsRef || form.reference.trim());
  const preview = useMemo(() => allocateOldestFirst(months, amount), [months, amount]);
  // One key per payment attempt: a retry after a timeout returns the same receipt
  // (duplicate: true) instead of charging twice. New student / amount → new key;
  // after a successful receipt the panel remounts and gets a fresh key.
  const idempotencyKey = useMemo(() => newIdempotencyKey(), [studentId, amount]); // eslint-disable-line react-hooks/exhaustive-deps
  const arrearsLeft = Math.max(0, (cents(total) - cents(amount)) / 100);

  const submit = async () => {
    setBusy(true);
    const paidAt = form.date === today() ? new Date().toISOString() : `${form.date}T12:00:00+05:30`;
    const payer = form.payer.trim() || null;
    const res = await runAction(
      () =>
        rpc('receive_student_payment', {
          p_student: studentId,
          p_amount: amount,
          p_method: form.method,
          p_reference: form.reference.trim() || null,
          p_notes: form.notes.trim() || null,
          p_paid_at: paidAt,
          p_fee: null,
          p_payer_name: payer,
          p_idempotency_key: idempotencyKey,
        }),
    );
    setBusy(false);
    setConfirming(false);
    if (res && typeof res === 'object') {
      if (res.duplicate) toast.info(t('This payment was already recorded — showing the existing receipt.', 'تم تسجيل هذه الدفعة مسبقًا — يُعرض الإيصال الموجود.'));
      else toast.success(t('Payment received', 'تم استلام الدفعة'));
      onReceived({ ...res, payer_name: res.payer_name ?? payer });
    }
  };

  if (!months.length) {
    return <EmptyState text={t('This student has no outstanding invoices.', 'لا توجد فواتير مستحقة على هذا الطالب.')} />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label={t('Total arrears', 'إجمالي المتأخرات')} value={formatMoney(total)} tone="amber" />
        <Stat label={t('Overdue', 'متأخر')} value={formatMoney(arrears?.overdue)} tone={num(arrears?.overdue) > 0 ? 'red' : 'gray'} />
        <Stat label={t('Open months', 'الأشهر المفتوحة')} value={months.length} tone="blue" />
      </div>

      <Table
        rows={months}
        rowKey="fee_id"
        columns={[
          {
            key: 'month',
            label: t('Month', 'الشهر'),
            render: (m) => (
              <div className="flex items-center gap-2">
                {monthLabel(m.month)}
                {m.overdue && <Badge tone="red">{t('Overdue', 'متأخر')}</Badge>}
              </div>
            ),
          },
          { key: 'invoice_no', label: t('Invoice', 'الفاتورة'), render: (m) => <span className="font-mono text-xs">{m.invoice_no || '—'}</span> },
          { key: 'due_date', label: t('Due date', 'تاريخ الاستحقاق'), render: (m) => formatDate(m.due_date) },
          { key: 'total_due', label: t('Total', 'الإجمالي'), render: (m) => <Num>{formatMoney(m.total_due)}</Num> },
          { key: 'paid', label: t('Paid', 'المدفوع'), render: (m) => <Num>{formatMoney(m.paid)}</Num> },
          { key: 'balance', label: t('Balance', 'الرصيد'), render: (m) => <Num className="text-amber-300">{formatMoney(m.balance)}</Num> },
        ]}
      />

      <div className="rounded-xl border border-gray-800 p-4 bg-gray-900/40 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t('Amount', 'المبلغ')} hint={`${t('Maximum', 'الحد الأقصى')}: ${formatMoney(total)}`}>
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
          </Field>
          <div className="flex flex-wrap items-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => set({ amount: oldest.toFixed(2) })}>
              {t('Oldest month', 'أقدم شهر')}
            </Button>
            {upToNow > 0 && (
              <Button size="sm" variant="secondary" onClick={() => set({ amount: upToNow.toFixed(2) })}>
                {t('Up to this month', 'حتى هذا الشهر')}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => set({ amount: total.toFixed(2) })}>
              {t('All arrears', 'كل المتأخرات')}
            </Button>
          </div>
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
          <Field label={t('Paid by (payer name)', 'الدافع (اسم الدافع)')}>
            <Input value={form.payer} onChange={(e) => set({ payer: e.target.value })} placeholder={t('e.g. Mother', 'مثال: الأم')} />
          </Field>
          <Field label={t('Payment date', 'تاريخ الدفع')}>
            <Input type="date" max={today()} value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
        </div>
        <Field label={t('Notes', 'ملاحظات')}>
          <Textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        {tooMuch && <p className="text-xs text-red-400">{t('Amount exceeds the total arrears.', 'المبلغ يتجاوز إجمالي المتأخرات.')}</p>}
        {needsRef && !form.reference.trim() && (
          <p className="text-xs text-amber-400">{t('A reference is required for non-cash payments.', 'المرجع مطلوب للمدفوعات غير النقدية.')}</p>
        )}
      </div>

      {amount > 0 && !tooMuch && (
        <div className="rounded-xl border border-emerald-900 bg-emerald-950/30 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-emerald-300">
            {t('Allocation preview (oldest month first)', 'معاينة التوزيع (الأقدم أولاً)')}
          </h4>
          <Table
            rows={preview.rows.filter((r) => r.paid_now > 0)}
            rowKey="fee_id"
            columns={[
              { key: 'month', label: t('Month', 'الشهر'), render: (r) => monthLabel(r.month) },
              { key: 'paid_now', label: t('Paid now', 'المدفوع الآن'), render: (r) => <Num>{formatMoney(r.paid_now)}</Num> },
              {
                key: 'balance_after',
                label: t('Balance after', 'الرصيد بعد الدفع'),
                render: (r) => (r.balance_after > 0 ? <Num>{formatMoney(r.balance_after)}</Num> : <Badge tone="green">{t('Paid', 'مدفوع')}</Badge>),
              },
            ]}
          />
          <div className="text-sm text-gray-300">
            {t('Arrears left after this payment', 'المتأخرات المتبقية بعد هذه الدفعة')}:{' '}
            <span className={arrearsLeft > 0 ? 'text-amber-300 font-bold' : 'text-emerald-300 font-bold'}>{formatMoney(arrearsLeft)}</span>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => setConfirming(true)} disabled={!valid || busy}>
          {t('Review & receive', 'مراجعة واستلام')}
        </Button>
      </div>

      <Modal
        open={confirming}
        title={t('Confirm payment', 'تأكيد الدفعة')}
        onClose={() => !busy && setConfirming(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? t('Saving…', 'جارٍ الحفظ…') : t('Receive payment', 'استلام دفعة')}
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-gray-300">
          <div className="flex justify-between gap-4">
            <span>{t('Amount', 'المبلغ')}</span>
            <strong className="text-white">{formatMoney(amount)}</strong>
          </div>
          <div className="flex justify-between gap-4">
            <span>{t('Method', 'طريقة الدفع')}</span>
            <span>{labelOf(PAYMENT_METHODS, form.method, t)}</span>
          </div>
          {form.reference.trim() && (
            <div className="flex justify-between gap-4">
              <span>{t('Reference', 'المرجع')}</span>
              <span>{form.reference.trim()}</span>
            </div>
          )}
          {preview.rows
            .filter((r) => r.paid_now > 0)
            .map((r) => (
              <div key={r.fee_id} className="flex justify-between gap-4 text-xs">
                <span>{monthLabel(r.month)}</span>
                <span className="tabular-nums">{formatMoney(r.paid_now)}</span>
              </div>
            ))}
          <div className="flex justify-between gap-4 border-t border-gray-800 pt-2">
            <span>{t('Arrears left after this payment', 'المتأخرات المتبقية بعد هذه الدفعة')}</span>
            <strong className="text-amber-300">{formatMoney(arrearsLeft)}</strong>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function RecentReceipts({ refreshKey }) {
  const { t } = useLang();
  const { isAccountant, user } = useAuth();
  const [reversing, setReversing] = useState(null);
  const [state, reload] = useAsync(async () => {
    const rows =
      (await query('fee_receipts', (q) => {
        let b = q.select('id, receipt_no, student_id, amount, currency, method, reference, payer_name, paid_at, status, public_token');
        if (user?.orgId) b = b.eq('org_id', user.orgId);
        return b.order('paid_at', { ascending: false }).limit(30);
      })) || [];
    const people = await profilesMap(rows.map((r) => r.student_id));
    return rows.map((r) => ({ ...r, student: people[r.student_id] }));
  }, [refreshKey, user?.orgId]);

  return (
    <Card title={t('Recent receipts', 'أحدث الإيصالات')} actions={<Button size="sm" variant="ghost" onClick={reload}>{t('Refresh', 'تحديث')}</Button>}>
      <AsyncView state={state}>
        {(rows) => (
          <Table
            rows={rows || []}
            empty={t('No receipts yet', 'لا توجد إيصالات بعد')}
            columns={[
              {
                key: 'receipt_no',
                label: t('Receipt', 'الإيصال'),
                render: (r) => (
                  <div>
                    <div className="font-mono text-xs">{r.receipt_no}</div>
                    <div className="text-xs text-gray-500">{formatDate(r.paid_at)}</div>
                  </div>
                ),
              },
              {
                key: 'student',
                label: t('Student', 'الطالب'),
                render: (r) => (
                  <div>
                    <div>{r.student?.full_name || '—'}</div>
                    <div className="text-xs text-gray-500">
                      {r.student?.index_number || ''}
                      {r.payer_name ? ` · ${r.payer_name}` : ''}
                    </div>
                  </div>
                ),
              },
              { key: 'amount', label: t('Amount', 'المبلغ'), render: (r) => <Num>{formatMoney(r.amount, r.currency || 'LKR')}</Num> },
              { key: 'method', label: t('Method', 'طريقة الدفع'), render: (r) => labelOf(PAYMENT_METHODS, r.method, t) },
              { key: 'status', label: t('Status', 'الحالة'), render: (r) => <StatusBadge status={r.status} /> },
              {
                key: 'actions',
                label: '',
                render: (r) => (
                  <div className="flex gap-1 justify-end flex-wrap">
                    <Button size="sm" variant="ghost" onClick={() => printReceiptById(r.id, r)}>
                      {t('Print', 'طباعة')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openReceiptPdf(r.public_token)}>
                      {t('PDF', 'PDF')}
                    </Button>
                    {isAccountant && r.status === 'posted' && (
                      <Button size="sm" variant="danger" onClick={() => setReversing(r)}>
                        {t('Reverse', 'عكس')}
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </AsyncView>
      <ConfirmModal
        open={Boolean(reversing)}
        title={t('Reverse receipt', 'عكس الإيصال')}
        message={
          reversing
            ? `${reversing.receipt_no} · ${formatMoney(reversing.amount)} — ${t(
                'All allocations of this receipt will be reversed and the arrears restored.',
                'سيتم عكس جميع توزيعات هذا الإيصال واستعادة المتأخرات.',
              )}`
            : ''
        }
        requireReason
        confirmLabel={t('Reverse', 'عكس')}
        onClose={() => setReversing(null)}
        onConfirm={async (reason) => {
          const ok = await runAction(
            () => rpc('reverse_fee_receipt', { p_receipt: reversing.id, p_reason: reason }),
            t('Receipt reversed', 'تم عكس الإيصال'),
          );
          if (ok) reload();
          return ok;
        }}
      />
    </Card>
  );
}

export default function FeeReceive() {
  const { t } = useLang();
  const { isFinanceStaff } = useAuth();
  const [studentId, setStudentId] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [arrears, reloadArrears] = useAsync(
    () => (studentId ? rpc('student_arrears', { p_student: studentId }) : Promise.resolve(null)),
    [studentId, refreshKey],
  );

  const another = () => {
    setReceipt(null);
    setStudentId(null);
  };

  return (
    <div className="space-y-6">
      {receipt ? (
        <ReceiptSuccess receipt={receipt} onAnother={another} />
      ) : (
        <Card title={t('Receive payment', 'استلام دفعة')}>
          {!isFinanceStaff && (
            <p className="text-sm text-amber-300 mb-3">{t('Only finance staff can receive payments.', 'فقط موظفو المالية يمكنهم استلام المدفوعات.')}</p>
          )}
          <div className="max-w-xl mb-4">
            <StudentPicker value={studentId} onChange={setStudentId} />
          </div>
          {studentId ? (
            <AsyncView state={arrears}>
              {(data) =>
                data ? (
                  <PaymentPanel
                    key={`${studentId}-${refreshKey}`}
                    studentId={studentId}
                    arrears={data}
                    onReceived={(r) => {
                      setReceipt(r);
                      setRefreshKey((k) => k + 1);
                    }}
                  />
                ) : (
                  <EmptyState text={t('No arrears information.', 'لا توجد معلومات عن المتأخرات.')} />
                )
              }
            </AsyncView>
          ) : (
            <EmptyState text={t('Select a student to see open months and arrears.', 'اختر طالبًا لعرض الأشهر المفتوحة والمتأخرات.')} />
          )}
          {studentId && arrears.error && (
            <div className="mt-2">
              <Button size="sm" variant="ghost" onClick={reloadArrears}>
                {t('Retry', 'إعادة المحاولة')}
              </Button>
            </div>
          )}
        </Card>
      )}
      <RecentReceipts refreshKey={refreshKey} />
    </div>
  );
}

/** Remembered printer choice for this counter (A5 / A4 two copies / Epson LQ-310). */
function PrinterSelect() {
  const { t } = useLang();
  const [value, setValue] = useState(getPrinterPref());
  return (
    <select
      aria-label={t('Printer', 'الطابعة')}
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        setPrinterPref(e.target.value);
      }}
      className="rounded-xl bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-gray-100"
    >
      {PRINTERS.map((p) => (
        <option key={p.value} value={p.value}>
          {t(p.en, p.ar)}
        </option>
      ))}
    </select>
  );
}
