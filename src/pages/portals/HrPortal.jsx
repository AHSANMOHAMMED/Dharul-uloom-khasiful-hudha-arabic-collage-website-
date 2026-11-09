import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';
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
      bannerProps={{
        portal_en: 'Human Resources',
        portal_ar: 'الموارد البشرية',
        hint_en: 'Staff records, leave requests, and payroll runs.',
        hint_ar: 'سجلات الموظفين وطلبات الإجازة وتشغيل الرواتب.',
        accent: 'emerald',
      }}
    />
  );
}
