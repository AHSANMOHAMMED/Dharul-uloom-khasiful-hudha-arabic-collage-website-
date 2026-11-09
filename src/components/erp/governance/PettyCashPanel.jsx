import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AsyncView, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Stat, Table, Tabs, Textarea, useAsync, useLang } from '../ui';
import { ConfirmModal, DateRange, FilterBar, Num } from '../finance/shared';
import { downloadCsv, formatDate, formatMoney, today } from '../../../lib/erp/rpc';
import { accountLabel, listAccounts, listCashBankAccounts, num, profilesMap, runAction } from '../../../lib/erp/financeApi';
import {
  PETTY_ENTRY_TYPES,
  createFund,
  dutyName,
  listDutyRoles,
  listFunds,
  listPettyEntries,
  pairLabel,
  pairOptions,
  pettyReturn,
  pettySpend,
  pettyTopup,
  reviewPetty,
  updateFund,
} from '../../../lib/erp/governanceApi';
import { Checkbox, useGovernance, GovStatus } from './common';
import { useUrlState } from '../../../lib/useTabParam';

async function loadFunds() {
  const funds = await listFunds();
  const people = await profilesMap(funds.flatMap((f) => f.holders.map((h) => h.assignee_id)));
  return { funds, people };
}

function useCashOptions() {
  const { t, ar } = useLang();
  const [accounts] = useAsync(() => listCashBankAccounts(), []);
  return useMemo(() => {
    const list = (accounts.data || []).filter((a) => a.code !== '1050');
    return list.length
      ? list.map((a) => ({ value: a.code, label: accountLabel(a, ar) }))
      : [
          { value: '1000', label: t('1000 · Cash in Hand', '1000 · النقد في الصندوق') },
          { value: '1010', label: t('1010 · Bank - Current Account', '1010 · الحساب البنكي الجاري') },
        ];
  }, [accounts.data, ar, t]);
}

function fundTitle(f, lang) {
  return dutyName(f?.duty, lang);
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------
function MoveCashModal({ fund, mode, onClose, onSaved }) {
  const { t, lang } = useLang();
  const options = useCashOptions();
  const [form, setForm] = useState({ amount: '', code: '1000', note: '' });
  const [busy, setBusy] = useState(false);
  const isTopup = mode === 'topup';
  const amount = num(form.amount);
  const room = num(fund.float_limit) > 0 ? num(fund.float_limit) - fund.balance.posted_balance : Infinity;
  const tooMuch = isTopup ? amount > room : amount > fund.balance.available;

  const save = async () => {
    setBusy(true);
    const ok = await runAction(
      () => (isTopup ? pettyTopup(fund.id, amount, form.code, form.note) : pettyReturn(fund.id, amount, form.code, form.note)),
      isTopup ? t('Petty cash topped up', 'تمت تعبئة النثرية') : t('Petty cash returned', 'تم إرجاع النثرية'),
    );
    setBusy(false);
    if (ok) onSaved();
  };

  return (
    <Modal
      open
      title={`${isTopup ? t('Top up', 'تعبئة') : t('Return unused cash', 'إرجاع النقد غير المستخدم')} · ${fundTitle(fund, lang)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t('Cancel', 'إلغاء')}</Button>
          <Button onClick={save} disabled={busy || amount <= 0 || tooMuch}>{isTopup ? t('Top up', 'تعبئة') : t('Return', 'إرجاع')}</Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-2 text-xs text-gray-400">
        <div>{t('Balance', 'الرصيد')}: <b className="text-gray-200">{formatMoney(fund.balance.posted_balance)}</b></div>
        <div>{t('Available', 'المتاح')}: <b className="text-gray-200">{formatMoney(fund.balance.available)}</b></div>
        <div>{t('Limit', 'الحد')}: <b className="text-gray-200">{num(fund.float_limit) > 0 ? formatMoney(fund.float_limit) : t('No limit', 'بلا حد')}</b></div>
      </div>
      <Field
        label={t('Amount', 'المبلغ')}
        hint={tooMuch ? (isTopup ? t('Exceeds the fund limit', 'يتجاوز حد الصندوق') : t('Exceeds the available balance', 'يتجاوز الرصيد المتاح')) : undefined}
      >
        <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
      </Field>
      <Field label={isTopup ? t('From', 'من') : t('Return to', 'إرجاع إلى')}>
        <Select value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} options={options} />
      </Field>
      <Field label={t('Note', 'ملاحظة')}>
        <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
      </Field>
    </Modal>
  );
}

function SpendModal({ fund, onClose, onSaved }) {
  const { t, ar, lang } = useLang();
  const [accounts] = useAsync(() => listAccounts((q) => q.eq('type', 'expense').eq('is_active', true)), []);
  const [form, setForm] = useState({ account: '', amount: '', description: '', vendor: '', date: today(), receiptUrl: '' });
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const amount = num(form.amount);
  const over = amount > fund.balance.available;
  const badUrl = form.receiptUrl.trim() && !/^https?:\/\//i.test(form.receiptUrl.trim());
  const valid = form.account && amount > 0 && !over && form.description.trim() && form.date && !badUrl;

  const save = async () => {
    setBusy(true);
    const ok = await runAction(() => pettySpend({ fund: fund.id, ...form, amount: Math.round(amount * 100) / 100 }), t('Spend recorded — awaiting accounts approval', 'تم تسجيل الصرف — بانتظار اعتماد الحسابات'));
    setBusy(false);
    if (ok) onSaved();
  };

  return (
    <Modal
      open
      title={`${t('Record a spend', 'تسجيل صرف')} · ${fundTitle(fund, lang)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t('Cancel', 'إلغاء')}</Button>
          <Button onClick={save} disabled={busy || !valid}>{busy ? t('Submitting…', 'جارٍ التقديم…') : t('Submit', 'تقديم')}</Button>
        </>
      }
    >
      <div className="rounded-xl border border-gray-800 p-3 text-sm">
        {t('Available', 'المتاح')}: <b className={fund.balance.available > 0 ? 'text-emerald-300' : 'text-red-400'}>{formatMoney(fund.balance.available)}</b>
      </div>
      <Field label={t('Expense account', 'حساب المصروف')} hint={accounts.error?.message}>
        <Select
          value={form.account}
          onChange={(e) => set({ account: e.target.value })}
          placeholder={accounts.loading ? t('Loading…', 'جارٍ التحميل…') : t('Select…', 'اختر…')}
          options={(accounts.data || []).map((a) => ({ value: a.id, label: accountLabel(a, ar) }))}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('Amount', 'المبلغ')} hint={over ? t('Not enough petty cash', 'النثرية غير كافية') : undefined}>
          <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
        </Field>
        <Field label={t('Date', 'التاريخ')}>
          <Input type="date" max={today()} value={form.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
      </div>
      <Field label={t('Description', 'الوصف')}>
        <Textarea rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <Field label={t('Vendor / shop', 'المورد / المتجر')}>
        <Input value={form.vendor} onChange={(e) => set({ vendor: e.target.value })} />
      </Field>
      <Field label={t('Receipt link', 'رابط الإيصال')} hint={badUrl ? t('Use a full https:// link', 'استخدم رابطًا كاملًا https://') : t('Optional: photo or scan link', 'اختياري: رابط صورة أو مسح')}>
        <Input type="url" value={form.receiptUrl} onChange={(e) => set({ receiptUrl: e.target.value })} />
      </Field>
    </Modal>
  );
}

function EditFundModal({ fund, onClose, onSaved }) {
  const { t, lang } = useLang();
  const [form, setForm] = useState({ float_limit: fund.float_limit ?? 0, is_active: fund.is_active });
  const save = async () => {
    const ok = await runAction(() => updateFund(fund.id, { float_limit: Math.max(0, num(form.float_limit)), is_active: Boolean(form.is_active) }), t('Fund updated', 'تم تحديث الصندوق'));
    if (ok) onSaved();
  };
  return (
    <Modal
      open
      title={`${t('Fund settings', 'إعدادات الصندوق')} · ${fundTitle(fund, lang)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('Cancel', 'إلغاء')}</Button>
          <Button onClick={save}>{t('Save', 'حفظ')}</Button>
        </>
      }
    >
      <Field label={t('Float limit (LKR)', 'حد الصندوق (روبية)')} hint={t('0 = no limit', '0 = بلا حد')}>
        <Input type="number" min="0" step="0.01" value={form.float_limit} onChange={(e) => setForm((f) => ({ ...f, float_limit: e.target.value }))} />
      </Field>
      <Checkbox checked={form.is_active} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} label={t('Active', 'نشط')} />
    </Modal>
  );
}

function NewFundModal({ existing, onClose, onSaved }) {
  const { t, lang } = useLang();
  const [duties] = useAsync(() => listDutyRoles({ activeOnly: true }), []);
  const [form, setForm] = useState({ duty: '', limit: '' });
  const options = (duties.data || []).filter((d) => !existing.has(d.id)).map((d) => ({ value: d.id, label: dutyName(d, lang) }));
  const save = async () => {
    const ok = await runAction(() => createFund(form.duty, form.limit), t('Fund opened', 'تم فتح الصندوق'));
    if (ok) onSaved();
  };
  return (
    <Modal
      open
      title={t('Open a petty cash fund', 'فتح صندوق نثرية')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('Cancel', 'إلغاء')}</Button>
          <Button onClick={save} disabled={!form.duty}>{t('Open fund', 'فتح الصندوق')}</Button>
        </>
      }
    >
      <Field label={t('Duty', 'المسؤولية')}>
        <Select value={form.duty} onChange={(e) => setForm((f) => ({ ...f, duty: e.target.value }))} placeholder={t('Select…', 'اختر…')} options={options} />
      </Field>
      <Field label={t('Float limit (LKR)', 'حد الصندوق (روبية)')} hint={t('0 = no limit', '0 = بلا حد')}>
        <Input type="number" min="0" step="0.01" value={form.limit} onChange={(e) => setForm((f) => ({ ...f, limit: e.target.value }))} />
      </Field>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Funds table
// ---------------------------------------------------------------------------
function FundsTable({ funds, people, userId, isFinanceStaff, isGov, onAction }) {
  const { t, lang } = useLang();
  return (
    <Table
      rows={funds}
      empty={t('No petty cash funds.', 'لا توجد صناديق نثرية.')}
      columns={[
        {
          key: 'duty',
          label: t('Duty', 'المسؤولية'),
          render: (f) => (
            <div>
              <div className="font-semibold">{fundTitle(f, lang)}</div>
              {!f.is_active && <Badge tone="red">{t('Inactive', 'غير نشط')}</Badge>}
            </div>
          ),
        },
        {
          key: 'holder',
          label: t('Current holder', 'الحامل الحالي'),
          render: (f) => (f.holders.length ? f.holders.map((h) => people[h.assignee_id]?.full_name || '—').join(', ') : <span className="text-amber-300">{t('No holder', 'بلا حامل')}</span>),
        },
        { key: 'float_limit', label: t('Limit', 'الحد'), render: (f) => <Num>{num(f.float_limit) > 0 ? formatMoney(f.float_limit) : '—'}</Num> },
        { key: 'balance', label: t('Balance', 'الرصيد'), render: (f) => <Num>{formatMoney(f.balance.posted_balance)}</Num> },
        { key: 'pending', label: t('Pending', 'معلق'), render: (f) => <Num className={f.balance.pending_spend ? 'text-amber-300' : ''}>{formatMoney(f.balance.pending_spend)}</Num> },
        { key: 'available', label: t('Available', 'المتاح'), render: (f) => <Num className="font-semibold">{formatMoney(f.balance.available)}</Num> },
        {
          key: 'act',
          label: '',
          render: (f) => {
            const isHolder = f.holder_id === userId;
            return (
              <div className="flex flex-wrap gap-1 justify-end">
                {(isHolder || isFinanceStaff) && f.is_active && f.holder_id && (
                  <Button size="sm" onClick={() => onAction('spend', f)}>{t('Record spend', 'تسجيل صرف')}</Button>
                )}
                {isFinanceStaff && f.is_active && <Button size="sm" variant="secondary" onClick={() => onAction('topup', f)}>{t('Top up', 'تعبئة')}</Button>}
                {isFinanceStaff && f.balance.available > 0 && <Button size="sm" variant="secondary" onClick={() => onAction('return', f)}>{t('Return', 'إرجاع')}</Button>}
                {(isFinanceStaff || isGov) && <Button size="sm" variant="ghost" onClick={() => onAction('edit', f)}>{t('Settings', 'الإعدادات')}</Button>}
                <Button size="sm" variant="ghost" onClick={() => onAction('ledger', f)}>{t('Ledger', 'الدفتر')}</Button>
              </div>
            );
          },
        },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------
function ReviewTab({ funds, userId, isAdmin, onChanged }) {
  const { t, ar, lang } = useLang();
  const [state, reload] = useAsync(async () => {
    const rows = (await listPettyEntries({ status: 'submitted' })).filter((e) => e.entry_type === 'expense');
    const people = await profilesMap(rows.flatMap((r) => [r.holder_id, r.submitted_by]));
    return { rows, people };
  }, []);
  const [rejecting, setRejecting] = useState(null);
  const fundMap = Object.fromEntries(funds.map((f) => [f.id, f]));
  const approve = async (e) => {
    if (!window.confirm(`${t('Approve and post', 'اعتماد وترحيل')} ${formatMoney(e.amount)}?`)) return;
    if (await runAction(() => reviewPetty(e.id, true), t('Spend approved and posted', 'تم اعتماد الصرف وترحيله'))) {
      reload();
      onChanged();
    }
  };
  return (
    <Card title={t('Spends awaiting approval', 'مصروفات بانتظار الاعتماد')} actions={<Button size="sm" variant="secondary" onClick={reload}>{t('Refresh', 'تحديث')}</Button>}>
      <AsyncView state={state}>
        {({ rows, people }) => (
          <Table
            rows={rows}
            empty={t('Nothing to review.', 'لا شيء للمراجعة.')}
            columns={[
              { key: 'entry_date', label: t('Date', 'التاريخ'), render: (e) => formatDate(e.entry_date) },
              { key: 'fund', label: t('Duty', 'المسؤولية'), render: (e) => fundTitle(fundMap[e.fund_id], lang) },
              { key: 'holder', label: t('Holder', 'الحامل'), render: (e) => people[e.holder_id]?.full_name || '—' },
              {
                key: 'description',
                label: t('Description', 'الوصف'),
                render: (e) => (
                  <div className="min-w-[12rem]">
                    <div>{e.description}</div>
                    {e.vendor && <div className="text-xs text-gray-500">{e.vendor}</div>}
                    {e.receipt_url && (
                      <a href={e.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 underline">
                        {t('Receipt', 'الإيصال')}
                      </a>
                    )}
                  </div>
                ),
              },
              { key: 'account', label: t('Account', 'الحساب'), render: (e) => (e.account ? accountLabel(e.account, ar) : '—') },
              { key: 'amount', label: t('Amount', 'المبلغ'), render: (e) => <Num>{formatMoney(e.amount)}</Num> },
              {
                key: 'act',
                label: '',
                render: (e) => {
                  const own = e.submitted_by === userId;
                  if (own && !isAdmin) return <span className="text-xs text-gray-500">{t('Your own submission', 'طلبك الخاص')}</span>;
                  return (
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" onClick={() => approve(e)}>{t('Approve', 'اعتماد')}</Button>
                      <Button size="sm" variant="secondary" onClick={() => setRejecting(e)}>{t('Reject', 'رفض')}</Button>
                    </div>
                  );
                },
              },
            ]}
          />
        )}
      </AsyncView>
      <ConfirmModal
        open={Boolean(rejecting)}
        title={t('Reject spend', 'رفض الصرف')}
        message={rejecting ? `${rejecting.description} · ${formatMoney(rejecting.amount)}` : ''}
        requireReason
        confirmLabel={t('Reject', 'رفض')}
        onClose={() => setRejecting(null)}
        onConfirm={async (reason) => {
          const ok = await runAction(() => reviewPetty(rejecting.id, false, reason), t('Spend rejected', 'تم رفض الصرف'));
          if (ok) {
            reload();
            onChanged();
          }
          return ok;
        }}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------
function LedgerTab({ funds, initialFund }) {
  const { t, ar, lang } = useLang();
  const [filters, setFilters] = useState({ fund: initialFund || '', holder: '', type: '', from: '', to: '' });
  const [state] = useAsync(async () => {
    const rows = await listPettyEntries({ fundId: filters.fund || undefined, holderId: filters.holder || undefined, limit: 1000 });
    const people = await profilesMap(rows.flatMap((r) => [r.holder_id, r.submitted_by, r.approved_by]));
    return { rows, people };
  }, [filters.fund, filters.holder]);
  const fundMap = Object.fromEntries(funds.map((f) => [f.id, f]));

  const rows = (state.data?.rows || [])
    .filter((r) => !filters.type || r.entry_type === filters.type)
    .filter((r) => !filters.from || r.entry_date >= filters.from)
    .filter((r) => !filters.to || r.entry_date <= filters.to);
  const people = state.data?.people || {};
  const holderOptions = Object.values(people).map((p) => ({ value: p.id, label: p.full_name || p.id }));
  const sum = (type) => rows.filter((r) => r.entry_type === type && r.status === 'posted').reduce((s, r) => s + num(r.amount), 0);

  const exportCsv = () =>
    downloadCsv(
      'petty-cash-ledger.csv',
      rows.map((r) => ({
        date: r.entry_date,
        duty: fundMap[r.fund_id]?.duty?.name_en || '',
        type: r.entry_type,
        status: r.status,
        holder: people[r.holder_id]?.full_name || '',
        description: r.description,
        vendor: r.vendor || '',
        account: r.account?.code || r.counter_account_code || '',
        amount: r.amount,
        receipt_url: r.receipt_url || '',
        rejection_reason: r.rejection_reason || '',
      })),
    );

  return (
    <Card title={t('Petty cash ledger', 'دفتر النثرية')} actions={<Button size="sm" variant="secondary" disabled={!rows.length} onClick={exportCsv}>{t('Export CSV', 'تصدير CSV')}</Button>}>
      <FilterBar>
        <Field label={t('Fund', 'الصندوق')}>
          <Select value={filters.fund} onChange={(e) => setFilters((f) => ({ ...f, fund: e.target.value }))} placeholder={t('All', 'الكل')} options={funds.map((f) => ({ value: f.id, label: fundTitle(f, lang) }))} />
        </Field>
        <Field label={t('Holder', 'الحامل')}>
          <Select value={filters.holder} onChange={(e) => setFilters((f) => ({ ...f, holder: e.target.value }))} placeholder={t('All', 'الكل')} options={holderOptions} />
        </Field>
        <Field label={t('Type', 'النوع')}>
          <Select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} placeholder={t('All', 'الكل')} options={pairOptions(PETTY_ENTRY_TYPES, t)} />
        </Field>
        <DateRange from={filters.from} to={filters.to} onChange={(r) => setFilters((f) => ({ ...f, ...r }))} />
      </FilterBar>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label={t('Topped up', 'المعبأ')} value={formatMoney(sum('topup'))} tone="blue" />
        <Stat label={t('Spent', 'المصروف')} value={formatMoney(sum('expense'))} />
        <Stat label={t('Returned', 'المُرجَع')} value={formatMoney(sum('return'))} tone="gray" />
      </div>
      <AsyncView state={state}>
        {() => (
          <Table
            rows={rows}
            empty={t('No petty cash entries.', 'لا توجد قيود نثرية.')}
            columns={[
              { key: 'entry_date', label: t('Date', 'التاريخ'), render: (r) => formatDate(r.entry_date) },
              { key: 'fund', label: t('Duty', 'المسؤولية'), render: (r) => fundTitle(fundMap[r.fund_id], lang) },
              { key: 'entry_type', label: t('Type', 'النوع'), render: (r) => <Badge tone={r.entry_type === 'topup' ? 'blue' : r.entry_type === 'return' ? 'gray' : 'amber'}>{pairLabel(PETTY_ENTRY_TYPES, r.entry_type, t)}</Badge> },
              { key: 'holder', label: t('Holder', 'الحامل'), render: (r) => people[r.holder_id]?.full_name || '—' },
              {
                key: 'description',
                label: t('Description', 'الوصف'),
                render: (r) => (
                  <div className="min-w-[12rem]">
                    <div>{r.description}</div>
                    {r.vendor && <div className="text-xs text-gray-500">{r.vendor}</div>}
                    {r.account && <div className="text-xs text-gray-500">{accountLabel(r.account, ar)}</div>}
                    {r.receipt_url && (
                      <a href={r.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 underline">
                        {t('Receipt', 'الإيصال')}
                      </a>
                    )}
                    {r.rejection_reason && <div className="text-xs text-red-400">{r.rejection_reason}</div>}
                  </div>
                ),
              },
              { key: 'amount', label: t('Amount', 'المبلغ'), render: (r) => <Num className={r.entry_type === 'topup' ? 'text-emerald-300' : ''}>{r.entry_type === 'topup' ? '+' : '−'} {formatMoney(r.amount)}</Num> },
              { key: 'status', label: t('Status', 'الحالة'), render: (r) => <GovStatus status={r.status} /> },
            ]}
          />
        )}
      </AsyncView>
    </Card>
  );
}

export default function PettyCashPanel() {
  const { t } = useLang();
  const { user, isAdmin, isAccountant, isFinanceStaff, isFinanceViewer, isGov } = useGovernance();
  const seesAll = isFinanceViewer || isGov;
  // In the URL (?petty=) so Back/Forward and links reach this tab.
  const [tab, setTab] = useUrlState('petty', seesAll ? 'funds' : 'mine');
  const [state, reload] = useAsync(loadFunds, []);
  const [action, setAction] = useState(null);
  const [ledgerFund, setLedgerFund] = useState('');
  const [opening, setOpening] = useState(false);
  const [params] = useSearchParams();
  const deepLinked = useRef(false);

  // ?module=pettycash&spend=<fund id> (from "My workspace") opens the spend form.
  useEffect(() => {
    const id = params.get('spend');
    if (!id || deepLinked.current || !state.data) return;
    deepLinked.current = true;
    const fund = state.data.funds.find((f) => f.id === id);
    if (fund) {
      setTab('mine');
      setAction({ kind: 'spend', fund });
    }
  }, [params, state.data, setTab]);

  const onAction = (kind, fund) => {
    if (kind === 'ledger') {
      setLedgerFund(fund.id);
      setTab('ledger');
      return;
    }
    setAction({ kind, fund });
  };
  const done = () => {
    setAction(null);
    reload();
  };

  const tabs = [
    ...(seesAll ? [{ id: 'funds', label: t('All funds', 'كل الصناديق') }] : []),
    { id: 'mine', label: t('My funds', 'صناديقي') },
    ...(isAccountant ? [{ id: 'review', label: t('Review queue', 'قائمة المراجعة') }] : []),
    { id: 'ledger', label: t('Ledger', 'الدفتر') },
  ];

  return (
    <div>
      <PageHeader
        title={t('Petty cash', 'النثرية')}
        subtitle={t('A small cash float per duty: top-ups by accounts, spends by the duty holder, approved and posted to the ledger.', 'نقد صغير لكل مسؤولية: تعبئة من الحسابات، صرف من الحامل، واعتماد وترحيل إلى الدفتر.')}
        actions={
          <>
            <Button variant="secondary" onClick={reload}>{t('Refresh', 'تحديث')}</Button>
            {(isFinanceStaff || isGov) && <Button onClick={() => setOpening(true)}>+ {t('Open fund', 'فتح الصندوق')}</Button>}
          </>
        }
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <AsyncView state={state}>
        {({ funds, people }) => {
          const mine = funds.filter((f) => f.holders.some((h) => h.assignee_id === user?.id));
          const tableProps = { people, userId: user?.id, isFinanceStaff, isGov, onAction };
          return (
            <>
              {tab === 'funds' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Stat label={t('Funds', 'الصناديق')} value={funds.length} tone="gray" />
                    <Stat label={t('Cash with holders', 'النقد لدى الحاملين')} value={formatMoney(funds.reduce((s, f) => s + f.balance.posted_balance, 0))} />
                    <Stat label={t('Pending approval', 'بانتظار الاعتماد')} value={formatMoney(funds.reduce((s, f) => s + f.balance.pending_spend, 0))} tone="amber" />
                    <Stat label={t('Funds without a holder', 'صناديق بلا حامل')} value={funds.filter((f) => !f.holders.length).length} tone="red" />
                  </div>
                  <Card>
                    <FundsTable funds={funds} {...tableProps} />
                  </Card>
                </div>
              )}
              {tab === 'mine' && (
                <Card title={t('Funds of my duties', 'صناديق مسؤولياتي')}>
                  {mine.length ? (
                    <FundsTable funds={mine} {...tableProps} />
                  ) : (
                    <EmptyState text={t('You do not hold a duty with a petty cash fund.', 'لا تتولى مسؤولية لها صندوق نثرية.')} />
                  )}
                </Card>
              )}
              {tab === 'review' && isAccountant && <ReviewTab funds={funds} userId={user?.id} isAdmin={isAdmin} onChanged={reload} />}
              {tab === 'ledger' && <LedgerTab key={ledgerFund} funds={funds} initialFund={ledgerFund} />}
              {opening && (
                <NewFundModal
                  existing={new Set(funds.map((f) => f.duty_role_id))}
                  onClose={() => setOpening(false)}
                  onSaved={() => {
                    setOpening(false);
                    reload();
                  }}
                />
              )}
            </>
          );
        }}
      </AsyncView>
      {action?.kind === 'spend' && <SpendModal fund={action.fund} onClose={() => setAction(null)} onSaved={done} />}
      {(action?.kind === 'topup' || action?.kind === 'return') && <MoveCashModal fund={action.fund} mode={action.kind} onClose={() => setAction(null)} onSaved={done} />}
      {action?.kind === 'edit' && <EditFundModal fund={action.fund} onClose={() => setAction(null)} onSaved={done} />}
    </div>
  );
}
