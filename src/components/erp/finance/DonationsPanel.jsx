import { useState } from 'react';
import { toast } from 'react-toastify';
import { AsyncView, Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Stat, StatusBadge, Table, Textarea, useAsync, useLang } from '../ui';
import { useAuth } from '../../../context/AuthContext';
import { query, rpc, formatMoney, formatDate, today, downloadCsv } from '../../../lib/erp/rpc';
import {
  FUND_TYPES,
  PAYMENT_METHODS,
  esc,
  date,
  money,
  firstOfMonth,
  labelOf,
  num,
  printDocument,
  printGrid,
  profilesMap,
  runAction,
  toOptions,
  useOrg,
} from '../../../lib/erp/financeApi';
import { ConfirmModal, DateRange, FilterBar, Num, StudentPicker } from './shared';

const METHODS = ['cash', 'bank_transfer', 'cheque', 'online', 'other'];

function printDonationReceipt(org, d, student) {
  const body = `
    ${printGrid([
      ['Receipt No.', esc(d.receipt_no)],
      ['Date', date(d.donation_date)],
      ['Donor', esc(d.is_anonymous ? 'Anonymous donor' : d.donor_name || '—')],
      ['Contact', esc(d.is_anonymous ? '—' : [d.donor_phone, d.donor_email].filter(Boolean).join(' · ') || '—')],
      ['Fund', esc(FUND_TYPES[d.fund_type]?.[0] || d.fund_type)],
      ['Method', esc(PAYMENT_METHODS[d.method]?.[0] || d.method)],
      ['Reference', esc(d.reference || '—')],
      ['Sponsored student', esc(student?.full_name || '—')],
    ])}
    ${d.status === 'reversed' ? '<p class="badge" style="background:#fee2e2;color:#991b1b;margin-bottom:12px;">REVERSED</p>' : ''}
    <p class="lbl">Amount received with thanks</p>
    <p class="big" style="margin-bottom:12px;">${money(d.amount)}</p>
    ${d.notes ? `<p class="muted">${esc(d.notes)}</p>` : ''}
    <p style="margin-top:18px;">جزاكم الله خيرًا — May Allah reward you abundantly.</p>
    <div class="sig">Received by</div>`;
  printDocument({ title: 'Donation Receipt', org, body });
}

function DonationForm({ onClose, onSaved }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    amount: '',
    fund_type: 'general',
    method: 'cash',
    donor_name: '',
    donor_phone: '',
    donor_email: '',
    is_anonymous: false,
    reference: '',
    notes: '',
    sponsored_student: null,
    date: today(),
  });
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const valid = num(form.amount) > 0 && form.date && (form.is_anonymous || form.donor_name.trim()) && (form.method === 'cash' || form.reference.trim());

  const save = async () => {
    if (!window.confirm(t(`Record donation of ${formatMoney(num(form.amount))}?`, `تسجيل تبرع بقيمة ${formatMoney(num(form.amount))}؟`))) return;
    setBusy(true);
    const res = await runAction(() =>
      rpc('record_donation', {
        p_amount: Math.round(num(form.amount) * 100) / 100,
        p_fund_type: form.fund_type,
        p_method: form.method,
        p_donor_name: form.donor_name.trim() || null,
        p_donor_phone: form.donor_phone.trim() || null,
        p_donor_email: form.donor_email.trim() || null,
        p_is_anonymous: form.is_anonymous,
        p_reference: form.reference.trim() || null,
        p_notes: form.notes.trim() || null,
        p_sponsored_student: form.sponsored_student || null,
        p_date: form.date,
      }),
    );
    setBusy(false);
    if (res) onSaved(res);
  };

  return (
    <Modal
      open
      title={t('Record donation', 'تسجيل تبرع')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button onClick={save} disabled={!valid || busy}>
            {busy ? t('Saving…', 'جارٍ الحفظ…') : t('Record', 'تسجيل')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('Amount', 'المبلغ')}>
          <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
        </Field>
        <Field label={t('Date', 'التاريخ')}>
          <Input type="date" max={today()} value={form.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <Field label={t('Fund', 'الصندوق')}>
          <Select value={form.fund_type} onChange={(e) => set({ fund_type: e.target.value })} options={toOptions(FUND_TYPES, t)} />
        </Field>
        <Field label={t('Method', 'الطريقة')}>
          <Select value={form.method} onChange={(e) => set({ method: e.target.value })} options={METHODS.map((m) => ({ value: m, label: labelOf(PAYMENT_METHODS, m, t) }))} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input type="checkbox" className="accent-emerald-500" checked={form.is_anonymous} onChange={(e) => set({ is_anonymous: e.target.checked })} />
        {t('Anonymous donor (name hidden on receipts and reports)', 'متبرع مجهول (يُخفى الاسم في الإيصالات والتقارير)')}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Field label={form.is_anonymous ? t('Donor name (optional, internal)', 'اسم المتبرع (اختياري، داخلي)') : t('Donor name', 'اسم المتبرع')}>
          <Input value={form.donor_name} onChange={(e) => set({ donor_name: e.target.value })} />
        </Field>
        <Field label={t('Phone', 'الهاتف')}>
          <Input value={form.donor_phone} onChange={(e) => set({ donor_phone: e.target.value })} />
        </Field>
        <Field label={t('Email', 'البريد الإلكتروني')}>
          <Input type="email" value={form.donor_email} onChange={(e) => set({ donor_email: e.target.value })} />
        </Field>
        <Field label={form.method === 'cash' ? t('Reference', 'المرجع') : t('Reference (required)', 'المرجع (مطلوب)')}>
          <Input value={form.reference} onChange={(e) => set({ reference: e.target.value })} />
        </Field>
      </div>
      <StudentPicker
        label={t('Sponsored student (optional)', 'الطالب المكفول (اختياري)')}
        allowEmpty
        value={form.sponsored_student}
        onChange={(v) => set({ sponsored_student: v })}
      />
      <Field label={t('Notes', 'ملاحظات')}>
        <Textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </Modal>
  );
}

export default function DonationsPanel() {
  const { t } = useLang();
  const { user, isFinanceStaff, isAccountant } = useAuth();
  const org = useOrg(user?.orgId);
  const [filters, setFilters] = useState({ from: firstOfMonth(), to: today(), fund: '', status: 'recorded' });
  const [creating, setCreating] = useState(false);
  const [reversing, setReversing] = useState(null);

  const [state, reload] = useAsync(async () => {
    const rows = await query('donations', (q) => {
      let b = q.select('*').order('donation_date', { ascending: false }).order('created_at', { ascending: false }).limit(1000);
      if (filters.from) b = b.gte('donation_date', filters.from);
      if (filters.to) b = b.lte('donation_date', filters.to);
      if (filters.fund) b = b.eq('fund_type', filters.fund);
      if (filters.status) b = b.eq('status', filters.status);
      return b;
    });
    const people = await profilesMap(rows.flatMap((r) => [r.sponsored_student_id, r.received_by]));
    return { rows, people };
  }, [filters.from, filters.to, filters.fund, filters.status]);

  return (
    <div>
      <PageHeader
        title={t('Donations', 'التبرعات')}
        subtitle={t('Zakat, sadaqah, waqf, sponsorship and building-fund receipts — each posted to its own income account.', 'الزكاة والصدقة والوقف والكفالة وصندوق البناء — كلٌّ يُرحَّل إلى حساب إيراد مستقل.')}
        actions={isFinanceStaff && <Button onClick={() => setCreating(true)}>+ {t('Record donation', 'تسجيل تبرع')}</Button>}
      />
      <Card
        actions={
          <>
            <Button size="sm" variant="secondary" disabled={!state.data?.rows.length} onClick={() => downloadCsv(`donations-${filters.from}-${filters.to}.csv`, state.data.rows)}>
              CSV
            </Button>
            <Button size="sm" variant="secondary" onClick={reload}>
              {t('Refresh', 'تحديث')}
            </Button>
          </>
        }
      >
        <FilterBar>
          <DateRange from={filters.from} to={filters.to} onChange={(r) => setFilters((f) => ({ ...f, ...r }))} />
          <Field label={t('Fund', 'الصندوق')}>
            <Select value={filters.fund} onChange={(e) => setFilters((f) => ({ ...f, fund: e.target.value }))} placeholder={t('All funds', 'كل الصناديق')} options={toOptions(FUND_TYPES, t)} />
          </Field>
          <Field label={t('Status', 'الحالة')}>
            <Select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              placeholder={t('All', 'الكل')}
              options={[
                { value: 'recorded', label: t('Recorded', 'مسجل') },
                { value: 'reversed', label: t('Reversed', 'معكوس') },
              ]}
            />
          </Field>
        </FilterBar>
        <AsyncView state={state}>
          {({ rows, people }) => {
            const recorded = rows.filter((r) => r.status === 'recorded');
            const total = recorded.reduce((s, r) => s + num(r.amount), 0);
            const byFund = Object.keys(FUND_TYPES)
              .map((f) => ({ fund: f, amount: recorded.filter((r) => r.fund_type === f).reduce((s, r) => s + num(r.amount), 0) }))
              .filter((x) => x.amount > 0);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Stat label={t('Total received', 'إجمالي المقبوض')} value={formatMoney(total)} hint={`${recorded.length} ${t('receipts', 'إيصالات')}`} />
                  {byFund.map((f) => (
                    <Stat key={f.fund} label={labelOf(FUND_TYPES, f.fund, t)} value={formatMoney(f.amount)} tone="blue" />
                  ))}
                </div>
                <Table
                  rows={rows}
                  empty={t('No donations in this range', 'لا توجد تبرعات في هذه الفترة')}
                  columns={[
                    {
                      key: 'receipt_no',
                      label: t('Receipt', 'الإيصال'),
                      render: (d) => (
                        <div>
                          <div className="font-mono text-xs">{d.receipt_no}</div>
                          <div className="text-xs text-gray-500">{formatDate(d.donation_date)}</div>
                        </div>
                      ),
                    },
                    {
                      key: 'donor',
                      label: t('Donor', 'المتبرع'),
                      render: (d) => (
                        <div>
                          <div>{d.is_anonymous ? <Badge>{t('Anonymous', 'مجهول')}</Badge> : d.donor_name || '—'}</div>
                          {!d.is_anonymous && (d.donor_phone || d.donor_email) && (
                            <div className="text-xs text-gray-500">{[d.donor_phone, d.donor_email].filter(Boolean).join(' · ')}</div>
                          )}
                          {d.sponsored_student_id && (
                            <div className="text-xs text-sky-300">
                              {t('Sponsors', 'يكفل')}: {people[d.sponsored_student_id]?.full_name || '—'}
                            </div>
                          )}
                        </div>
                      ),
                    },
                    { key: 'fund_type', label: t('Fund', 'الصندوق'), render: (d) => labelOf(FUND_TYPES, d.fund_type, t) },
                    {
                      key: 'method',
                      label: t('Method', 'الطريقة'),
                      render: (d) => (
                        <div>
                          <div>{labelOf(PAYMENT_METHODS, d.method, t)}</div>
                          {d.reference && <div className="text-xs text-gray-500">{d.reference}</div>}
                        </div>
                      ),
                    },
                    { key: 'amount', label: t('Amount', 'المبلغ'), render: (d) => <Num>{formatMoney(d.amount)}</Num> },
                    { key: 'status', label: t('Status', 'الحالة'), render: (d) => <StatusBadge status={d.status} /> },
                    {
                      key: 'actions',
                      label: '',
                      render: (d) => (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => printDonationReceipt(org, d, people[d.sponsored_student_id])}>
                            {t('Receipt', 'إيصال')}
                          </Button>
                          {isAccountant && d.status === 'recorded' && (
                            <Button size="sm" variant="danger" onClick={() => setReversing(d)}>
                              {t('Reverse', 'عكس')}
                            </Button>
                          )}
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            );
          }}
        </AsyncView>
      </Card>

      {creating && (
        <DonationForm
          onClose={() => setCreating(false)}
          onSaved={(res) => {
            setCreating(false);
            reload();
            toast.success(t(`Donation ${res.receipt_no} recorded`, `تم تسجيل التبرع ${res.receipt_no}`));
          }}
        />
      )}
      <ConfirmModal
        open={Boolean(reversing)}
        title={t('Reverse donation', 'عكس التبرع')}
        message={reversing ? t(`Reverse ${reversing.receipt_no} (${formatMoney(reversing.amount)})? A reversing journal will be posted.`, `عكس ${reversing.receipt_no} (${formatMoney(reversing.amount)})؟ سيتم ترحيل قيد عكسي.`) : ''}
        requireReason
        confirmLabel={t('Reverse', 'عكس')}
        onClose={() => setReversing(null)}
        onConfirm={async (reason) => {
          const ok = await runAction(() => rpc('reverse_donation', { p_donation: reversing.id, p_reason: reason }), t('Donation reversed', 'تم عكس التبرع'));
          if (ok) reload();
          return ok;
        }}
      />
    </div>
  );
}
