import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';
import { ROLE_BADGE } from '../../lib/roleTheme';

const ErpDashboard = lazy(() => import('../../components/erp/campus/ErpDashboard'));
const Timetable = lazy(() => import('../../components/erp/campus/Timetable'));
const FeeManagement = lazy(() => import('../../components/erp/finance/FeeManagement'));
const StudentsPanel = lazy(() => import('../../components/erp/campus/StudentsPanel'));
const StaffHrPanel = lazy(() => import('../../components/erp/campus/StaffHrPanel'));
const AcademicsPanel = lazy(() => import('../../components/erp/campus/AcademicsPanel'));
const WelfarePanel = lazy(() => import('../../components/erp/campus/WelfarePanel'));
const HostelPanel = lazy(() => import('../../components/erp/campus/HostelPanel'));
const CertificatesPanel = lazy(() => import('../../components/erp/campus/CertificatesPanel'));
const DutiesPanel = lazy(() => import('../../components/erp/governance/DutiesPanel'));
const ReportsPanel = lazy(() => import('../../components/erp/ops/ReportsPanel'));
const CrmPanel = lazy(() => import('../../components/erp/campus/CrmPanel'));
const ExpensesPanel = lazy(() => import('../../components/erp/finance/ExpensesPanel'));
const DonationsPanel = lazy(() => import('../../components/erp/finance/DonationsPanel'));
const PayrollPanel = lazy(() => import('../../components/erp/finance/PayrollPanel'));

export default function PrincipalPortal({ vpMode = false }) {
  const title_en = vpMode ? 'Vice Principal Portal' : 'Principal Portal';
  const title_ar = vpMode ? 'بوابة نائب المدير' : 'بوابة المدير';

  const tabs = [
    { id: 'overview', label_en: 'Overview', label_ar: 'نظرة عامة', icon: 'dashboard', embed: ErpDashboard },
    { id: 'academics', label_en: 'Academics', label_ar: 'الأكاديميات', icon: 'school', embed: AcademicsPanel },
    { id: 'timetable', label_en: 'Timetable', label_ar: 'الجدول', icon: 'calendar_month', embed: Timetable },
    { id: 'students', label_en: 'Students', label_ar: 'الطلاب', icon: 'groups', embed: StudentsPanel },
    { id: 'staff', label_en: 'Staff', label_ar: 'الموظفون', icon: 'badge', embed: StaffHrPanel },
    { id: 'fees', label_en: 'Fees', label_ar: 'الرسوم', icon: 'payments', embed: FeeManagement, embedProps: { embedded: true } },
    { id: 'expenses', label_en: 'Expenses', label_ar: 'المصروفات', icon: 'receipt_long', embed: ExpensesPanel },
    { id: 'donations', label_en: 'Donations', label_ar: 'التبرعات', icon: 'volunteer_activism', embed: DonationsPanel },
    { id: 'payroll', label_en: 'Payroll', label_ar: 'الرواتب', icon: 'payments', embed: PayrollPanel },
    { id: 'pipeline', label_en: 'Admissions CRM', label_ar: 'مسار القبول', icon: 'filter_alt', embed: CrmPanel },
    { id: 'hostel', label_en: 'Hostel', label_ar: 'السكن', icon: 'apartment', embed: HostelPanel },
    { id: 'welfare', label_en: 'Welfare', label_ar: 'الرعاية', icon: 'volunteer_activism', embed: WelfarePanel },
    { id: 'certificates', label_en: 'Certificates', label_ar: 'الشهادات', icon: 'workspace_premium', embed: CertificatesPanel },
    { id: 'duties', label_en: 'Duties', label_ar: 'المهام', icon: 'assignment_ind', embed: DutiesPanel },
    { id: 'reports', label_en: 'Reports', label_ar: 'التقارير', icon: 'analytics', embed: ReportsPanel },
  ];

  return (
    <RolePortalShell
      title_en={title_en}
      title_ar={title_ar}
      roleBadge={{
        text_en: vpMode ? 'Vice Principal' : 'Principal',
        text_ar: vpMode ? 'نائب المدير' : 'المدير',
        color: ROLE_BADGE.emerald,
      }}
      tabs={tabs}
      defaultTab="overview"
      bannerProps={{
        portal_en: vpMode ? 'Vice Principal' : 'Principal',
        portal_ar: vpMode ? 'نائب المدير' : 'المدير',
        hint_en: 'Leadership overview — timetable, students, staff, fees and welfare.',
        hint_ar: 'نظرة القيادة — الجدول والطلاب والموظفون والرسوم والرعاية.',
        accent: 'emerald',
      }}
    />
  );
}
