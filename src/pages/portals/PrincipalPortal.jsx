import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';

const ErpDashboard = lazy(() => import('../../components/erp/campus/ErpDashboard'));
const Timetable = lazy(() => import('../../components/erp/campus/Timetable'));
const FeeManagement = lazy(() => import('../../components/erp/finance/FeeManagement'));
const StudentsPanel = lazy(() => import('../../components/erp/campus/StudentsPanel'));
const StaffHrPanel = lazy(() => import('../../components/erp/campus/StaffHrPanel'));
const AcademicsPanel = lazy(() => import('../../components/erp/campus/AcademicsPanel'));
const WelfarePanel = lazy(() => import('../../components/erp/campus/WelfarePanel'));
const DutiesPanel = lazy(() => import('../../components/erp/governance/DutiesPanel'));
const ReportsPanel = lazy(() => import('../../components/erp/ops/ReportsPanel'));

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
    { id: 'welfare', label_en: 'Welfare', label_ar: 'الرعاية', icon: 'volunteer_activism', embed: WelfarePanel },
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
        color: 'bg-[#E3F1EA] text-[#0B3B2E] border-[#0B3B2E]/20',
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
