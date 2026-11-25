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
const PayrollPanel = lazy(() => import('../../components/erp/finance/PayrollPanel'));
const PettyCashPanel = lazy(() => import('../../components/erp/governance/PettyCashPanel'));
const ReportsPanel = lazy(() => import('../../components/erp/ops/ReportsPanel'));
const AnalyticsPanel = lazy(() => import('../../components/erp/ops/AnalyticsPanel'));
const AuditLogPanel = lazy(() => import('../../components/erp/finance/AuditLogPanel'));

export default function TreasurerPortal() {
  const tabs = [
    { id: 'today', label_en: 'Today', label_ar: 'اليوم', icon: 'today', group: 'Treasury', group_ar: 'الخزينة', embed: FinanceTodayPanel },
    { id: 'overview', label_en: 'Finance Overview', label_ar: 'نظرة مالية عامة', icon: 'dashboard', group: 'Treasury', group_ar: 'الخزينة', embed: ErpDashboard },
    { id: 'fees', label_en: 'Fees', label_ar: 'الرسوم', icon: 'payments', group: 'Treasury', group_ar: 'الخزينة', embed: FeeManagement, embedProps: { embedded: true } },
    { id: 'financehub', label_en: 'Finance Hub', label_ar: 'مركز المالية', icon: 'hub', group: 'Treasury', group_ar: 'الخزينة', embed: FinanceHubPanel },
    { id: 'accounting', label_en: 'Accounting', label_ar: 'المحاسبة', icon: 'account_balance', group: 'Ledger & Ops', group_ar: 'السجلات والعمليات', embed: AccountingPanel },
    { id: 'cheques', label_en: 'Cheques', label_ar: 'الشيكات', icon: 'receipt_long', group: 'Ledger & Ops', group_ar: 'السجلات والعمليات', embed: ChequesPanel },
    { id: 'donations', label_en: 'Donations', label_ar: 'التبرعات', icon: 'volunteer_activism', group: 'Ledger & Ops', group_ar: 'السجلات والعمليات', embed: DonationsPanel },
    { id: 'expenses', label_en: 'Expenses', label_ar: 'المصروفات', icon: 'money_off', group: 'Ledger & Ops', group_ar: 'السجلات والعمليات', embed: ExpensesPanel },
    { id: 'payroll', label_en: 'Payroll', label_ar: 'الرواتب', icon: 'payments', group: 'Ledger & Ops', group_ar: 'السجلات والعمليات', embed: PayrollPanel },
    { id: 'pettycash', label_en: 'Petty Cash', label_ar: 'النثرية', icon: 'account_balance_wallet', group: 'Ledger & Ops', group_ar: 'السجلات والعمليات', embed: PettyCashPanel },
    { id: 'reports', label_en: 'Reports', label_ar: 'التقارير', icon: 'summarize', group: 'Insights', group_ar: 'التقارير والتدقيق', embed: ReportsPanel },
    { id: 'analytics', label_en: 'Analytics', label_ar: 'التحليلات', icon: 'analytics', group: 'Insights', group_ar: 'التقارير والتدقيق', embed: AnalyticsPanel },
    { id: 'audit', label_en: 'Audit', label_ar: 'التدقيق', icon: 'policy', group: 'Insights', group_ar: 'التقارير والتدقيق', embed: AuditLogPanel },
  ];

  return (
    <RolePortalShell
      title_en="Treasurer Portal"
      title_ar="بوابة أمين الصندوق"
      roleBadge={{
        text_en: 'Treasurer',
        text_ar: 'أمين الصندوق',
        color: ROLE_BADGE.brass,
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
