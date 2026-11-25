import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';
import { ROLE_BADGE } from '../../lib/roleTheme';

const ErpDashboard = lazy(() => import('../../components/erp/campus/ErpDashboard'));
const FinanceTodayPanel = lazy(() => import('../../components/erp/ops/FinanceTodayPanel'));
const FeeManagement = lazy(() => import('../../components/erp/finance/FeeManagement'));
const AccountingPanel = lazy(() => import('../../components/erp/finance/AccountingPanel'));
const ChequesPanel = lazy(() => import('../../components/erp/finance/ChequesPanel'));
const DonationsPanel = lazy(() => import('../../components/erp/finance/DonationsPanel'));
const ExpensesPanel = lazy(() => import('../../components/erp/finance/ExpensesPanel'));
const FinanceHubPanel = lazy(() => import('../../components/erp/finance/FinanceHubPanel'));
const BankReconPanel = lazy(() => import('../../components/erp/finance/BankReconPanel'));
const ReportsPanel = lazy(() => import('../../components/erp/ops/ReportsPanel'));
const AnalyticsPanel = lazy(() => import('../../components/erp/ops/AnalyticsPanel'));
const AuditLogPanel = lazy(() => import('../../components/erp/finance/AuditLogPanel'));

export default function AccountantPortal() {
  const tabs = [
    { id: 'today', label_en: 'Today & Reminders', label_ar: 'اليوم والتذكيرات', icon: 'today', group: 'Daily Desk', group_ar: 'المكتب اليومي', embed: FinanceTodayPanel },
    { id: 'overview', label_en: 'Finance Overview', label_ar: 'نظرة مالية عامة', icon: 'dashboard', group: 'Daily Desk', group_ar: 'المكتب اليومي', embed: ErpDashboard },
    { id: 'fees', label_en: 'Student Fees & Receipts', label_ar: 'رسوم الطلاب والإيصالات', icon: 'payments', group: 'Fees & Billing', group_ar: 'الرسوم والفوترة', embed: FeeManagement, embedProps: { embedded: true } },
    { id: 'financehub', label_en: 'Invoices, Quotes & Hub', label_ar: 'الفواتير وعروض الأسعار', icon: 'hub', group: 'Fees & Billing', group_ar: 'الرسوم والفوترة', embed: FinanceHubPanel },
    { id: 'bankrecon', label_en: 'Bank Reconciliation', label_ar: 'المطابقة البنكية', icon: 'account_balance', group: 'Fees & Billing', group_ar: 'الرسوم والفوترة', embed: BankReconPanel },
    { id: 'accounting', label_en: 'Accounting & Ledger', label_ar: 'المحاسبة ودفتر الأستاذ', icon: 'menu_book', group: 'Treasury & Ledger', group_ar: 'الخزينة والمحاسبة', embed: AccountingPanel },
    { id: 'cheques', label_en: 'Cheques Register', label_ar: 'سجل الشيكات', icon: 'receipt_long', group: 'Treasury & Ledger', group_ar: 'الخزينة والمحاسبة', embed: ChequesPanel },
    { id: 'donations', label_en: 'Donations & Sadaqah', label_ar: 'التبرعات والصدقات', icon: 'volunteer_activism', group: 'Treasury & Ledger', group_ar: 'الخزينة والمحاسبة', embed: DonationsPanel },
    { id: 'expenses', label_en: 'Expenses & Vouchers', label_ar: 'المصروفات والسندات', icon: 'money_off', group: 'Treasury & Ledger', group_ar: 'الخزينة والمحاسبة', embed: ExpensesPanel },
    { id: 'reports', label_en: 'Finance Reports', label_ar: 'التقارير المالية', icon: 'summarize', group: 'Reports & Audit', group_ar: 'التقارير والتدقيق', embed: ReportsPanel },
    { id: 'analytics', label_en: 'Finance Analytics', label_ar: 'التحليلات المالية', icon: 'analytics', group: 'Reports & Audit', group_ar: 'التقارير والتدقيق', embed: AnalyticsPanel },
    { id: 'audit', label_en: 'Audit Log', label_ar: 'سجل التدقيق', icon: 'policy', group: 'Reports & Audit', group_ar: 'التقارير والتدقيق', embed: AuditLogPanel },
  ];

  return (
    <RolePortalShell
      title_en="Accountant Portal"
      title_ar="بوابة المحاسب"
      roleBadge={{
        text_en: 'Accountant',
        text_ar: 'محاسب',
        color: ROLE_BADGE.brass,
      }}
      tabs={tabs}
      defaultTab="today"
      bannerProps={{
        portal_en: 'Accounting desk',
        portal_ar: 'مكتب المحاسبة',
        hint_en: 'Journals, fees, cheques, donations and audit — open a tab to work.',
        hint_ar: 'اليومية والرسوم والشيكات والتبرعات والتدقيق — اختر تبويباً للعمل.',
        accent: 'emerald',
      }}
    />
  );
}
