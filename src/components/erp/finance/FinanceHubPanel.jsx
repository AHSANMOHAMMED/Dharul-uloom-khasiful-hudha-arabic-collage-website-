import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Field, Input, Select, Textarea, useLang } from '../ui';
import {
  amendFinanceDocument,
  convertQuotationToBill,
  createBillingJob,
  createFinanceDocument,
  financePublicUrl,
  hardDeleteFinanceDocument,
  issueFinanceDocument,
  listBillingJobs,
  listFinanceDocumentLines,
  listFinanceDocuments,
  smsShareUrl,
  voidFinanceDocument,
  whatsappShareUrl,
} from '../../../lib/financeHubApi';
import { listLetterheads } from '../../../lib/erp/documentsApi';
import { useAuth } from '../../../context/AuthContext';
import { currentMonth } from '../../../lib/erp/rpc';

const DOC_TYPES = [
  { value: 'quotation', label: 'Quotation' },
  { value: 'bill', label: 'Bill / invoice' },
  { value: 'donation', label: 'Donation' },
  { value: 'sadaqah', label: 'Sadaqah' },
  { value: 'sale', label: 'Item / sale' },
  { value: 'fee_invoice', label: 'Fee invoice (manual)' },
];

const LINE_TYPES = ['tuition', 'hostel', 'donation', 'sadaqah', 'food', 'item', 'other'];

function emptyLine() {
  return { line_type: 'item', description: '', qty: 1, unit_amount: 0 };
}

export default function FinanceHubPanel() {
  const { t } = useLang();
  const auth = useAuth();
  const [tab, setTab] = useState('jobs');
  const [jobs, setJobs] = useState([]);
  const [docs, setDocs] = useState([]);
  const [letterheads, setLetterheads] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const [form, setForm] = useState({
    docType: 'quotation',
    partyType: 'external',
    partyName: '',
    partyPhone: '',
    notes: '',
    letterheadId: '',
    lines: [emptyLine()],
  });
  const [selected, setSelected] = useState(null);
  const [lines, setLines] = useState([]);
  const [amendReason, setAmendReason] = useState('');

  const reload = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [j, d, lh] = await Promise.all([
        listBillingJobs(30),
        listFinanceDocuments({ limit: 60 }),
        listLetterheads().catch(() => []),
      ]);
      setJobs(j);
      setDocs(d);
      setLetterheads(lh || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const openDoc = async (doc) => {
    setSelected(doc);
    try {
      setLines(await listFinanceDocumentLines(doc.id));
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  const runMonthlyJob = async () => {
    setBusy(true);
    setError('');
    try {
      await createBillingJob({ kind: 'monthly_fees', month });
      await reload();
      setTab('jobs');
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveDoc = async () => {
    setBusy(true);
    setError('');
    try {
      const created = await createFinanceDocument({
        docType: form.docType,
        partyType: form.partyType,
        partyName: form.partyName,
        partyPhone: form.partyPhone,
        notes: form.notes,
        letterheadId: form.letterheadId || null,
        lines: form.lines.filter((l) => l.description.trim()),
      });
      await reload();
      await openDoc(created);
      setTab('documents');
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          ['jobs', 'Billing jobs'],
          ['create', 'Create document'],
          ['documents', 'Documents'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold border ${
              tab === id ? 'bg-emerald-700 text-white border-emerald-700' : 'border-sand-border bg-white'
            }`}
          >
            {t(label, label)}
          </button>
        ))}
        <button type="button" disabled={busy} onClick={reload} className="ms-auto rounded-lg border border-sand-border px-3 py-2 text-xs font-semibold">
          {t('Refresh', 'تحديث')}
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {tab === 'jobs' && (
        <Card title={t('Billing jobs', 'مهام الفوترة')}>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <Field label={t('Month', 'الشهر')}>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </Field>
            <Button disabled={busy} onClick={runMonthlyJob}>
              {t('Run monthly fee job', 'تشغيل فاتورة الشهر')}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await createBillingJob({ kind: 'donation_drive' });
                  await reload();
                } catch (e) {
                  setError(e.message || String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('Log donation drive job', 'تسجيل حملة تبرع')}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-ink-text-muted">
                <tr>
                  <th className="py-2 text-start">{t('When', 'الوقت')}</th>
                  <th className="py-2 text-start">{t('Kind', 'النوع')}</th>
                  <th className="py-2 text-start">{t('Month', 'الشهر')}</th>
                  <th className="py-2 text-start">{t('Status', 'الحالة')}</th>
                  <th className="py-2 text-start">{t('Summary', 'الملخص')}</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-t border-sand-border">
                    <td className="py-2 text-xs">{new Date(j.created_at).toLocaleString()}</td>
                    <td className="py-2 text-xs font-mono">{j.kind}</td>
                    <td className="py-2 text-xs">{j.period_month || '—'}</td>
                    <td className="py-2 text-xs font-semibold">{j.status}</td>
                    <td className="py-2 text-xs text-ink-text-muted max-w-xs truncate">
                      {j.error || JSON.stringify(j.summary || {})}
                    </td>
                  </tr>
                ))}
                {!jobs.length && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-ink-text-muted">
                      {t('No billing jobs yet.', 'لا توجد مهام فوترة بعد.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'create' && (
        <Card title={t('Create bill / quotation / donation', 'إنشاء فاتورة أو عرض سعر أو تبرع')}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t('Document type', 'نوع المستند')}>
              <Select
                value={form.docType}
                onChange={(e) => setForm((f) => ({ ...f, docType: e.target.value }))}
                options={DOC_TYPES}
              />
            </Field>
            <Field label={t('Party type', 'نوع الطرف')}>
              <Select
                value={form.partyType}
                onChange={(e) => setForm((f) => ({ ...f, partyType: e.target.value }))}
                options={[
                  { value: 'external', label: 'External / visitor' },
                  { value: 'student', label: 'Student' },
                  { value: 'parent', label: 'Parent' },
                  { value: 'donor', label: 'Donor' },
                  { value: 'staff', label: 'Staff' },
                ]}
              />
            </Field>
            <Field label={t('Party name', 'اسم الطرف')}>
              <Input value={form.partyName} onChange={(e) => setForm((f) => ({ ...f, partyName: e.target.value }))} />
            </Field>
            <Field label={t('Phone (for WhatsApp / SMS)', 'الهاتف (لواتساب / الرسائل)')}>
              <Input value={form.partyPhone} onChange={(e) => setForm((f) => ({ ...f, partyPhone: e.target.value }))} />
            </Field>
            <Field label={t('Letterhead (A4)', 'الترويسة (A4)')}>
              <Select
                value={form.letterheadId}
                onChange={(e) => setForm((f) => ({ ...f, letterheadId: e.target.value }))}
                options={[
                  { value: '', label: 'None' },
                  ...letterheads.map((lh) => ({ value: lh.id, label: lh.name || lh.id })),
                ]}
              />
            </Field>
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </Field>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t('Line items', 'البنود')}</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))}
              >
                {t('Add line', 'إضافة بند')}
              </Button>
            </div>
            {form.lines.map((line, idx) => (
              <div key={idx} className="grid sm:grid-cols-12 gap-2 items-end border border-sand-border rounded-lg p-2">
                <div className="sm:col-span-2">
                  <Field label="Type">
                    <Select
                      value={line.line_type}
                      onChange={(e) => {
                        const linesNext = [...form.lines];
                        linesNext[idx] = { ...line, line_type: e.target.value };
                        setForm((f) => ({ ...f, lines: linesNext }));
                      }}
                      options={LINE_TYPES.map((v) => ({ value: v, label: v }))}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-5">
                  <Field label="Description">
                    <Input
                      value={line.description}
                      onChange={(e) => {
                        const linesNext = [...form.lines];
                        linesNext[idx] = { ...line, description: e.target.value };
                        setForm((f) => ({ ...f, lines: linesNext }));
                      }}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Qty">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.qty}
                      onChange={(e) => {
                        const linesNext = [...form.lines];
                        linesNext[idx] = { ...line, qty: Number(e.target.value) };
                        setForm((f) => ({ ...f, lines: linesNext }));
                      }}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Amount">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unit_amount}
                      onChange={(e) => {
                        const linesNext = [...form.lines];
                        linesNext[idx] = { ...line, unit_amount: Number(e.target.value) };
                        setForm((f) => ({ ...f, lines: linesNext }));
                      }}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }))}
                  >
                    ×
                  </Button>
                </div>
              </div>
            ))}
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
            <ul className="divide-y divide-sand-border max-h-[520px] overflow-y-auto">
              {docs.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => openDoc(d)}
                    className={`w-full text-start px-2 py-3 hover:bg-parchment-50 ${selected?.id === d.id ? 'bg-mint-wash-100/50' : ''}`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="text-sm font-semibold text-ink-green-900">
                        {d.doc_number || d.doc_type} · {d.party_name || '—'}
                      </span>
                      <span className="text-[11px] font-semibold uppercase">{d.status}</span>
                    </div>
                    <div className="text-xs text-ink-text-muted">
                      {d.doc_type} · {Number(d.total || 0).toFixed(2)} {d.currency}
                    </div>
                  </button>
                </li>
              ))}
              {!docs.length && <li className="py-8 text-center text-xs text-ink-text-muted">{t('No documents yet.', 'لا توجد مستندات بعد.')}</li>}
            </ul>
          </Card>

          <Card title={selected ? `${selected.doc_type} detail` : t('Select a document', 'اختر مستنداً')}>
            {!selected ? (
              <p className="text-sm text-ink-text-muted">{t('Choose a document to issue, amend, share, or convert.', 'اختر مستنداً لإصداره أو تعديله أو مشاركته أو تحويله.')}</p>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-sand-border bg-parchment-50 p-3 text-sm">
                  <p className="font-semibold">{selected.party_name}</p>
                  <p className="text-xs text-ink-text-muted">
                    {selected.doc_number || selected.id} · {selected.status} · {Number(selected.total || 0).toFixed(2)} {selected.currency}
                  </p>
                  {selected.public_token && (
                    <p className="mt-2 text-xs break-all">
                      {t('Link:', 'الرابط:')} <a className="text-emerald-700 underline" href={financePublicUrl(selected)} target="_blank" rel="noreferrer">{financePublicUrl(selected)}</a>
                    </p>
                  )}
                </div>

                <ul className="text-sm space-y-1">
                  {lines.map((l) => (
                    <li key={l.id} className="flex justify-between gap-2 border-b border-sand-border/60 py-1">
                      <span>{l.description} <span className="text-xs text-ink-text-muted">({l.line_type})</span></span>
                      <span>{Number(l.line_total || l.qty * l.unit_amount).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-2">
                  {selected.status === 'draft' && (
                    <Button
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const issued = await issueFinanceDocument(selected.id);
                          setSelected(issued);
                          await reload();
                        } catch (e) {
                          setError(e.message || String(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {t('Issue', 'إصدار')}
                    </Button>
                  )}
                  {selected.doc_type === 'quotation' && selected.status !== 'void' && (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const bill = await convertQuotationToBill(selected.id);
                          await reload();
                          await openDoc(bill);
                        } catch (e) {
                          setError(e.message || String(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {t('Convert to bill', 'تحويل إلى فاتورة')}
                    </Button>
                  )}
                  {selected.status !== 'draft' && (
                    <>
                      <a
                        className="rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white"
                        href={whatsappShareUrl(selected)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('WhatsApp', 'واتساب')}
                      </a>
                      <a
                        className="rounded-lg border border-sand-border px-3 py-2 text-xs font-semibold"
                        href={smsShareUrl(selected.party_phone, selected)}
                      >
                        {t('SMS', 'رسالة نصية')}
                      </a>
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(financePublicUrl(selected));
                          } catch {
                            window.prompt('Copy link', financePublicUrl(selected));
                          }
                        }}
                      >
                        {t('Copy link', 'نسخ الرابط')}
                      </Button>
                    </>
                  )}
                  {selected.status !== 'void' && (
                    <Button
                      variant="ghost"
                      disabled={busy || !amendReason.trim()}
                      onClick={async () => {
                        const reason = amendReason.trim() || window.prompt('Reason for void?');
                        if (!reason) return;
                        setBusy(true);
                        try {
                          const voided = await voidFinanceDocument(selected.id, reason);
                          setSelected(voided);
                          await reload();
                        } catch (e) {
                          setError(e.message || String(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {t('Void (reason required)', 'إلغاء (السبب مطلوب)')}
                    </Button>
                  )}
                  {auth.isSuperAdmin && selected.status === 'void' && (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={async () => {
                        if (!window.confirm('Hard-delete this voided document?')) return;
                        setBusy(true);
                        try {
                          await hardDeleteFinanceDocument(selected.id);
                          setSelected(null);
                          await reload();
                        } catch (e) {
                          setError(e.message || String(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {t('Hard delete (SA)', 'حذف نهائي (المدير العام)')}
                    </Button>
                  )}
                </div>

                <Field label={t('Amend / void reason', 'سبب التعديل / الإلغاء')}>
                  <Input value={amendReason} onChange={(e) => setAmendReason(e.target.value)} placeholder={t('Required for amend or void', 'مطلوب للتعديل أو الإلغاء')} />
                </Field>
                {selected.status !== 'void' && (
                  <Button
                    variant="ghost"
                    disabled={busy || !amendReason.trim()}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const amended = await amendFinanceDocument(selected.id, {
                          partyName: selected.party_name,
                          notes: selected.notes,
                          reason: amendReason.trim(),
                        });
                        setSelected(amended);
                        setAmendReason('');
                        await reload();
                      } catch (e) {
                        setError(e.message || String(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {t('Amend with reason', 'تعديل مع ذكر السبب')}
                  </Button>
                )}

                <p className="text-[11px] text-ink-text-muted">
                  {t('Quotations print on A4 with the selected letterhead. Public links work without login for issued documents.', 'تُطبع عروض الأسعار على ورق A4 بالترويسة المختارة. تعمل الروابط العامة دون تسجيل دخول للمستندات المصدرة.')}
                </p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
