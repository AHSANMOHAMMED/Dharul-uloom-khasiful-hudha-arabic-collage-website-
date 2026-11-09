import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';
import { ERP_QUICK_LINK } from '../../lib/portalChrome';
import { tx } from '../../lib/tx';
import { useAuth } from '../../context/AuthContext';

const FinanceTodayPanel = lazy(() => import('../../components/erp/ops/FinanceTodayPanel'));
const FeeManagement = lazy(() => import('../../components/erp/finance/FeeManagement'));
const AccountingPanel = lazy(() => import('../../components/erp/finance/AccountingPanel'));
const ChequesPanel = lazy(() => import('../../components/erp/finance/ChequesPanel'));
const DonationsPanel = lazy(() => import('../../components/erp/finance/DonationsPanel'));
const ExpensesPanel = lazy(() => import('../../components/erp/finance/ExpensesPanel'));
const AuditLogPanel = lazy(() => import('../../components/erp/finance/AuditLogPanel'));

export default function AccountantPortal() {
  const { user } = useAuth();
  const tabs = [
    { id: 'today', label_en: 'Today', label_ar: 'اليوم', icon: 'today', embed: FinanceTodayPanel },
        { id: 'fees', label_en: 'Fees', label_ar: 'الرسوم', icon: 'payments', embed: FeeManagement, embedProps: { embedded: true } },
    { id: 'accounting', label_en: 'Accounting', label_ar: 'المحاسبة', icon: 'account_balance', embed: AccountingPanel },
    { id: 'cheques', label_en: 'Cheques', label_ar: 'الشيكات', icon: 'receipt_long', embed: ChequesPanel },
    { id: 'donations', label_en: 'Donations', label_ar: 'التبرعات', icon: 'volunteer_activism', embed: DonationsPanel },
    { id: 'expenses', label_en: 'Expenses', label_ar: 'المصروفات', icon: 'money_off', embed: ExpensesPanel },
    { id: 'audit', label_en: 'Audit', label_ar: 'التدقيق', icon: 'policy', embed: AuditLogPanel },
  ];

  return (
    <RolePortalShell
      title_en="Accountant Portal"
      title_ar="بوابة المحاسب"
      roleBadge={{
        text_en: 'Accountant',
        text_ar: 'محاسب',
        color: 'bg-[#E3F1EA] text-[#11694A] border-[#11694A]/30',
      }}
      tabs={tabs}
      defaultTab="today"
      quickLinks={[ERP_QUICK_LINK]}
      banner={
        <div className="rounded-[14px] bg-[#0B3B2E] text-white p-5 sm:p-6">
          <p className="text-[11px] uppercase tracking-wider text-[#C29A3A] font-semibold">{tx('المحاسبة', 'Accounting')}</p>
          <h1 className="font-serif text-2xl font-semibold mt-1">
            {tx(`مرحباً، ${user?.username || ''}`, `Welcome, ${user?.username || ''}`)}
          </h1>
          <p className="text-xs text-white/75 mt-1">
            {tx('اليومية، الرسوم، الشيكات، والتدقيق من مكتب المحاسب.', 'Journals, fees, cheques and audit from the accountant desk.')}
          </p>
        </div>
      }
    />
  );
}
