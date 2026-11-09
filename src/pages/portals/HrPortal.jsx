import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';
import { ERP_QUICK_LINK } from '../../lib/portalChrome';
import { tx } from '../../lib/tx';
import { useAuth } from '../../context/AuthContext';

const StaffHrPanel = lazy(() => import('../../components/erp/campus/StaffHrPanel'));
const PayrollPanel = lazy(() => import('../../components/erp/finance/PayrollPanel'));
const MySelfServicePanel = lazy(() => import('../../components/erp/campus/MySelfServicePanel'));
const SelfLeave = lazy(() => import('../../components/erp/campus/SelfLeave'));

function SelfLeaveWrap() {
  const { user } = useAuth();
  return <SelfLeave user={user} />;
}

export default function HrPortal() {
  const { user } = useAuth();
  const tabs = [
    { id: 'staff', label_en: 'Staff', label_ar: 'الموظفون', icon: 'badge', embed: StaffHrPanel },
    { id: 'leave', label_en: 'Leave', label_ar: 'الإجازات', icon: 'event_busy', embed: SelfLeaveWrap },
    { id: 'payroll', label_en: 'Payroll', label_ar: 'الرواتب', icon: 'payments', embed: PayrollPanel },
    { id: 'self', label_en: 'Self-service', label_ar: 'خدماتي', icon: 'person', embed: MySelfServicePanel },
  ];

  return (
    <RolePortalShell
      title_en="HR Portal"
      title_ar="بوابة الموارد البشرية"
      roleBadge={{
        text_en: 'HR Manager',
        text_ar: 'مدير الموارد البشرية',
        color: 'bg-[#E3F1EA] text-[#0B3B2E] border-[#0B3B2E]/20',
      }}
      tabs={tabs}
      defaultTab="staff"
      quickLinks={[ERP_QUICK_LINK]}
      banner={
        <div className="rounded-[14px] bg-[#0B3B2E] text-white p-5 sm:p-6">
          <p className="text-[11px] uppercase tracking-wider text-[#C29A3A] font-semibold">{tx('الموارد البشرية', 'Human Resources')}</p>
          <h1 className="font-serif text-2xl font-semibold mt-1">
            {tx(`مرحباً، ${user?.username || ''}`, `Welcome, ${user?.username || ''}`)}
          </h1>
          <p className="text-xs text-white/75 mt-1">
            {tx('سجلات الموظفين، الإجازات، والرواتب.', 'Staff records, leave, and payroll.')}
          </p>
        </div>
      }
    />
  );
}
