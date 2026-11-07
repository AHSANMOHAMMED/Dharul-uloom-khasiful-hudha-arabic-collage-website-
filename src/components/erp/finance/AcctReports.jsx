import { useState } from 'react';
import { AsyncView, Badge, Button, Card, Field, Input, Tabs, useAsync, useLang } from '../ui';
import { useAuth } from '../../../context/AuthContext';
import { rpc, formatMoney, formatDate, today, downloadCsv } from '../../../lib/erp/rpc';
import { esc, money, num, printDocument, printTable, useOrg } from '../../../lib/erp/financeApi';
import { DateRange, FilterBar } from './shared';

function yearStart() {
  return `${new Date().getFullYear()}-01-01`;
}

/** Plain report table with logical alignment. rows: [{ code, name, amount }] */
function Section({ title, rows, total, totalLabel }) {
  const { t } = useLang();
  return (
    <div className="mb-5">
      <h4 className="text-sm font-bold text-emerald-300 mb-2">{title}</h4>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-800">
          {rows.length ? (
            rows.map((r) => (
              <tr key={r.code}>
                <td className="py-1.5 pe-3 font-mono text-gray-400 w-20">{r.code}</td>
                <td className="py-1.5 text-gray-200">{r.name}</td>
                <td className="py-1.5 text-end tabular-nums text-gray-100">{formatMoney(r.amount)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} className="py-2 text-gray-500">
                {t('No balances', 'لا توجد أرصدة')}
              </td>
            </tr>
          )}
          <tr className="border-t-2 border-gray-600">
            <td />
            <td className="py-2 font-bold text-white">{totalLabel}</td>
            <td className="py-2 text-end font-bold tabular-nums text-white">{formatMoney(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const printRows = (rows) => rows.map((r) => [esc(r.code), esc(r.name), money(r.amount)]);
const printCols = [{ label: 'Code' }, { label: 'Account' }, { label: 'Amount', num: true }];

function TrialBalance({ org }) {
  const { t } = useLang();
  const [range, setRange] = useState({ from: '', to: today() });
  const [hideZero, setHideZero] = useState(true);
  const [state] = useAsync(() => rpc('trial_balance', { p_from: range.from || null, p_to: range.to || null }), [range.from, range.to]);

  return (
    <AsyncView state={state}>
      {(all) => {
        const rows = (all || []).filter((r) => !hideZero || num(r.debit) || num(r.credit));
        const dr = rows.reduce((s, r) => s + num(r.debit), 0);
        const cr = rows.reduce((s, r) => s + num(r.credit), 0);
        const balanced = Math.abs(dr - cr) < 0.005;
        const period = `${range.from ? formatDate(range.from) : 'Inception'} – ${formatDate(range.to || today())}`;
        return (
          <>
            <FilterBar>
              <DateRange from={range.from} to={range.to} onChange={setRange} />
              <label className="flex items-center gap-2 text-sm text-gray-400 pb-2">
                <input type="checkbox" className="accent-emerald-500" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
                {t('Hide accounts without activity', 'إخفاء الحسابات بلا حركة')}
              </label>
              <div className="flex gap-2 pb-0.5">
                <Button size="sm" variant="secondary" disabled={!rows.length} onClick={() => downloadCsv(`trial-balance-${range.to || today()}.csv`, rows)}>
                  CSV
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    printDocument({
                      title: 'Trial Balance',
                      org,
                      body: `<p class="muted" style="margin-bottom:10px;">${esc(period)}</p>${printTable(
                        [{ label: 'Code' }, { label: 'Account' }, { label: 'Type' }, { label: 'Debit', num: true }, { label: 'Credit', num: true }, { label: 'Balance', num: true }],
                        rows.map((r) => [esc(r.code), esc(r.name), esc(r.type), money(r.debit), money(r.credit), money(r.balance)]),
                        ['', 'Total', '', money(dr), money(cr), ''],
                      )}`,
                    })
                  }
                >
                  {t('Print', 'طباعة')}
                </Button>
              </div>
            </FilterBar>
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-900/80 text-gray-400">
                  <tr>
                    <th className="px-3 py-2 text-start">{t('Code', 'الرمز')}</th>
                    <th className="px-3 py-2 text-start">{t('Account', 'الحساب')}</th>
                    <th className="px-3 py-2 text-start">{t('Type', 'النوع')}</th>
                    <th className="px-3 py-2 text-end">{t('Debit', 'مدين')}</th>
                    <th className="px-3 py-2 text-end">{t('Credit', 'دائن')}</th>
                    <th className="px-3 py-2 text-end">{t('Balance', 'الرصيد')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {rows.map((r) => (
                    <tr key={r.account_id}>
                      <td className="px-3 py-1.5 font-mono">{r.code}</td>
                      <td className="px-3 py-1.5">{r.name}</td>
                      <td className="px-3 py-1.5 text-gray-400">{r.type}</td>
                      <td className="px-3 py-1.5 text-end tabular-nums">{formatMoney(r.debit)}</td>
                      <td className="px-3 py-1.5 text-end tabular-nums">{formatMoney(r.credit)}</td>
                      <td className="px-3 py-1.5 text-end tabular-nums font-semibold">{formatMoney(r.balance)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-900/80 font-bold">
                    <td className="px-3 py-2" colSpan={3}>
                      {t('Totals', 'الإجماليات')} <Badge tone={balanced ? 'green' : 'red'}>{balanced ? t('Balanced', 'متوازن') : t('Out of balance', 'غير متوازن')}</Badge>
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">{formatMoney(dr)}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{formatMoney(cr)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        );
      }}
    </AsyncView>
  );
}

function IncomeStatement({ org }) {
  const { t } = useLang();
  const [range, setRange] = useState({ from: yearStart(), to: today() });
  const ready = range.from && range.to;
  const [state] = useAsync(() => (ready ? rpc('income_statement', { p_from: range.from, p_to: range.to }) : Promise.resolve(null)), [range.from, range.to]);

  return (
    <>
      <FilterBar>
        <DateRange from={range.from} to={range.to} onChange={setRange} />
      </FilterBar>
      <AsyncView state={state}>
        {(r) =>
          r && (
            <>
              <div className="flex gap-2 justify-end mb-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    downloadCsv(`income-statement-${range.from}-${range.to}.csv`, [
                      ...r.income.map((x) => ({ section: 'income', ...x })),
                      ...r.expenses.map((x) => ({ section: 'expense', ...x })),
                      { section: 'total_income', code: '', name: 'Total income', amount: r.total_income },
                      { section: 'total_expenses', code: '', name: 'Total expenses', amount: r.total_expenses },
                      { section: 'net_surplus', code: '', name: 'Net surplus', amount: r.net_surplus },
                    ])
                  }
                >
                  CSV
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    printDocument({
                      title: 'Income Statement',
                      org,
                      body: `<p class="muted">${date2(range.from)} – ${date2(range.to)}</p>
                        <h2>Income</h2>${printTable(printCols, printRows(r.income), ['', 'Total income', money(r.total_income)])}
                        <h2>Expenses</h2>${printTable(printCols, printRows(r.expenses), ['', 'Total expenses', money(r.total_expenses)])}
                        <p class="big">Net ${num(r.net_surplus) >= 0 ? 'surplus' : 'deficit'}: ${money(r.net_surplus)}</p>`,
                    })
                  }
                >
                  {t('Print', 'طباعة')}
                </Button>
              </div>
              <Section title={t('Income', 'الإيرادات')} rows={r.income} total={r.total_income} totalLabel={t('Total income', 'إجمالي الإيرادات')} />
              <Section title={t('Expenses', 'المصروفات')} rows={r.expenses} total={r.total_expenses} totalLabel={t('Total expenses', 'إجمالي المصروفات')} />
              <div className={`rounded-xl px-4 py-3 font-bold flex justify-between ${num(r.net_surplus) >= 0 ? 'bg-emerald-950/50 text-emerald-200' : 'bg-red-950/50 text-red-200'}`}>
                <span>{num(r.net_surplus) >= 0 ? t('Net surplus', 'صافي الفائض') : t('Net deficit', 'صافي العجز')}</span>
                <span className="tabular-nums">{formatMoney(r.net_surplus)}</span>
              </div>
            </>
          )
        }
      </AsyncView>
    </>
  );
}

const date2 = (v) => esc(formatDate(v));

function BalanceSheet({ org }) {
  const { t } = useLang();
  const [asOf, setAsOf] = useState(today());
  const [state] = useAsync(() => rpc('balance_sheet', { p_as_of: asOf || today() }), [asOf]);

  return (
    <>
      <FilterBar>
        <Field label={t('As of', 'حتى تاريخ')}>
          <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </Field>
      </FilterBar>
      <AsyncView state={state}>
        {(r) => {
          const liabEq = num(r.total_liabilities) + num(r.total_equity) + num(r.accumulated_surplus);
          return (
            <>
              <div className="flex flex-wrap gap-2 justify-between items-center mb-3">
                <Badge tone={r.balanced ? 'green' : 'red'}>{r.balanced ? t('Balanced', 'متوازنة') : t('Out of balance', 'غير متوازنة')}</Badge>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      downloadCsv(`balance-sheet-${asOf}.csv`, [
                        ...r.assets.map((x) => ({ section: 'asset', ...x })),
                        ...r.liabilities.map((x) => ({ section: 'liability', ...x })),
                        ...r.equity.map((x) => ({ section: 'equity', ...x })),
                        { section: 'equity', code: '', name: 'Accumulated surplus', amount: r.accumulated_surplus },
                        { section: 'total_assets', code: '', name: 'Total assets', amount: r.total_assets },
                        { section: 'total_liabilities_equity', code: '', name: 'Total liabilities & equity', amount: liabEq },
                      ])
                    }
                  >
                    CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      printDocument({
                        title: 'Balance Sheet',
                        org,
                        body: `<p class="muted">As of ${date2(asOf)}</p>
                          <h2>Assets</h2>${printTable(printCols, printRows(r.assets), ['', 'Total assets', money(r.total_assets)])}
                          <h2>Liabilities</h2>${printTable(printCols, printRows(r.liabilities), ['', 'Total liabilities', money(r.total_liabilities)])}
                          <h2>Equity</h2>${printTable(
                            printCols,
                            [...printRows(r.equity), ['', 'Accumulated surplus (income − expenses)', money(r.accumulated_surplus)]],
                            ['', 'Total equity', money(num(r.total_equity) + num(r.accumulated_surplus))],
                          )}
                          <p class="big">Total liabilities &amp; equity: ${money(liabEq)}</p>`,
                      })
                    }
                  >
                    {t('Print', 'طباعة')}
                  </Button>
                </div>
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                <Section title={t('Assets', 'الأصول')} rows={r.assets} total={r.total_assets} totalLabel={t('Total assets', 'إجمالي الأصول')} />
                <div>
                  <Section title={t('Liabilities', 'الخصوم')} rows={r.liabilities} total={r.total_liabilities} totalLabel={t('Total liabilities', 'إجمالي الخصوم')} />
                  <Section
                    title={t('Equity', 'حقوق الملكية')}
                    rows={[...r.equity, { code: '—', name: t('Accumulated surplus', 'الفائض المتراكم'), amount: r.accumulated_surplus }]}
                    total={num(r.total_equity) + num(r.accumulated_surplus)}
                    totalLabel={t('Total equity', 'إجمالي حقوق الملكية')}
                  />
                  <div className="rounded-xl px-4 py-3 font-bold flex justify-between bg-gray-900 text-white">
                    <span>{t('Liabilities + equity', 'الخصوم + حقوق الملكية')}</span>
                    <span className="tabular-nums">{formatMoney(liabEq)}</span>
                  </div>
                </div>
              </div>
            </>
          );
        }}
      </AsyncView>
    </>
  );
}

export default function AcctReports() {
  const { t } = useLang();
  const { user } = useAuth();
  const org = useOrg(user?.orgId);
  const [tab, setTab] = useState('tb');
  return (
    <Card title={t('Financial reports', 'التقارير المالية')}>
      <Tabs
        tabs={[
          { id: 'tb', label: t('Trial balance', 'ميزان المراجعة') },
          { id: 'is', label: t('Income statement', 'قائمة الدخل') },
          { id: 'bs', label: t('Balance sheet', 'الميزانية العمومية') },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'tb' && <TrialBalance org={org} />}
      {tab === 'is' && <IncomeStatement org={org} />}
      {tab === 'bs' && <BalanceSheet org={org} />}
    </Card>
  );
}
