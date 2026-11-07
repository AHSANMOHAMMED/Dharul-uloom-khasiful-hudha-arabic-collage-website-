import { useState } from 'react';
import { PageHeader, Tabs, useLang } from '../ui';
import PaySalaryProfiles from './PaySalaryProfiles';
import PayRuns from './PayRuns';
import PayAdvances from './PayAdvances';
import PayPayslips from './PayPayslips';

export default function PayrollPanel() {
  const { t } = useLang();
  const [tab, setTab] = useState('runs');
  const tabs = [
    { id: 'runs', label: t('Payroll runs', 'مسيرات الرواتب') },
    { id: 'profiles', label: t('Salary profiles', 'ملفات الرواتب') },
    { id: 'advances', label: t('Advances', 'السلف') },
    { id: 'payslips', label: t('Payslips', 'القسائم') },
  ];
  return (
    <div>
      <PageHeader
        title={t('Payroll', 'الرواتب')}
        subtitle={t('Salary profiles, monthly payroll with EPF/ETF, approvals, payments and advances.', 'ملفات الرواتب والرواتب الشهرية مع صندوق الادخار والثقة والاعتماد والدفع والسلف.')}
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'runs' && <PayRuns />}
      {tab === 'profiles' && <PaySalaryProfiles />}
      {tab === 'advances' && <PayAdvances />}
      {tab === 'payslips' && <PayPayslips />}
    </div>
  );
}
