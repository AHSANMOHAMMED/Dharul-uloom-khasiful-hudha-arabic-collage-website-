import { useState } from 'react';
import { AsyncView, Badge, Button, Card, Field, Input, Select, Stat, Table, useAsync, useLang } from '../ui';
import { rpc, formatMoney, formatDate, today, downloadCsv } from '../../../lib/erp/rpc';
import { CLASS_OPTIONS, num } from '../../../lib/erp/financeApi';
import { FilterBar, Num } from './shared';

export default function FeeOutstanding() {
  const { t } = useLang();
  const [cls, setCls] = useState('');
  const [asOf, setAsOf] = useState(today());
  const [state, reload] = useAsync(
    () => rpc('fee_outstanding', { p_class: cls ? Number(cls) : null, p_as_of: asOf || today() }),
    [cls, asOf],
  );

  return (
    <Card
      title={t('Outstanding balances', 'الأرصدة المستحقة')}
      actions={
        <>
          <Button
            size="sm"
            variant="secondary"
            disabled={!state.data?.length}
            onClick={() => downloadCsv(`fee-outstanding-${cls || 'all'}-${asOf}.csv`, state.data)}
          >
            {t('Export CSV', 'تصدير CSV')}
          </Button>
          <Button size="sm" variant="secondary" onClick={reload}>
            {t('Refresh', 'تحديث')}
          </Button>
        </>
      }
    >
      <FilterBar>
        <Field label={t('Class', 'الصف')}>
          <Select value={cls} onChange={(e) => setCls(e.target.value)} placeholder={t('All classes', 'كل الصفوف')} options={CLASS_OPTIONS} />
        </Field>
        <Field label={t('As of', 'حتى تاريخ')}>
          <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </Field>
      </FilterBar>
      <AsyncView state={state}>
        {(rows) => {
          const total = (rows || []).reduce((s, r) => s + num(r.balance), 0);
          const overdue = (rows || []).filter((r) => r.days_overdue > 0);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Stat label={t('Students with balance', 'طلاب عليهم رصيد')} value={rows?.length || 0} tone="blue" />
                <Stat label={t('Total outstanding', 'إجمالي المستحق')} value={formatMoney(total)} tone="amber" />
                <Stat label={t('Overdue students', 'طلاب متأخرون')} value={overdue.length} tone="red" />
              </div>
              <Table
                rowKey="student_id"
                rows={rows}
                empty={t('No outstanding balances — Account settled', 'لا توجد أرصدة مستحقة — الحسابات مكتملة')}
                columns={[
                  {
                    key: 'full_name',
                    label: t('Student', 'الطالب'),
                    render: (r) => (
                      <div>
                        <div>{r.full_name}</div>
                        <div className="text-xs text-gray-500">{r.index_number || ''}</div>
                      </div>
                    ),
                  },
                  { key: 'class_number', label: t('Class', 'الصف') },
                  { key: 'open_invoices', label: t('Open invoices', 'فواتير مفتوحة') },
                  { key: 'total_due', label: t('Total due', 'الإجمالي'), render: (r) => <Num>{formatMoney(r.total_due)}</Num> },
                  { key: 'paid', label: t('Paid', 'المدفوع'), render: (r) => <Num>{formatMoney(r.paid)}</Num> },
                  { key: 'balance', label: t('Balance', 'الرصيد'), render: (r) => <Num className="text-amber-300 font-semibold">{formatMoney(r.balance)}</Num> },
                  { key: 'oldest_due_date', label: t('Oldest due', 'أقدم استحقاق'), render: (r) => formatDate(r.oldest_due_date) },
                  {
                    key: 'days_overdue',
                    label: t('Overdue', 'التأخير'),
                    render: (r) =>
                      r.days_overdue > 0 ? (
                        <Badge tone={r.days_overdue > 60 ? 'red' : 'amber'}>
                          {r.days_overdue} {t('days', 'يوم')}
                        </Badge>
                      ) : (
                        '—'
                      ),
                  },
                ]}
              />
            </div>
          );
        }}
      </AsyncView>
    </Card>
  );
}
