import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';

const FinanceTodayPanel = lazy(() => import('../../components/erp/ops/FinanceTodayPanel'));
const FeeManagement = lazy(() => import('../../components/erp/finance/FeeManagement'));
const AccountingPanel = lazy(() => import('../../components/erp/finance/AccountingPanel'));
const ChequesPanel = lazy(() => import('../../components/erp/finance/ChequesPanel'));
const DonationsPanel = lazy(() => import('../../components/erp/finance/DonationsPanel'));
const ExpensesPanel = lazy(() => import('../../components/erp/finance/ExpensesPanel'));
const PayrollPanel = lazy(() => import('../../components/erp/finance/PayrollPanel'));
const AuditLogPanel = lazy(() => import('../../components/erp/finance/AuditLogPanel'));

export default function TreasurerPortal() {
  const tabs = [
    { id: 'today', label_en: 'Today', label_ar: 'اليوم', icon: 'today', embed: FinanceTodayPanel },
    { id: 'fees', label_en: 'Fees', label_ar: 'الرسوم', icon: 'payments', embed: FeeManagement, embedProps: { embedded: true } },
    { id: 'accounting', label_en: 'Accounting', label_ar: 'المحاسبة', icon: 'account_balance', embed: AccountingPanel },
    { id: 'cheques', label_en: 'Cheques', label_ar: 'الشيكات', icon: 'receipt_long', embed: ChequesPanel },
    { id: 'donations', label_en: 'Donations', label_ar: 'التبرعات', icon: 'volunteer_activism', embed: DonationsPanel },
    { id: 'expenses', label_en: 'Expenses', label_ar: 'المصروفات', icon: 'money_off', embed: ExpensesPanel },
    { id: 'payroll', label_en: 'Payroll', label_ar: 'الرواتب', icon: 'payments', embed: PayrollPanel },
    { id: 'audit', label_en: 'Audit', label_ar: 'التدقيق', icon: 'policy', embed: AuditLogPanel },
  ];

  return (
    <RolePortalShell
      title_en="Treasurer Portal"
      title_ar="بوابة أمين الصندوق"
      roleBadge={{
        text_en: 'Treasurer',
        text_ar: 'أمين الصندوق',
        color: 'bg-[#FEF9EE] text-[#C29A3A] border-[#C29A3A]/30',
      }}
      tabs={tabs}
      defaultTab="today"
      bannerProps={{
        portal_en: 'Treasury',
        portal_ar: 'الخزينة',
        hint_en: 'Collect fees, post journals, and review cash movement from one desk.',
        hint_ar: 'تحصيل الرسوم وترحيل القيود ومتابعة الحركة النقدية من مكتب واحد.',
        accent: 'gold',
      }}
    />
  );
}
