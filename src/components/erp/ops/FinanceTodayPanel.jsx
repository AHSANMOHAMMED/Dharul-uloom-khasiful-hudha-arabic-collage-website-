import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';
import { AsyncView, Badge, Button, Card, EmptyState, Field, Input, PageHeader, Stat, Table, useAsync, useLang } from '../ui';
import { ConfirmModal, Num, StudentPicker } from '../finance/shared';
import { printReceiptById } from '../finance/receiptActions';
import { formatDate, formatMoney } from '../../../lib/erp/rpc';
import { PAYMENT_METHODS, labelOf, num, runAction } from '../../../lib/erp/financeApi';
import {
  CHANNELS, MESSAGE_STATUSES, financeToday, formatDateTime, methodRows, resendReceipt, sendFeeReminder, sendOverdueReminders,
  studentArrears, studentMessageLog, subscribeReceipts,
} from '../../../lib/erp/opsApi';
import { PairBadge, TotalLine } from './common';

const timeOf = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

/** Re-run `reload` (debounced) whenever fee_receipts changes; cleans up the channel on unmount. */
function useLiveReceipts(reload) {
  const [lastEvent, setLastEvent] = useState(null);
  const timer = useRef(null);
  useEffect(() => {
    const stop = subscribeReceipts(() => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setLastEvent(new Date());
        reload();
      }, 600);
    });
    return () => {
      clearTimeout(timer.current);
      stop();
    };
  }, [reload]);
  return lastEvent;
}

// ---------------------------------------------------------------------------
// Today's KPIs + latest receipts
// ---------------------------------------------------------------------------
function TodayView({ data, canAct }) {
  const { t } = useLang();
  const methods = methodRows(data.by_method);
  const collected = num(data.collected);
  const pending = num(data.pending_petty_cash) + num(data.pending_expenses);
  const failed = num(data.messages_failed_24h);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label={t('Collected today', 'المحصّل اليوم')} value={formatMoney(collected)} hint={`${num(data.receipts)} ${t('receipts', 'إيصالات')}`} />
        <Stat
          label={t('Online (PayHere)', 'عبر الإنترنت (PayHere)')}
          value={formatMoney(data.online)}
          hint={collected ? `${((num(data.online) * 100) / collected).toFixed(0)}% ${t('of today', 'من اليوم')}` : undefined}
          tone="blue"
        />
        <Stat label={t('Outstanding (all students)', 'المتبقي (كل الطلاب)')} value={formatMoney(data.outstanding)} tone="amber" />
        <Stat
          label={t('Pending approvals', 'بانتظار الاعتماد')}
          value={pending}
          hint={`${t('Petty cash', 'النثرية')} ${num(data.pending_petty_cash)} · ${t('Expenses', 'المصروفات')} ${num(data.pending_expenses)}`}
          tone={pending ? 'amber' : 'gray'}
        />
        <Stat
          label={t('Failed messages (24 h)', 'رسائل فاشلة (24 ساعة)')}
          value={failed}
          hint={failed ? t('Check the message log of the student', 'راجع سجل رسائل الطالب') : t('All delivered or queued', 'كلها مرسلة أو في الانتظار')}
          tone={failed ? 'red' : 'emerald'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title={t('Today by method', 'اليوم حسب الطريقة')}>
          {methods.rows.length ? (
            <div>
              {methods.rows.map((r) => (
                <TotalLine key={r.method} label={labelOf(PAYMENT_METHODS, r.method, t)} value={formatMoney(r.amount)} />
              ))}
              <TotalLine strong label={t('Total collected today', 'إجمالي المحصّل اليوم')} value={formatMoney(methods.total)} tone="text-emerald-300" />
              {Math.round(methods.total * 100) !== Math.round(collected * 100) && (
                <p className="text-xs text-amber-300 mt-2">{t('Method totals differ from the day total — refresh.', 'مجاميع الطرق تختلف عن مجموع اليوم — حدّث.')}</p>
              )}
            </div>
          ) : (
            <EmptyState text={t('No receipts yet today.', 'لا توجد إيصالات اليوم بعد.')} />
          )}
        </Card>

        <Card title={t('Latest receipts', 'أحدث الإيصالات')} className="lg:col-span-2">
          <Table
            rows={data.latest || []}
            empty={t('No receipts yet.', 'لا توجد إيصالات بعد.')}
            columns={[
              {
                key: 'paid_at',
                label: t('Time', 'الوقت'),
                render: (r) => (
                  <span className="whitespace-nowrap">
                    {timeOf(r.paid_at)}
                    <span className="block text-xs text-gray-500">{formatDate(r.paid_at)}</span>
                  </span>
                ),
              },
              { key: 'receipt_no', label: t('Receipt', 'الإيصال') },
              {
                key: 'student',
                label: t('Student', 'الطالب'),
                render: (r) => (
                  <span>
                    {r.student || '—'}
                    {r.index_number && <span className="block text-xs text-gray-500">{r.index_number}</span>}
                  </span>
                ),
              },
              { key: 'method', label: t('Method', 'الطريقة'), render: (r) => labelOf(PAYMENT_METHODS, r.method, t) },
              { key: 'amount', label: t('Amount', 'المبلغ'), render: (r) => <Num>{formatMoney(r.amount)}</Num>, className: 'text-end' },
              {
                key: 'actions',
                label: '',
                render: (r) => (
                  <div className="flex gap-1 justify-end flex-wrap">
                    <Link to={`/receipt/${r.id}`} className="px-3 py-1.5 text-xs rounded-xl font-semibold text-gray-300 hover:bg-gray-800">
                      {t('Open', 'فتح')}
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => printReceiptById(r.id, { payer_name: r.student })}>
                      {t('Print', 'طباعة')}
                    </Button>
                    {canAct && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const res = await runAction(() => resendReceipt(r.id));
                          if (res) toast.success(`${t('Receipt copy sent to families', 'أُرسلت نسخة الإيصال إلى الأسر')}: ${num(res.families)}`);
                        }}
                      >
                        {t('Resend', 'إعادة الإرسال')}
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk overdue reminders
// ---------------------------------------------------------------------------
function OverdueReminders() {
  const { t } = useLang();
  const [minDays, setMinDays] = useState('7');
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);
  const days = Math.max(0, Math.floor(num(minDays)));

  return (
    <Card title={t('Send reminders to all overdue', 'إرسال تذكير لكل المتأخرين')}>
      <p className="text-sm text-gray-400 mb-3">
        {t('Families whose oldest unpaid invoice is overdue by at least this many days get an SMS / app reminder. A family is reminded at most once every 20 hours.', 'تتلقى الأسر التي تأخرت أقدم فاتورة غير مدفوعة لديها بهذا العدد من الأيام على الأقل تذكيرًا برسالة أو إشعار. لا تُذكَّر الأسرة أكثر من مرة كل 20 ساعة.')}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Field label={t('Overdue by (days)', 'متأخر بـ (أيام)')}>
            <Input type="number" min="0" value={minDays} onChange={(e) => setMinDays(e.target.value)} />
          </Field>
        </div>
        <Button variant="danger" onClick={() => setConfirming(true)}>{t('Send reminders', 'إرسال التذكيرات')}</Button>
      </div>
      {result && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Badge tone="green">{t('Sent', 'أُرسلت')}: {num(result.sent)}</Badge>
          <Badge tone="gray">{t('Skipped (no arrears or reminded recently)', 'تم التخطي (لا متأخرات أو ذُكّر مؤخرًا)')}: {num(result.skipped)}</Badge>
        </div>
      )}
      <ConfirmModal
        open={confirming}
        title={t('Send reminders to all overdue', 'إرسال تذكير لكل المتأخرين')}
        message={`${t('Remind every family overdue by at least', 'تذكير كل أسرة متأخرة بما لا يقل عن')} ${days} ${t('days', 'أيام')}?`}
        confirmLabel={t('Send reminders', 'إرسال التذكيرات')}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          const res = await runAction(() => sendOverdueReminders(days));
          if (res) {
            setResult(res);
            toast.success(`${t('Reminders sent', 'أُرسلت التذكيرات')}: ${num(res.sent)}`);
          }
          return res;
        }}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Student lookup: arrears, reminder, message log
// ---------------------------------------------------------------------------
function StudentDesk({ canAct }) {
  const { t } = useLang();
  const [studentId, setStudentId] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [arrears] = useAsync(() => (studentId ? studentArrears(studentId) : Promise.resolve(null)), [studentId]);
  const [log, reloadLog] = useAsync(() => (studentId ? studentMessageLog(studentId) : Promise.resolve([])), [studentId]);

  const remind = async () => {
    setBusy(true);
    const res = await runAction(() => sendFeeReminder(studentId, note.trim()));
    setBusy(false);
    if (!res) return;
    if (res.ok === false) {
      toast.info(t('This student has no arrears — no reminder sent.', 'لا توجد متأخرات على هذا الطالب — لم يُرسل تذكير.'));
    } else {
      toast.success(`${t('Reminder sent', 'أُرسل التذكير')}: ${num(res.recipients)} ${t('recipients', 'مستلمين')}`);
      setNote('');
    }
    reloadLog();
  };

  return (
    <Card title={t('Student lookup', 'البحث عن طالب')}>
      <div className="max-w-xl">
        <StudentPicker value={studentId} onChange={setStudentId} />
      </div>
      {!studentId ? (
        <EmptyState text={t('Select a student to see arrears and messages.', 'اختر طالبًا لعرض المتأخرات والرسائل.')} />
      ) : (
        <div className="space-y-5 mt-4">
          <AsyncView state={arrears}>
            {(a) => (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Stat label={t('Total arrears', 'إجمالي المتأخرات')} value={formatMoney(a?.total)} tone={num(a?.total) ? 'amber' : 'emerald'} />
                  <Stat label={t('Overdue', 'متأخر السداد')} value={formatMoney(a?.overdue)} tone={num(a?.overdue) ? 'red' : 'emerald'} />
                  <Stat label={t('Open months', 'الأشهر المفتوحة')} value={(a?.months || []).length} tone="gray" />
                </div>
                <Table
                  rows={a?.months || []}
                  rowKey="fee_id"
                  empty={t('No open invoices.', 'لا توجد فواتير مفتوحة.')}
                  columns={[
                    { key: 'month', label: t('Month', 'الشهر') },
                    { key: 'invoice_no', label: t('Invoice', 'الفاتورة'), render: (m) => m.invoice_no || '—' },
                    {
                      key: 'due_date',
                      label: t('Due', 'الاستحقاق'),
                      render: (m) => (
                        <span className="inline-flex items-center gap-2">
                          {formatDate(m.due_date)}
                          {m.overdue && <Badge tone="red">{t('Overdue', 'متأخر السداد')}</Badge>}
                        </span>
                      ),
                    },
                    { key: 'total_due', label: t('Invoiced', 'المفوتر'), render: (m) => <Num>{formatMoney(m.total_due)}</Num>, className: 'text-end' },
                    { key: 'paid', label: t('Paid', 'المدفوع'), render: (m) => <Num>{formatMoney(m.paid)}</Num>, className: 'text-end' },
                    { key: 'balance', label: t('Balance', 'الرصيد'), render: (m) => <Num>{formatMoney(m.balance)}</Num>, className: 'text-end' },
                  ]}
                />
                {canAct && (
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-60">
                      <Field label={t('Note to add (optional)', 'ملاحظة مضافة (اختياري)')}>
                        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
                      </Field>
                    </div>
                    <Button onClick={remind} disabled={busy || !num(a?.total)}>
                      {busy ? t('Sending…', 'جارٍ الإرسال…') : t('Send fee reminder', 'إرسال تذكير بالرسوم')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </AsyncView>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-white">{t('Message log', 'سجل الرسائل')}</h4>
              <Button size="sm" variant="ghost" onClick={reloadLog}>{t('Refresh', 'تحديث')}</Button>
            </div>
            <AsyncView state={log}>
              {(rows) => (
                <Table
                  rows={rows}
                  empty={t('No messages sent for this student yet.', 'لم تُرسل رسائل لهذا الطالب بعد.')}
                  columns={[
                    { key: 'created_at', label: t('Queued', 'في الانتظار'), render: (m) => <span className="whitespace-nowrap">{formatDateTime(m.created_at)}</span> },
                    { key: 'channel', label: t('Channel', 'القناة'), render: (m) => labelOf(CHANNELS, m.channel, t) },
                    {
                      key: 'recipient',
                      label: t('Recipient', 'المستلم'),
                      render: (m) => (
                        <span>
                          {m.recipient || '—'}
                          {m.to_address && <span className="block text-xs text-gray-500">{m.to_address}</span>}
                        </span>
                      ),
                    },
                    {
                      key: 'body',
                      label: t('Message', 'الرسالة'),
                      render: (m) => (
                        <span className="block max-w-md">
                          {m.subject && <span className="block font-semibold">{m.subject}</span>}
                          <span className="text-gray-400 text-xs">{m.body}</span>
                        </span>
                      ),
                    },
                    {
                      key: 'status',
                      label: t('Status', 'الحالة'),
                      render: (m) => (
                        <span>
                          <PairBadge map={MESSAGE_STATUSES} value={m.status} />
                          {m.sent_at && <span className="block text-xs text-gray-500">{formatDateTime(m.sent_at)}</span>}
                          {m.error && <span className="block text-xs text-red-300 max-w-60">{m.error}</span>}
                        </span>
                      ),
                    },
                  ]}
                />
              )}
            </AsyncView>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function FinanceTodayPanel() {
  const { t } = useLang();
  const { isFinanceStaff } = useAuth();
  const canAct = Boolean(isFinanceStaff);
  const [state, reload] = useAsync(() => financeToday(), []);
  const lastEvent = useLiveReceipts(reload);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Finance today', 'المالية اليوم')}
        subtitle={
          state.data?.date
            ? `${formatDate(state.data.date)} · ${t('updates live as receipts are posted', 'يتحدث مباشرة عند تسجيل الإيصالات')}`
            : t('updates live as receipts are posted', 'يتحدث مباشرة عند تسجيل الإيصالات')
        }
        actions={
          <>
            <Badge tone="green">● {t('Live', 'مباشر')}{lastEvent ? ` · ${timeOf(lastEvent)}` : ''}</Badge>
            <Button variant="secondary" onClick={reload}>{t('Refresh', 'تحديث')}</Button>
          </>
        }
      />
      <AsyncView state={state}>{(data) => <TodayView data={data} canAct={canAct} />}</AsyncView>
      {canAct && <OverdueReminders />}
      <StudentDesk canAct={canAct} />
    </div>
  );
}
