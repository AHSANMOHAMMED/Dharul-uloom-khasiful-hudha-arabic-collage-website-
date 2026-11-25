import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';
import { useAuth } from '../../context/AuthContext';
import { ROLE_BADGE } from '../../lib/roleTheme';

const ErpDashboard = lazy(() => import('../../components/erp/campus/ErpDashboard'));
const StaffHrPanel = lazy(() => import('../../components/erp/campus/StaffHrPanel'));
const PayrollPanel = lazy(() => import('../../components/erp/finance/PayrollPanel'));
const MySelfServicePanel = lazy(() => import('../../components/erp/campus/MySelfServicePanel'));
const SelfLeave = lazy(() => import('../../components/erp/campus/SelfLeave'));
const AnalyticsPanel = lazy(() => import('../../components/erp/ops/AnalyticsPanel'));
const ReportsPanel = lazy(() => import('../../components/erp/ops/ReportsPanel'));

function SelfLeaveWrap() {
  const { user } = useAuth();
  return <SelfLeave user={user} />;
}

export default function HrPortal() {
  const tabs = [
    { id: 'overview', label_en: 'Overview', label_ar: 'نظرة عامة', icon: 'dashboard', group: 'HR Desk', group_ar: 'الموارد البشرية', embed: ErpDashboard },
    { id: 'staff', label_en: 'Staff HR', label_ar: 'الموظفون', icon: 'badge', group: 'HR Desk', group_ar: 'الموارد البشرية', embed: StaffHrPanel },
    { id: 'leave', label_en: 'Leave', label_ar: 'الإجازات', icon: 'event_busy', group: 'HR Desk', group_ar: 'الموارد البشرية', embed: SelfLeaveWrap },
    { id: 'payroll', label_en: 'Payroll', label_ar: 'الرواتب', icon: 'payments', group: 'HR Desk', group_ar: 'الموارد البشرية', embed: PayrollPanel },
    { id: 'analytics', label_en: 'Analytics', label_ar: 'التحليلات', icon: 'analytics', group: 'Insights', group_ar: 'التقارير', embed: AnalyticsPanel },
    { id: 'reports', label_en: 'Reports', label_ar: 'التقارير', icon: 'summarize', group: 'Insights', group_ar: 'التقارير', embed: ReportsPanel },
    { id: 'self', label_en: 'Self-service', label_ar: 'خدماتي', icon: 'person', group: 'Workspace', group_ar: 'المساحة', embed: MySelfServicePanel },
  ];

  return (
    <RolePortalShell
      title_en="HR Portal"
      title_ar="بوابة الموارد البشرية"
      roleBadge={{
        text_en: 'HR Manager',
        text_ar: 'مدير الموارد البشرية',
        color: ROLE_BADGE.emerald,
      }}
      tabs={tabs}
      defaultTab="staff"
      bannerProps={{
        portal_en: 'Human Resources',
        portal_ar: 'الموارد البشرية',
        hint_en: 'Overview, staff records, leave requests, payroll runs and analytics.',
        hint_ar: 'نظرة عامة وسجلات الموظفين وطلبات الإجازة وتشغيل الرواتب والتحليلات.',
        accent: 'emerald',
      }}
    />
  );
}
