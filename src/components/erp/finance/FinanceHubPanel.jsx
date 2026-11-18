import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Badge, Button, Card, Field, Input, Select, Textarea, useLang } from '../ui';
import {
  amendFinanceDocument,
  convertQuotationToBill,
  createBillingJob,
  createFinanceDocument,
  financePublicUrl,
  hardDeleteFinanceDocument,
  issueFinanceDocument,
  listBillingJobs,
  listFinanceDocPayments,
  listFinanceDocumentLines,
  listFinanceDocuments,
  recordFinanceDocPayment,
  reverseFinanceDocPayment,
  smsShareUrl,
  voidFinanceDocument,
  whatsappShareUrl,
} from '../../../lib/financeHubApi';
import { listLetterheads } from '../../../lib/erp/documentsApi';
import { PAYMENT_METHODS, FUND_TYPES, useOrg } from '../../../lib/erp/financeApi';
import { useAuth } from '../../../context/AuthContext';
import { currentMonth, formatMoney, today } from '../../../lib/erp/rpc';
import { useUrlState } from '../../../lib/useTabParam';
import { printSlip } from '../../../lib/slip/slipRender';
import { financeDocSlip, financePaymentSlip } from '../../../lib/slip/slipModels';
import { SlipPrinterButton } from './SlipPrinter';
import BankReconPanel from './BankReconPanel';

const DOC_TYPES = [
  { value: 'quotation', en: 'Quotation', ar: 'عرض سعر' },
  { value: 'bill', en: 'Bill / invoice', ar: 'فاتورة' },
  { value: 'sale', en: 'Item / sale', ar: 'بيع' },
  { value: 'donation', en: 'Donation', ar: 'تبرع' },
  { value: 'sadaqah', en: 'Sadaqah', ar: 'صدقة' },
];
const LINE_TYPES = ['item', 'food', 'hostel', 'tuition', 'donation', 'sadaqah', 'other'];
const PAYABLE = ['bill', 'sale', 'fee_invoice'];
const STATUS_TONE = { draft: 'gray', issued: 'blue', amended: 'amber', paid: 'green', void: 'red' };
const METHOD_OPTIONS = ['cash', 'bank_transfer', 'cheque', 'online', 'other'];

const emptyLine = () => ({ line_type: 'item', description: '', qty: 1, unit_amount: 0 });
// Money in cents: 100.30 - 50.10 is 50.199999999999996 in floating point.
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
// Each line is rounded like the server's line_total (round(qty * unit_amount, 2)).
const lineTotal = (lines) => round2(lines.reduce((a, l) => a + round2(Number(l.qty || 0) * Number(l.unit_amount || 0)), 0));
const balanceOf = (doc) => round2(Number(doc?.total || 0) - Number(doc?.paid_amount || 0));
const cleanLines = (lines) =>
  lines
    .filter((l) => String(l.description || '').trim())
    .map((l) => ({ line_type: l.line_type, description: l.description.trim(), qty: Number(l.qty) || 1, unit_amount: Number(l.unit_amount) || 0 }));

function LinesEditor({ lines, onChange }) {
  const { t } = useLang();
  const set = (idx, patch) => onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('Line items', 'البنود')}</h3>
        <Button size="sm" variant="ghost" onClick={() => onChange([...lines, emptyLine()])}>
          + {t('Add line', 'إضافة بند')}
        </Button>
      </div>
      {lines.map((line, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end border border-sand-border rounded-lg p-2">
          <div className="col-span-6 sm:col-span-2">
            <Field label={t('Type', 'النوع')}>
              <Select value={line.line_type} onChange={(e) => set(idx, { line_type: e.target.value })} options={LINE_TYPES.map((v) => ({ value: v, label: v }))} />
            </Field>
          </div>
          <div className="col-span-12 sm:col-span-5 order-first sm:order-none">
            <Field label={t('Description', 'الوصف')}>
              <Input value={line.description} onChange={(e) => set(idx, { description: e.target.value })} />
            </Field>
          </div>
          <div className="col-span-3 sm:col-span-2">
            <Field label={t('Qty', 'الكمية')}>
              <Input type="number" min="0.001" step="any" value={line.qty} onChange={(e) => set(idx, { qty: e.target.value })} />
            </Field>
          </div>
          <div className="col-span-3 sm:col-span-2">
            <Field label={t('Rate', 'السعر')}>
              <Input type="number" min="0" step="0.01" value={line.unit_amount} onChange={(e) => set(idx, { unit_amount: e.target.value })} />
            </Field>
          </div>
          <div className="col-span-12 sm:col-span-1 flex justify-end">
            <Button size="sm" variant="ghost" aria-label={t('Remove line', 'حذف البند')} onClick={() => onChange(lines.filter((_, i) => i !== idx))}>
              ×
            </Button>
          </div>
        </div>
      ))}
      <p className="text-sm text-end font-semibold">
        {t('Total', 'الإجمالي')}: {formatMoney(lineTotal(lines))}
      </p>
    </div>
  );
}

function JobSummary({ job }) {
  const { t } = useLang();
  if (job.error) return <span className="text-feedback-danger">{job.error}</span>;
  const s = job.summary || {};
  if (s.generated === undefined) return <span>{s.message || '—'}</span>;
  return (
    <span>
      {t('Billed', 'فوترة')} {s.generated ?? 0} · {t('already billed', 'مفوتر مسبقاً')} {s.skipped ?? 0}
      {s.amount_total !== undefined ? ` · ${formatMoney(s.amount_total)}` : ''}
    </span>
  );
}

export default function FinanceHubPanel() {
  const { t } = useLang();
  const auth = useAuth();
  const org = useOrg(auth.user?.orgId);
  const canTakePayment = Boolean(auth.isFinanceStaff || auth.isSuperAdmin);
  const [tab, setTab] = useUrlState('hub', 'documents');
  const [jobs, setJobs] = useState([]);
  const [docs, setDocs] = useState([]);
  const [letterheads, setLetterheads] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const blankForm = { docType: 'quotation', partyType: 'external', partyName: '', partyPhone: '', notes: '', letterheadId: '', validUntil: '', lines: [emptyLine()] };
  const [form, setForm] = useState(blankForm);
  const [selected, setSelected] = useState(null);
  const [lines, setLines] = useState([]);
  const [payments, setPayments] = useState([]);
  const [reason, setReason] = useState('');
  const [issueOpts, setIssueOpts] = useState({ method: 'cash', reference: '', fundType: '' });
  const [pay, setPay] = useState({ amount: '', method: 'cash', reference: '', date: today() });
  const [amending, setAmending] = useState(null);

  const run = async (fn, okMsg) => {
    setBusy(true);
    setError('');
    try {
      const out = await fn();
      if (okMsg) toast.success(okMsg);
      return out;
    } catch (e) {
      setError(e.message || String(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const reload = useCallback(async () => {
    try {
      const [j, d, lh] = await Promise.all([listBillingJobs(30), listFinanceDocuments({ limit: 100 }), listLetterheads().catch(() => [])]);
      setJobs(j);
      setDocs(d);
      setLetterheads(lh || []);
    } catch (e) {
      setError(e.message || String(e));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const openDoc = async (doc) => {
    setSelected(doc);
    setAmending(null);
    setReason('');
    setPay({ amount: String(Math.max(balanceOf(doc), 0) || ''), method: 'cash', reference: '', date: today() });
    try {
      const [l, p] = await Promise.all([listFinanceDocumentLines(doc.id), listFinanceDocPayments(doc.id).catch(() => [])]);
      setLines(l);
      setPayments(p);
    } catch (e) {
      setError(e.message || String(e));
    }
  };
  const refreshSelected = async (doc) => {
    await reload();
    if (doc) await openDoc(doc);
  };

  const saveDoc = async () => {
    const clean = cleanLines(form.lines);
    if (!clean.length) return setError(t('Add at least one line with a description.', 'أضف بنداً واحداً على الأقل.'));
    const created = await run(() =>
      createFinanceDocument({ ...form, letterheadId: form.letterheadId || null, validUntil: form.docType === 'quotation' ? form.validUntil : null, lines: clean }),
      t('Draft saved', 'تم حفظ المسودة'),
    );
    if (created) {
      setForm(blankForm);
      setTab('documents');
      await refreshSelected(created);
    }
  };

  const balance = selected ? balanceOf(selected) : 0;
  const isGift = selected && ['donation', 'sadaqah'].includes(selected.doc_type);
  const printDoc = () => printSlip(financeDocSlip(org, selected, lines, payments));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {[
          ['documents', t('Documents', 'المستندات')],
          ['create', t('Create document', 'إنشاء مستند')],
          ['jobs', t('Billing jobs', 'مهام الفوترة')],
          ['recon', t('Bank recon', 'مطابقة البنك')],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold border ${tab === id ? 'bg-emerald-700 text-white border-emerald-700' : 'border-sand-border bg-white'}`}
          >
            {label}
          </button>
        ))}
        <div className="ms-auto flex gap-2">
          <SlipPrinterButton org={org} />
          <Button size="sm" variant="secondary" disabled={busy} onClick={reload}>
            {t('Refresh', 'تحديث')}
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {tab === 'jobs' && (
        <Card title={t('Billing jobs', 'مهام الفوترة')}>
          <p className="text-xs text-ink-text-muted mb-3">
            {t('Bills every active student for the month from the fee structure. Students already billed for that month are skipped, so running it again is safe.',
              'يصدر فواتير الشهر لكل طالب نشط حسب هيكل الرسوم، ويتخطى من صدرت له فاتورة.')}
          </p>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <Field label={t('Month', 'الشهر')}>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </Field>
            <Button
              disabled={busy || !month || !canTakePayment}
              onClick={async () => {
                if (!window.confirm(t(`Bill every active student for ${month}?`, `إصدار فواتير ${month} لكل الطلاب؟`))) return;
                const job = await run(() => createBillingJob({ kind: 'monthly_fees', month }));
                if (job?.status === 'failed') setError(job.error || t('Billing failed', 'فشلت الفوترة'));
                else if (job) toast.success(t('Monthly fees billed', 'تمت فوترة الرسوم الشهرية'));
                await reload();
              }}
            >
              {t('Run monthly fee job', 'تشغيل فاتورة الشهر')}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-ink-text-muted">
                <tr>
                  <th className="py-2 text-start">{t('When', 'الوقت')}</th>
                  <th className="py-2 text-start">{t('Month', 'الشهر')}</th>
                  <th className="py-2 text-start">{t('Status', 'الحالة')}</th>
                  <th className="py-2 text-start">{t('Summary', 'الملخص')}</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-t border-sand-border">
                    <td className="py-2 text-xs">{new Date(j.created_at).toLocaleString('en-GB')}</td>
                    <td className="py-2 text-xs">{j.period_month || '—'}</td>
                    <td className="py-2 text-xs"><Badge tone={j.status === 'done' ? 'green' : j.status === 'failed' ? 'red' : 'amber'}>{j.status}</Badge></td>
                    <td className="py-2 text-xs text-ink-text-muted"><JobSummary job={j} /></td>
                  </tr>
                ))}
                {!jobs.length && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-xs text-ink-text-muted">{t('No billing jobs yet.', 'لا توجد مهام فوترة بعد.')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'recon' && <BankReconPanel />}

      {tab === 'create' && (
        <Card title={t('Create bill / quotation / donation', 'إنشاء فاتورة أو عرض سعر أو تبرع')}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t('Document type', 'نوع المستند')}>
              <Select value={form.docType} onChange={(e) => setForm((f) => ({ ...f, docType: e.target.value }))} options={DOC_TYPES.map((d) => ({ value: d.value, label: t(d.en, d.ar) }))} />
            </Field>
            <Field label={t('Party type', 'نوع الطرف')}>
              <Select
                value={form.partyType}
                onChange={(e) => setForm((f) => ({ ...f, partyType: e.target.value }))}
                options={[
                  { value: 'external', label: t('External / visitor', 'خارجي / زائر') },
                  { value: 'student', label: t('Student', 'طالب') },
                  { value: 'parent', label: t('Parent', 'ولي أمر') },
                  { value: 'donor', label: t('Donor', 'متبرع') },
                  { value: 'staff', label: t('Staff', 'موظف') },
                ]}
              />
            </Field>
            <Field label={t('Party name', 'اسم الطرف')}>
              <Input value={form.partyName} onChange={(e) => setForm((f) => ({ ...f, partyName: e.target.value }))} />
            </Field>
            <Field label={t('Phone (for WhatsApp / SMS)', 'الهاتف (لواتساب / الرسائل)')}>
              <Input inputMode="tel" value={form.partyPhone} onChange={(e) => setForm((f) => ({ ...f, partyPhone: e.target.value }))} />
            </Field>
            {form.docType === 'quotation' && (
              <Field label={t('Valid until', 'صالح حتى')}>
                <Input type="date" min={today()} value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} />
              </Field>
            )}
            <Field label={t('Letterhead (A4)', 'الترويسة (A4)')}>
              <Select
                value={form.letterheadId}
                onChange={(e) => setForm((f) => ({ ...f, letterheadId: e.target.value }))}
                options={[{ value: '', label: t('None', 'بدون') }, ...letterheads.map((lh) => ({ value: lh.id, label: lh.name || lh.id }))]}
              />
            </Field>
            <Field label={t('Notes', 'ملاحظات')}>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </Field>
          </div>
          <div className="mt-4">
            <LinesEditor lines={form.lines} onChange={(l) => setForm((f) => ({ ...f, lines: l }))} />
          </div>
          <div className="mt-4">
            <Button disabled={busy || !form.partyName.trim()} onClick={saveDoc}>
              {t('Save draft', 'حفظ مسودة')}
            </Button>
          </div>
        </Card>
      )}

      {tab === 'documents' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title={t('Finance documents', 'مستندات المالية')}>
            <ul className="divide-y divide-sand-border max-h-[560px] overflow-y-auto">
              {docs.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => openDoc(d)}
                    className={`w-full text-start px-2 py-3 hover:bg-parchment-50 ${selected?.id === d.id ? 'bg-mint-wash-100/50' : ''}`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="text-sm font-semibold text-ink-green-900">
                        {d.doc_number || t('Draft', 'مسودة')} · {d.party_name || '—'}
                      </span>
                      <Badge tone={STATUS_TONE[d.status] || 'gray'}>{d.status}</Badge>
                    </div>
                    <div className="text-xs text-ink-text-muted">
                      {d.doc_type} · {formatMoney(d.total)}
                      {PAYABLE.includes(d.doc_type) && Number(d.paid_amount) > 0 && Number(d.paid_amount) < Number(d.total)
                        ? ` · ${t('balance', 'الرصيد')} ${formatMoney(balanceOf(d))}`
                        : ''}
                    </div>
                  </button>
                </li>
              ))}
              {!docs.length && <li className="py-8 text-center text-xs text-ink-text-muted">{t('No documents yet.', 'لا توجد مستندات بعد.')}</li>}
            </ul>
          </Card>

          <Card title={selected ? `${selected.doc_type} ${selected.doc_number || ''}` : t('Select a document', 'اختر مستنداً')}>
            {!selected ? (
              <p className="text-sm text-ink-text-muted">{t('Choose a document to issue, amend, share, or convert.', 'اختر مستنداً لإصداره أو تعديله أو مشاركته أو تحويله.')}</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-sand-border bg-parchment-50 p-3 text-sm space-y-1">
                  <div className="flex justify-between gap-2">
                    <p className="font-semibold">{selected.party_name}</p>
                    <Badge tone={STATUS_TONE[selected.status] || 'gray'}>{selected.status}</Badge>
                  </div>
                  <p className="text-xs text-ink-text-muted">
                    {t('Total', 'الإجمالي')} {formatMoney(selected.total)}
                    {PAYABLE.includes(selected.doc_type) && ` · ${t('Paid', 'المدفوع')} ${formatMoney(selected.paid_amount)} · ${t('Balance', 'الرصيد')} ${formatMoney(balance)}`}
                    {selected.valid_until && ` · ${t('Valid until', 'صالح حتى')} ${selected.valid_until}`}
                  </p>
                  {selected.amend_reason && <p className="text-xs">{t('Reason', 'السبب')}: {selected.amend_reason}</p>}
                  {selected.status !== 'draft' && selected.public_token && (
                    <p className="text-xs break-all">
                      {t('Link:', 'الرابط:')}{' '}
                      <a className="text-emerald-700 underline" href={financePublicUrl(selected)} target="_blank" rel="noreferrer">
                        {financePublicUrl(selected)}
                      </a>
                    </p>
                  )}
                </div>

                {amending ? (
                  <div className="space-y-3 rounded-xl border border-brass-gold-500/40 p-3">
                    <Field label={t('Party name', 'اسم الطرف')}>
                      <Input value={amending.partyName} onChange={(e) => setAmending((a) => ({ ...a, partyName: e.target.value }))} />
                    </Field>
                    <Field label={t('Notes', 'ملاحظات')}>
                      <Textarea rows={2} value={amending.notes} onChange={(e) => setAmending((a) => ({ ...a, notes: e.target.value }))} />
                    </Field>
                    {!(isGift && selected.status !== 'draft') && <LinesEditor lines={amending.lines} onChange={(l) => setAmending((a) => ({ ...a, lines: l }))} />}
                    {selected.status !== 'draft' && (
                      <Field label={t('Reason for the change', 'سبب التعديل')}>
                        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
                      </Field>
                    )}
                    <div className="flex gap-2">
                      <Button
                        disabled={busy || (selected.status !== 'draft' && !reason.trim())}
                        onClick={async () => {
                          const d = await run(
                            () => amendFinanceDocument(selected.id, {
                              partyName: amending.partyName,
                              notes: amending.notes,
                              lines: isGift && selected.status !== 'draft' ? null : cleanLines(amending.lines),
                              reason: reason.trim() || null,
                            }),
                            t('Document updated', 'تم تحديث المستند'),
                          );
                          if (d) await refreshSelected(d);
                        }}
                      >
                        {t('Save changes', 'حفظ التغييرات')}
                      </Button>
                      <Button variant="ghost" onClick={() => setAmending(null)}>{t('Cancel', 'إلغاء')}</Button>
                    </div>
                  </div>
                ) : (
                  <ul className="text-sm space-y-1">
                    {lines.map((l) => (
                      <li key={l.id} className="flex justify-between gap-2 border-b border-sand-border/60 py-1">
                        <span>
                          {l.description} <span className="text-xs text-ink-text-muted">× {Number(l.qty)} @ {formatMoney(l.unit_amount)}</span>
                        </span>
                        <span>{formatMoney(l.line_total ?? l.qty * l.unit_amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {selected.status === 'draft' && isGift && (
                  <div className="grid sm:grid-cols-3 gap-2">
                    <Field label={t('Received by', 'طريقة الاستلام')}>
                      <Select value={issueOpts.method} onChange={(e) => setIssueOpts((o) => ({ ...o, method: e.target.value }))} options={METHOD_OPTIONS.map((m) => ({ value: m, label: t(PAYMENT_METHODS[m][0], PAYMENT_METHODS[m][1]) }))} />
                    </Field>
                    <Field label={t('Reference', 'المرجع')}>
                      <Input value={issueOpts.reference} onChange={(e) => setIssueOpts((o) => ({ ...o, reference: e.target.value }))} />
                    </Field>
                    {selected.doc_type === 'donation' && (
                      <Field label={t('Fund', 'الصندوق')}>
                        <Select value={issueOpts.fundType} onChange={(e) => setIssueOpts((o) => ({ ...o, fundType: e.target.value }))}
                          options={[{ value: '', label: t('General', 'عام') }, ...Object.entries(FUND_TYPES).filter(([k]) => k !== 'general').map(([k, v]) => ({ value: k, label: t(v[0], v[1]) }))]} />
                      </Field>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {selected.status === 'draft' && (
                    <Button
                      disabled={busy || !lines.length}
                      onClick={async () => {
                        const msg = isGift
                          ? t('Issue and record this donation in the ledger?', 'إصدار التبرع وتسجيله في الدفتر؟')
                          : t('Issue this document? It gets a number and can no longer be deleted.', 'إصدار المستند؟');
                        if (!window.confirm(msg)) return;
                        const d = await run(() => issueFinanceDocument(selected.id, isGift ? issueOpts : {}), t('Issued', 'تم الإصدار'));
                        if (d) await refreshSelected(d);
                      }}
                    >
                      {t('Issue', 'إصدار')}
                    </Button>
                  )}
                  <Button variant="secondary" onClick={printDoc}>{t('Print', 'طباعة')}</Button>
                  {selected.doc_type === 'quotation' && ['issued', 'amended'].includes(selected.status) && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={async () => {
                        const bill = await run(() => convertQuotationToBill(selected.id), t('Bill created as draft', 'تم إنشاء الفاتورة كمسودة'));
                        if (bill) await refreshSelected(bill);
                      }}
                    >
                      {t('Convert to bill', 'تحويل إلى فاتورة')}
                    </Button>
                  )}
                  {selected.status !== 'void' && !amending && (
                    <Button
                      variant="secondary"
                      onClick={() => setAmending({ partyName: selected.party_name || '', notes: selected.notes || '', lines: lines.map((l) => ({ line_type: l.line_type, description: l.description, qty: l.qty, unit_amount: l.unit_amount })) })}
                    >
                      {selected.status === 'draft' ? t('Edit', 'تعديل') : t('Amend', 'تعديل بسبب')}
                    </Button>
                  )}
                  {selected.status !== 'draft' && (
                    <>
                      <a className="rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white" href={whatsappShareUrl(selected)} target="_blank" rel="noreferrer">
                        {t('WhatsApp', 'واتساب')}
                      </a>
                      <a className="rounded-lg border border-sand-border px-3 py-2 text-xs font-semibold" href={smsShareUrl(selected.party_phone, selected)}>
                        {t('SMS', 'رسالة نصية')}
                      </a>
                    </>
                  )}
                </div>

                {PAYABLE.includes(selected.doc_type) && ['issued', 'amended'].includes(selected.status) && canTakePayment && balance > 0 && (
                  <div className="rounded-xl border border-sand-border p-3 space-y-2">
                    <h3 className="text-sm font-semibold">{t('Receive payment', 'استلام دفعة')}</h3>
                    <div className="grid sm:grid-cols-4 gap-2">
                      <Field label={t('Amount', 'المبلغ')}>
                        <Input type="number" min="0.01" max={balance} step="0.01" value={pay.amount} onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))} />
                      </Field>
                      <Field label={t('Method', 'الطريقة')}>
                        <Select value={pay.method} onChange={(e) => setPay((p) => ({ ...p, method: e.target.value }))} options={METHOD_OPTIONS.map((m) => ({ value: m, label: t(PAYMENT_METHODS[m][0], PAYMENT_METHODS[m][1]) }))} />
                      </Field>
                      <Field label={['cheque', 'bank_transfer'].includes(pay.method) ? t('Cheque / transfer no.', 'رقم الشيك / التحويل') : t('Reference', 'المرجع')}>
                        <Input value={pay.reference} onChange={(e) => setPay((p) => ({ ...p, reference: e.target.value }))} />
                      </Field>
                      <Field label={t('Date', 'التاريخ')}>
                        <Input type="date" max={today()} value={pay.date} onChange={(e) => setPay((p) => ({ ...p, date: e.target.value }))} />
                      </Field>
                    </div>
                    <Button
                      disabled={busy || !(Number(pay.amount) > 0) || Number(pay.amount) > balance + 0.001}
                      onClick={async () => {
                        const r = await run(() => recordFinanceDocPayment(selected.id, pay), t('Payment received', 'تم استلام الدفعة'));
                        if (!r) return;
                        const fresh = { ...selected, paid_amount: round2(Number(selected.paid_amount || 0) + Number(r.amount)), status: r.status };
                        printSlip(financePaymentSlip(org, fresh, { receipt_no: r.receipt_no, amount: r.amount, method: pay.method, reference: pay.reference, paid_on: pay.date }));
                        await refreshSelected(fresh);
                      }}
                    >
                      {t('Receive and print receipt', 'استلام وطباعة الإيصال')}
                    </Button>
                  </div>
                )}

                {payments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-1">{t('Payments', 'الدفعات')}</h3>
                    <ul className="text-sm divide-y divide-sand-border">
                      {payments.map((p) => (
                        <li key={p.id} className="py-1.5 flex flex-wrap items-center justify-between gap-2">
                          <span className={p.status === 'reversed' ? 'line-through text-ink-text-muted' : ''}>
                            {p.receipt_no} · {p.paid_on} · {PAYMENT_METHODS[p.method]?.[0] || p.method} · {formatMoney(p.amount)}
                          </span>
                          <span className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => printSlip(financePaymentSlip(org, selected, p))}>{t('Receipt', 'إيصال')}</Button>
                            {p.status === 'recorded' && canTakePayment && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                  const why = window.prompt(t('Why is this payment being reversed? (e.g. cheque bounced)', 'سبب عكس الدفعة؟'));
                                  if (!why?.trim()) return;
                                  const d = await run(() => reverseFinanceDocPayment(p.id, why.trim()), t('Payment reversed', 'تم عكس الدفعة'));
                                  if (d) await refreshSelected(d);
                                }}
                              >
                                {t('Reverse', 'عكس')}
                              </Button>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selected.status !== 'void' && (
                  <div className="flex flex-wrap items-end gap-2 border-t border-sand-border pt-3">
                    <div className="flex-1 min-w-[12rem]">
                      <Field label={t('Void reason', 'سبب الإلغاء')}>
                        <Input value={amending ? '' : reason} disabled={Boolean(amending)} onChange={(e) => setReason(e.target.value)} placeholder={t('Required to void', 'مطلوب للإلغاء')} />
                      </Field>
                    </div>
                    <Button
                      variant="danger"
                      disabled={busy || Boolean(amending) || !reason.trim()}
                      onClick={async () => {
                        if (!window.confirm(t('Void this document? This cannot be undone.', 'إلغاء المستند؟ لا يمكن التراجع.'))) return;
                        const d = await run(() => voidFinanceDocument(selected.id, reason.trim()), t('Document voided', 'تم إلغاء المستند'));
                        if (d) await refreshSelected(d);
                      }}
                    >
                      {t('Void', 'إلغاء')}
                    </Button>
                  </div>
                )}
                {auth.isSuperAdmin && selected.status === 'void' && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={async () => {
                      if (!window.confirm(t('Hard-delete this voided document?', 'حذف المستند الملغى نهائياً؟'))) return;
                      const ok = await run(() => hardDeleteFinanceDocument(selected.id).then(() => true), t('Deleted', 'تم الحذف'));
                      if (ok) {
                        setSelected(null);
                        await reload();
                      }
                    }}
                  >
                    {t('Hard delete (SA)', 'حذف نهائي (المدير العام)')}
                  </Button>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
