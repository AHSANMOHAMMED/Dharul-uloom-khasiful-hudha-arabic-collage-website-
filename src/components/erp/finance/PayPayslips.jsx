import { useMemo, useState } from 'react';
import { AsyncView, Button, Card, Field, Input, StatusBadge, Table, useAsync, useLang } from '../ui';
import { useAuth } from '../../../context/AuthContext';
import { query, currentMonth, formatMoney } from '../../../lib/erp/rpc';
import { useOrg } from '../../../lib/erp/financeApi';
import { FilterBar, Num } from './shared';
import { printPayslip, printPayslips } from './payslipPrint';

/** Payslip lookup + printable payslip view (earnings, deductions, employer EPF/ETF, net). */
export default function PayPayslips() {
  const { t } = useLang();
  const { user } = useAuth();
  const org = useOrg(user?.orgId);
  const [period, setPeriod] = useState(currentMonth());
  const [search, setSearch] = useState('');
  const [state] = useAsync(
    () =>
      query('payslips', (q) => {
        const b = q.select('*').neq('status', 'cancelled').order('period', { ascending: false }).order('staff_name').limit(500);
        return period ? b.eq('period', period) : b;
      }),
    [period],
  );
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (state.data || []).filter((p) => !s || (p.staff_name || '').toLowerCase().includes(s) || (p.employee_no || '').toLowerCase().includes(s));
  }, [state.data, search]);

  return (
    <Card
      title={t('Payslips', 'قسائم الرواتب')}
      actions={
        <Button size="sm" variant="secondary" disabled={!rows.length} onClick={() => printPayslips(org, rows)}>
          {t('Print all', 'طباعة الكل')}
        </Button>
      }
    >
      <FilterBar>
        <Field label={t('Period', 'الفترة')}>
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </Field>
        <Field label={t('Search', 'بحث')}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Name or employee no.', 'الاسم أو رقم الموظف')} />
        </Field>
      </FilterBar>
      <AsyncView state={state}>
        {() => (
          <Table
            rows={rows}
            empty={t('No payslips for this period', 'لا توجد قسائم لهذه الفترة')}
            columns={[
              {
                key: 'staff_name',
                label: t('Employee', 'الموظف'),
                render: (p) => (
                  <div>
                    <div>{p.staff_name}</div>
                    <div className="text-xs text-gray-500">{p.employee_no || ''}</div>
                  </div>
                ),
              },
              { key: 'period', label: t('Period', 'الفترة') },
              { key: 'gross', label: t('Gross', 'الإجمالي'), render: (p) => <Num>{formatMoney(p.gross)}</Num> },
              { key: 'total_deductions', label: t('Deductions', 'الاستقطاع'), render: (p) => <Num>{formatMoney(p.total_deductions)}</Num> },
              { key: 'employer_total', label: t('Employer EPF/ETF', 'مساهمة صاحب العمل'), render: (p) => <Num>{formatMoney(p.employer_total)}</Num> },
              { key: 'net', label: t('Net', 'الصافي'), render: (p) => <Num className="font-semibold">{formatMoney(p.net)}</Num> },
              { key: 'status', label: t('Status', 'الحالة'), render: (p) => <StatusBadge status={p.status} /> },
              {
                key: 'print',
                label: '',
                render: (p) => (
                  <Button size="sm" variant="ghost" onClick={() => printPayslip(org, p)}>
                    {t('Print', 'طباعة')}
                  </Button>
                ),
              },
            ]}
          />
        )}
      </AsyncView>
    </Card>
  );
}
