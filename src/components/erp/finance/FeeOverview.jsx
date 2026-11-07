import { useState } from 'react';
import { AsyncView, Button, Card, Stat, Table, useAsync, useLang } from '../ui';
import { rpc, formatMoney, formatDate, today, downloadCsv } from '../../../lib/erp/rpc';
import { PAYMENT_METHODS, firstOfMonth, labelOf, num } from '../../../lib/erp/financeApi';
import { DateRange, FilterBar, Num } from './shared';

export default function FeeOverview() {
  const { t } = useLang();
  const [range, setRange] = useState({ from: firstOfMonth(), to: today() });
  const [state, reload] = useAsync(
    () => (range.from && range.to ? rpc('fee_collection_report', { p_from: range.from, p_to: range.to }) : Promise.resolve(null)),
    [range.from, range.to],
  );

  return (
    <div className="space-y-5">
      <Card
        title={t('Collection report', 'تقرير التحصيل')}
        actions={
          <Button variant="secondary" size="sm" onClick={reload}>
            {t('Refresh', 'تحديث')}
          </Button>
        }
      >
        <FilterBar>
          <DateRange from={range.from} to={range.to} onChange={setRange} />
        </FilterBar>
        <AsyncView state={state}>
          {(r) => {
            if (!r) return null;
            const methods = Object.entries(r.by_method || {}).map(([method, total]) => ({ method, total }));
            const days = r.by_day || [];
            const max = Math.max(1, ...days.map((d) => num(d.amount)));
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Stat label={t('Collected', 'المحصَّل')} value={formatMoney(r.total_collected)} hint={t('In selected range', 'في الفترة المحددة')} />
                  <Stat label={t('Invoiced', 'المفوتر')} value={formatMoney(r.total_invoiced)} tone="blue" hint={t('Charges raised in range', 'الرسوم المصدرة في الفترة')} />
                  <Stat label={t('Outstanding', 'المستحق')} value={formatMoney(r.outstanding)} tone="amber" hint={t('All open invoices', 'كل الفواتير المفتوحة')} />
                  <Stat label={t('Overdue', 'المتأخر')} value={formatMoney(r.overdue)} tone="red" hint={t('Past due date', 'تجاوز تاريخ الاستحقاق')} />
                </div>
                <div className="grid lg:grid-cols-2 gap-5">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">{t('By payment method', 'حسب طريقة الدفع')}</h4>
                    <Table
                      rowKey="method"
                      rows={methods}
                      empty={t('No collections in this range', 'لا يوجد تحصيل في هذه الفترة')}
                      columns={[
                        { key: 'method', label: t('Method', 'الطريقة'), render: (m) => labelOf(PAYMENT_METHODS, m.method, t) },
                        { key: 'total', label: t('Amount', 'المبلغ'), render: (m) => <Num>{formatMoney(m.total)}</Num> },
                      ]}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-300">{t('Daily collections', 'التحصيل اليومي')}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!days.length}
                        onClick={() => downloadCsv(`fee-collections-${range.from}-${range.to}.csv`, days)}
                      >
                        {t('CSV', 'CSV')}
                      </Button>
                    </div>
                    {days.length ? (
                      <div className="space-y-1.5 max-h-72 overflow-y-auto pe-1">
                        {days.map((d) => (
                          <div key={d.date} className="flex items-center gap-3 text-xs">
                            <span className="w-24 shrink-0 text-gray-400">{formatDate(d.date)}</span>
                            <div className="flex-1 bg-gray-900 rounded-full h-3 overflow-hidden">
                              <div className="bg-emerald-600 h-3 rounded-full" style={{ width: `${(num(d.amount) / max) * 100}%` }} />
                            </div>
                            <span className="w-32 shrink-0 text-end text-gray-200 tabular-nums">{formatMoney(d.amount)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 py-6 text-center">{t('No collections in this range', 'لا يوجد تحصيل في هذه الفترة')}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          }}
        </AsyncView>
      </Card>
    </div>
  );
}
