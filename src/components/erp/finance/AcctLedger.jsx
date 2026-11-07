import { useState } from 'react';
import { AsyncView, Button, Card, EmptyState, Field, Select, Stat, Table, useAsync, useLang } from '../ui';
import { rpc, formatMoney, formatDate, downloadCsv } from '../../../lib/erp/rpc';
import { accountLabel, listAccounts, num } from '../../../lib/erp/financeApi';
import { DateRange, FilterBar, Num } from './shared';

export default function AcctLedger() {
  const { t, ar } = useLang();
  const [accountId, setAccountId] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [accounts] = useAsync(() => listAccounts(), []);
  const [state, reload] = useAsync(
    () => (accountId ? rpc('account_ledger', { p_account: accountId, p_from: range.from || null, p_to: range.to || null }) : Promise.resolve(null)),
    [accountId, range.from, range.to],
  );
  const account = (accounts.data || []).find((a) => a.id === accountId);

  return (
    <Card
      title={t('Account ledger', 'دفتر حساب')}
      actions={
        <>
          <Button
            size="sm"
            variant="secondary"
            disabled={!state.data?.length}
            onClick={() => downloadCsv(`ledger-${account?.code || 'account'}.csv`, state.data)}
          >
            CSV
          </Button>
          <Button size="sm" variant="secondary" onClick={reload} disabled={!accountId}>
            {t('Refresh', 'تحديث')}
          </Button>
        </>
      }
    >
      <FilterBar>
        <Field label={t('Account', 'الحساب')}>
          <Select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder={accounts.loading ? t('Loading…', 'جارٍ التحميل…') : t('Select account…', 'اختر حسابًا…')}
            options={(accounts.data || []).map((a) => ({ value: a.id, label: accountLabel(a, ar) }))}
          />
        </Field>
        <DateRange from={range.from} to={range.to} onChange={setRange} />
      </FilterBar>
      {range.from && (
        <p className="text-xs text-amber-300 mb-3">
          {t('Running balance starts from zero at the “From” date (opening balance is not carried in).', 'يبدأ الرصيد الجاري من الصفر عند تاريخ "من" (دون رصيد افتتاحي).')}
        </p>
      )}
      {!accountId ? (
        <EmptyState text={t('Choose an account to view its ledger', 'اختر حسابًا لعرض دفتره')} />
      ) : (
        <AsyncView state={state}>
          {(rows) => {
            const dr = (rows || []).reduce((s, r) => s + num(r.debit), 0);
            const cr = (rows || []).reduce((s, r) => s + num(r.credit), 0);
            const closing = rows?.length ? rows[rows.length - 1].running_balance : 0;
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Stat label={t('Debits', 'المدين')} value={formatMoney(dr)} tone="blue" />
                  <Stat label={t('Credits', 'الدائن')} value={formatMoney(cr)} tone="amber" />
                  <Stat label={t('Closing balance', 'الرصيد الختامي')} value={formatMoney(closing)} />
                </div>
                <Table
                  rowKey="_k"
                  rows={(rows || []).map((r, i) => ({ ...r, _k: `${r.entry_id}-${i}` }))}
                  empty={t('No postings', 'لا توجد قيود')}
                  columns={[
                    { key: 'entry_date', label: t('Date', 'التاريخ'), render: (r) => formatDate(r.entry_date) },
                    { key: 'entry_no', label: t('Entry', 'القيد'), render: (r) => <span className="font-mono text-xs">{r.entry_no}</span> },
                    {
                      key: 'description',
                      label: t('Description', 'الوصف'),
                      render: (r) => (
                        <div>
                          <div>{r.description}</div>
                          {r.memo && <div className="text-xs text-gray-500">{r.memo}</div>}
                        </div>
                      ),
                    },
                    { key: 'debit', label: t('Debit', 'مدين'), render: (r) => <Num>{num(r.debit) ? formatMoney(r.debit) : ''}</Num> },
                    { key: 'credit', label: t('Credit', 'دائن'), render: (r) => <Num>{num(r.credit) ? formatMoney(r.credit) : ''}</Num> },
                    { key: 'running_balance', label: t('Balance', 'الرصيد'), render: (r) => <Num className="font-semibold">{formatMoney(r.running_balance)}</Num> },
                  ]}
                />
              </div>
            );
          }}
        </AsyncView>
      )}
    </Card>
  );
}
