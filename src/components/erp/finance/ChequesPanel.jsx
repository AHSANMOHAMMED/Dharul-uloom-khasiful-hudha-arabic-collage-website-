import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';
import { Badge, Button, ErrorNote, Field, Input, Loading, Modal, PageHeader, Select, Stat, Table, Textarea, useLang } from '../ui';
import { query, rpc, formatMoney } from '../../../lib/erp/rpc';
import { exportXlsx } from '../../../lib/spreadsheet';
import { printTable } from '../../../lib/printReport';

const STATUS_TONE = { pending: 'amber', deposited: 'blue', cleared: 'green', bounced: 'red', cancelled: 'gray' };
const today = () => new Date().toISOString().slice(0, 10);

/** Cheque register: received (fees, donations) and issued (expenses, salaries). */
export default function ChequesPanel() {
  const auth = useAuth();
  const { t, ar, lang } = useLang();
  const canWrite = auth.isFinanceStaff;
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({ direction: '', status: 'open', search: '' });
  const [editing, setEditing] = useState(null); // cheque row or {} for new
  const [history, setHistory] = useState(null);

  const STATUS = {
    pending: t('In hand / not presented', 'بالحوزة / لم يُقدَّم'),
    deposited: t('Deposited / presented', 'مودَع / مُقدَّم'),
    cleared: t('Cleared', 'تم الصرف'),
    bounced: t('Bounced', 'مرتجع'),
    cancelled: t('Cancelled', 'ملغى'),
  };

  const load = useCallback(() => {
    setError(null);
    query('cheques', (q) => {
      let x = q.select('*, student:student_id(full_name, index_number)').order('cheque_date', { ascending: true }).limit(1000);
      if (filter.direction) x = x.eq('direction', filter.direction);
      if (filter.status === 'open') x = x.in('status', ['pending', 'deposited', 'bounced']);
      else if (filter.status) x = x.eq('status', filter.status);
      return x;
    })
      .then(setRows)
      .catch(setError);
  }, [filter.direction, filter.status]);
  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const s = filter.search.trim().toLowerCase();
    if (!s || !rows) return rows;
    return rows.filter((r) => [r.cheque_no, r.party_name, r.bank_name, r.purpose].some((v) => String(v || '').toLowerCase().includes(s)));
  }, [rows, filter.search]);

  const totals = useMemo(() => {
    const sum = (pred) => (rows || []).filter(pred).reduce((a, r) => a + Number(r.amount), 0);
    const t0 = today();
    return {
      inHand: sum((r) => r.direction === 'received' && r.status === 'pending'),
      dueToday: sum((r) => r.direction === 'received' && r.status === 'pending' && r.cheque_date <= t0),
      issuedOpen: sum((r) => r.direction === 'issued' && ['pending', 'deposited'].includes(r.status)),
      bounced: sum((r) => r.status === 'bounced'),
    };
  }, [rows]);

  const act = async (row, status) => {
    let note = null;
    if (status === 'bounced') {
      note = window.prompt(t('Reason given by the bank (e.g. insufficient funds)', 'السبب الذي ذكره البنك (مثل عدم كفاية الرصيد)'));
      if (!note) return;
    }
    if (status === 'cancelled') {
      note = window.prompt(t('Why is this cheque cancelled?', 'لماذا أُلغي هذا الشيك؟'));
      if (!note) return;
    }
    const onDate = window.prompt(t('Date (YYYY-MM-DD)', 'التاريخ (YYYY-MM-DD)'), today());
    if (!onDate) return;
    try {
      const res = await rpc('update_cheque_status', { p_cheque: row.id, p_status: status, p_on: onDate, p_note: note });
      toast.success(res?.receipt_reversed ? t('Marked bounced; the fee receipts were reversed.', 'تم تسجيله مرتجعاً وعُكست إيصالات الرسوم.') : t('Updated', 'تم التحديث'));
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const columns = [
    { key: 'cheque_date', label: t('Cheque date', 'تاريخ الشيك'), type: 'date' },
    { key: 'direction', label: t('Type', 'النوع') },
    { key: 'cheque_no', label: t('Cheque no.', 'رقم الشيك') },
    { key: 'bank_name', label: t('Bank', 'البنك') },
    { key: 'party_name', label: t('Drawer / payee', 'الساحب / المستفيد') },
    { key: 'amount', label: t('Amount', 'المبلغ'), type: 'money' },
    { key: 'status', label: t('Status', 'الحالة') },
    { key: 'purpose', label: t('Purpose', 'الغرض') },
  ];
  const exportRows = (visible || []).map((r) => ({ ...r, direction: r.direction === 'received' ? t('Received', 'وارد') : t('Issued', 'صادر'), status: STATUS[r.status] }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('Cheque register', 'سجل الشيكات')}
        subtitle={t('Track every cheque received or issued, its date, and whether it was deposited, cleared or bounced.', 'تتبّع كل شيك وارد أو صادر وتاريخه وهل أودع أو صُرف أو ارتد.')}
        actions={
          <>
            {canWrite && <Button onClick={() => setEditing({})}>{t('Add cheque', 'إضافة شيك')}</Button>}
            <Button variant="secondary" disabled={!visible?.length}
              onClick={() => exportXlsx({ filename: `cheques-${today()}`, rtl: ar, sheets: [{ name: t('Cheques', 'الشيكات'), title: t('Cheque register', 'سجل الشيكات'), columns, rows: exportRows }] }).catch((e) => toast.error(e.message))}>
              {t('Excel', 'Excel')}
            </Button>
            <Button variant="secondary" disabled={!visible?.length}
              onClick={() => { try { printTable({ title: t('Cheque register', 'سجل الشيكات'), columns, rows: exportRows, dir: document.documentElement.dir || 'ltr', lang, totals: { amount: exportRows.reduce((a, r) => a + Number(r.amount), 0) } }); } catch (e) { toast.error(e.message); } }}>
              {t('PDF / Print', 'PDF / طباعة')}
            </Button>
            {auth.isAdmin && (
              <Button variant="ghost" onClick={() => rpc('run_daily_reminders').then((r) => toast.info(`${t('Reminders sent', 'أُرسلت التذكيرات')}: ${r.tasks_due + r.tasks_overdue + r.cheques}`)).catch((e) => toast.error(e.message))}>
                {t('Send due reminders now', 'إرسال التذكيرات الآن')}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat label={t('Received, in hand', 'واردة بالحوزة')} value={formatMoney(totals.inHand)} tone="amber" />
        <Stat label={t('Ready to deposit today', 'جاهزة للإيداع اليوم')} value={formatMoney(totals.dueToday)} tone="emerald" />
        <Stat label={t('Issued, not yet cleared', 'صادرة لم تُصرف')} value={formatMoney(totals.issuedOpen)} tone="blue" />
        <Stat label={t('Bounced', 'مرتجعة')} value={formatMoney(totals.bounced)} tone="red" />
      </div>

      <section className="rounded-[14px] border border-sand-border bg-paper-white p-4 sm:p-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t('Type', 'النوع')}>
            <Select value={filter.direction} onChange={(e) => setFilter((f) => ({ ...f, direction: e.target.value }))} placeholder={t('All', 'الكل')}
              options={[{ value: 'received', label: t('Received', 'وارد') }, { value: 'issued', label: t('Issued', 'صادر') }]} />
          </Field>
          <Field label={t('Status', 'الحالة')}>
            <Select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))} placeholder={t('All', 'الكل')}
              options={[{ value: 'open', label: t('Open (not settled)', 'مفتوحة (غير مسواة)') }, ...Object.entries(STATUS).map(([v, l]) => ({ value: v, label: l }))]} />
          </Field>
          <Field label={t('Search', 'بحث')}>
            <Input value={filter.search} onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))} placeholder={t('Cheque no., name, bank…', 'رقم الشيك، الاسم، البنك…')} />
          </Field>
        </div>
        <ErrorNote error={error} />
        {!rows && !error ? <Loading /> : (
          <Table
            rows={visible || []}
            empty={t('No cheques match.', 'لا توجد شيكات مطابقة.')}
            columns={[
              {
                key: 'cheque_date',
                label: t('Cheque date', 'تاريخ الشيك'),
                render: (r) => (
                  <span className={r.status === 'pending' && r.cheque_date <= today() ? 'font-bold text-emerald-700' : ''}>
                    {r.cheque_date}{r.status === 'pending' && r.cheque_date > today() && <span className="ms-1 text-[10px] text-ink-text-muted">{t('post-dated', 'مؤجل')}</span>}
                  </span>
                ),
              },
              { key: 'direction', label: t('Type', 'النوع'), render: (r) => <Badge tone={r.direction === 'received' ? 'green' : 'blue'}>{r.direction === 'received' ? t('Received', 'وارد') : t('Issued', 'صادر')}</Badge> },
              { key: 'cheque_no', label: t('Cheque no.', 'رقم الشيك'), render: (r) => <span className="font-mono">{r.cheque_no}</span> },
              { key: 'bank', label: t('Bank', 'البنك'), render: (r) => (r.bank_name ? `${r.bank_name}${r.branch ? ` · ${r.branch}` : ''}` : <span className="text-feedback-danger text-xs">{t('add bank', 'أضف البنك')}</span>) },
              { key: 'party_name', label: t('Drawer / payee', 'الساحب / المستفيد'), render: (r) => <div>{r.party_name}{r.student && <div className="text-[11px] text-ink-text-muted">{r.student.full_name} · {r.student.index_number}</div>}</div> },
              { key: 'amount', label: t('Amount', 'المبلغ'), render: (r) => formatMoney(r.amount, r.currency) },
              { key: 'status', label: t('Status', 'الحالة'), render: (r) => <div><Badge tone={STATUS_TONE[r.status]}>{STATUS[r.status]}</Badge>{r.bounce_reason && <div className="text-[11px] text-feedback-danger mt-0.5">{r.bounce_reason}</div>}</div> },
              {
                key: 'actions',
                label: '',
                render: (r) => (
                  <div className="flex flex-wrap gap-1">
                    {canWrite && r.status === 'pending' && <Button size="sm" variant="secondary" onClick={() => act(r, 'deposited')}>{r.direction === 'received' ? t('Deposit', 'إيداع') : t('Presented', 'قُدِّم')}</Button>}
                    {canWrite && ['pending', 'deposited'].includes(r.status) && <Button size="sm" onClick={() => act(r, 'cleared')}>{t('Cleared', 'صُرف')}</Button>}
                    {canWrite && ['pending', 'deposited'].includes(r.status) && <Button size="sm" variant="danger" onClick={() => act(r, 'bounced')}>{t('Bounced', 'مرتجع')}</Button>}
                    {canWrite && r.status === 'bounced' && <Button size="sm" variant="secondary" onClick={() => act(r, 'deposited')}>{t('Re-present', 'إعادة تقديم')}</Button>}
                    {canWrite && r.status === 'pending' && <Button size="sm" variant="ghost" onClick={() => act(r, 'cancelled')}>{t('Cancel', 'إلغاء')}</Button>}
                    {canWrite && !['cleared', 'cancelled'].includes(r.status) && <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>{t('Edit', 'تعديل')}</Button>}
                    <Button size="sm" variant="ghost" onClick={() => setHistory(r)}>{t('History', 'السجل')}</Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </section>

      {editing && <ChequeForm cheque={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {history && <ChequeHistory cheque={history} statusLabels={STATUS} onClose={() => setHistory(null)} />}
    </div>
  );
}

function ChequeForm({ cheque, onClose, onSaved }) {
  const { t } = useLang();
  const isNew = !cheque.id;
  const [f, setF] = useState({
    direction: cheque.direction || 'issued',
    cheque_no: cheque.cheque_no || '',
    bank_name: cheque.bank_name || '',
    branch: cheque.branch || '',
    amount: cheque.amount || '',
    cheque_date: cheque.cheque_date || today(),
    handled_on: cheque.handled_on || today(),
    party_name: cheque.party_name || '',
    purpose: cheque.purpose || '',
    notes: cheque.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    if (!f.cheque_no.trim() || !f.party_name.trim() || !(Number(f.amount) > 0) || !f.cheque_date) {
      return toast.error(t('Cheque number, name, amount and cheque date are required', 'رقم الشيك والاسم والمبلغ وتاريخ الشيك مطلوبة'));
    }
    setBusy(true);
    try {
      const row = { ...f, amount: Number(f.amount), bank_name: f.bank_name || null, branch: f.branch || null };
      if (isNew) await query('cheques', (q) => q.insert(row).select('id').single());
      else {
        delete row.direction;
        await query('cheques', (q) => q.update(row).eq('id', cheque.id).select('id'));
      }
      toast.success(t('Saved', 'تم الحفظ'));
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={isNew ? t('Add cheque', 'إضافة شيك') : t('Edit cheque', 'تعديل الشيك')} footer={<Button onClick={save} disabled={busy}>{t('Save', 'حفظ')}</Button>}>
      {isNew && (
        <Field label={t('Type', 'النوع')}>
          <Select value={f.direction} onChange={set('direction')} options={[{ value: 'issued', label: t('Issued by the college', 'صادر من الكلية') }, { value: 'received', label: t('Received by the college', 'وارد إلى الكلية') }]} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={`${t('Cheque no.', 'رقم الشيك')} *`}><Input value={f.cheque_no} onChange={set('cheque_no')} /></Field>
        <Field label={`${t('Amount', 'المبلغ')} *`}><Input type="number" min="0.01" step="0.01" value={f.amount} onChange={set('amount')} /></Field>
        <Field label={t('Bank', 'البنك')}><Input value={f.bank_name} onChange={set('bank_name')} /></Field>
        <Field label={t('Branch', 'الفرع')}><Input value={f.branch} onChange={set('branch')} /></Field>
        <Field label={`${t('Date on cheque', 'التاريخ على الشيك')} *`} hint={t('A future date means post-dated.', 'التاريخ المستقبلي يعني شيكاً مؤجلاً.')}><Input type="date" value={f.cheque_date} onChange={set('cheque_date')} /></Field>
        <Field label={f.direction === 'received' ? t('Received on', 'تاريخ الاستلام') : t('Handed over on', 'تاريخ التسليم')}><Input type="date" value={f.handled_on} onChange={set('handled_on')} /></Field>
      </div>
      <Field label={`${f.direction === 'received' ? t('Drawer (who gave it)', 'الساحب (من أعطاه)') : t('Payee (who it is for)', 'المستفيد')} *`}><Input value={f.party_name} onChange={set('party_name')} /></Field>
      <Field label={t('Purpose', 'الغرض')}><Input value={f.purpose} onChange={set('purpose')} /></Field>
      <Field label={t('Notes', 'ملاحظات')}><Textarea value={f.notes} onChange={set('notes')} /></Field>
    </Modal>
  );
}

function ChequeHistory({ cheque, statusLabels, onClose }) {
  const { t } = useLang();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    query('cheque_events', (q) => q.select('*, actor:actor_id(full_name)').eq('cheque_id', cheque.id).order('created_at')).then(setRows).catch(() => setRows([]));
  }, [cheque.id]);
  return (
    <Modal open onClose={onClose} title={`${t('Cheque', 'شيك')} ${cheque.cheque_no}`}>
      {!rows ? <Loading /> : !rows.length ? <p className="text-sm text-ink-text-muted">{t('No status changes yet.', 'لا تغييرات في الحالة بعد.')}</p> : (
        <ul className="space-y-2 text-sm">
          {rows.map((e) => (
            <li key={e.id} className="border-b border-sand-border pb-2">
              <b>{statusLabels[e.to_status] || e.to_status}</b> · {e.on_date} · {e.actor?.full_name || '—'}
              {e.note && <div className="text-xs text-ink-text-secondary">{e.note}</div>}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
