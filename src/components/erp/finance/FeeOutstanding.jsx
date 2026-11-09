import { useState } from 'react';
import { toast } from 'react-toastify';
import { AsyncView, Badge, Button, Card, Field, Input, Select, Stat, Table, useAsync, useLang } from '../ui';
import { rpc, formatMoney, formatDate, today, downloadCsv } from '../../../lib/erp/rpc';
import { printTable } from '../../../lib/printReport';
import { CLASS_OPTIONS, num } from '../../../lib/erp/financeApi';
import { FilterBar, Num } from './shared';

export default function FeeOutstanding() {
  const { t, lang } = useLang();
  const [cls, setCls] = useState('');
  const [asOf, setAsOf] = useState(today());
  const [state, reload] = useAsync(
    () => rpc('fee_outstanding', { p_class: cls ? Number(cls) : null, p_as_of: asOf || today() }),
    [cls, asOf],
  );

  const printRows = (rows) =>
    (rows || []).map((r) => ({
      full_name: `${r.full_name}${r.index_number ? ` (${r.index_number})` : ''}`,
      class_number: r.class_number,
      open_invoices: r.open_invoices,
      total_due: r.total_due,
      paid: r.paid,
      balance: r.balance,
      oldest_due_date: r.oldest_due_date,
      days_overdue: r.days_overdue > 0 ? r.days_overdue : '',
    }));

  const printColumns = [
    { key: 'full_name', label: t('Student', 'الطالب') },
    { key: 'class_number', label: t('Class', 'الصف') },
    { key: 'open_invoices', label: t('Open invoices', 'فواتير مفتوحة'), type: 'number' },
    { key: 'total_due', label: t('Total due', 'الإجمالي'), type: 'money' },
    { key: 'paid', label: t('Paid', 'المدفوع'), type: 'money' },
    { key: 'balance', label: t('Balance', 'الرصيد'), type: 'money' },
    { key: 'oldest_due_date', label: t('Oldest due', 'أقدم استحقاق'), type: 'date' },
    { key: 'days_overdue', label: t('Days overdue', 'أيام التأخير'), type: 'number' },
  ];

  const onPrint = () => {
    const rows = state.data || [];
    if (!rows.length) return;
    try {
      const total = rows.reduce((s, r) => s + num(r.balance), 0);
      printTable({
        title: t('Outstanding fee balances', 'أرصدة الرسوم المستحقة'),
        columns: printColumns,
        rows: printRows(rows),
        filters: [
          [t('Class', 'الصف'), cls ? t(`Class ${cls}`, `الصف ${cls}`) : t('All classes', 'كل الصفوف')],
          [t('As of', 'حتى تاريخ'), asOf],
        ],
        totals: { balance: total },
        dir: document.documentElement.dir || 'ltr',
        lang,
      });
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Card
      title={t('Outstanding balances', 'الأرصدة المستحقة')}
      actions={
        <>
          <Button size="sm" variant="secondary" disabled={!state.data?.length} onClick={onPrint}>
            <span className="material-symbols-outlined text-[16px] align-middle me-1">print</span>
            {t('PDF / Print', 'PDF / طباعة')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!state.data?.length}
            onClick={() => downloadCsv(`fee-outstanding-${cls || 'all'}-${asOf}.csv`, state.data)}
          >
            <span className="material-symbols-outlined text-[16px] align-middle me-1">download</span>
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
