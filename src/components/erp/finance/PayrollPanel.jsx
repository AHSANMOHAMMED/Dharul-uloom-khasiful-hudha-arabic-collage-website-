import { PageHeader, Tabs, useLang } from '../ui';
import PaySalaryProfiles from './PaySalaryProfiles';
import PayRuns from './PayRuns';
import PayAdvances from './PayAdvances';
import PayPayslips from './PayPayslips';
import ApitTaxPanel from './ApitTaxPanel';
import { useUrlState } from '../../../lib/useTabParam';

export default function PayrollPanel() {
  const { t } = useLang();
  // In the URL (?pay=) so Back/Forward and links reach this tab.
  const [tab, setTab] = useUrlState('pay', 'runs');
  const tabs = [
    { id: 'runs', label: t('Payroll runs', 'مسيرات الرواتب') },
    { id: 'profiles', label: t('Salary profiles', 'ملفات الرواتب') },
    { id: 'advances', label: t('Advances', 'السلف') },
    { id: 'payslips', label: t('Payslips', 'القسائم') },
    { id: 'apit', label: t('APIT tables', 'جداول ضريبة الدخل') },
  ];
  return (
    <div>
      <PageHeader
        title={t('Payroll', 'الرواتب')}
        subtitle={t('Salary profiles, monthly payroll with EPF/ETF/APIT, approvals, payments and advances.', 'ملفات الرواتب والرواتب الشهرية مع صندوق الادخار والثقة وضريبة الدخل والاعتماد والدفع والسلف.')}
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'runs' && <PayRuns />}
      {tab === 'profiles' && <PaySalaryProfiles />}
      {tab === 'advances' && <PayAdvances />}
      {tab === 'payslips' && <PayPayslips />}
      {tab === 'apit' && <ApitTaxPanel />}
    </div>
  );
}
