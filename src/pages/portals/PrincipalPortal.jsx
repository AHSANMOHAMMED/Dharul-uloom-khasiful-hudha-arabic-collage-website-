import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';
import { ERP_QUICK_LINK } from '../../lib/portalChrome';
import { tx } from '../../lib/tx';
import { useAuth } from '../../context/AuthContext';

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
  const { user } = useAuth();
  const title_en = vpMode ? 'Vice Principal Portal' : 'Principal Portal';
  const title_ar = vpMode ? 'بوابة نائب المدير' : 'بوابة المدير';

  const tabs = [
    { id: 'overview', label_en: 'Overview', label_ar: 'نظرة عامة', icon: 'dashboard', embed: ErpDashboard },
    { id: 'academics', label_en: 'Academics', label_ar: 'الأكاديميات', icon: 'school', embed: AcademicsPanel },
    { id: 'timetable', label_en: 'Timetable', label_ar: 'الجدول', icon: 'calendar_month', embed: Timetable },
    { id: 'students', label_en: 'Students', label_ar: 'الطلاب', icon: 'groups', embed: StudentsPanel },
    { id: 'staff', label_en: 'Staff', label_ar: 'الموظفون', icon: 'badge', embed: StaffHrPanel },
    { id: 'fees', label_en: 'Fees', label_ar: 'الرسوم', icon: 'payments', embed: FeeManagement },
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
      quickLinks={[ERP_QUICK_LINK]}
      banner={
        <div className="rounded-[14px] bg-[#0B3B2E] text-white p-5 sm:p-6">
          <p className="text-[11px] uppercase tracking-wider text-[#C29A3A] font-semibold">
            {tx('القيادة الأكاديمية', 'Academic leadership')}
          </p>
          <h1 className="font-serif text-2xl font-semibold mt-1">
            {tx(`مرحباً، ${user?.username || ''}`, `Welcome, ${user?.username || ''}`)}
          </h1>
          <p className="text-xs text-white/75 mt-1 max-w-2xl">
            {tx(
              'متابعة الجدول والطلاب والموظفين والرسوم والرعاية من بوابة القيادة.',
              'Oversee timetable, students, staff, fees and welfare from the leadership portal.',
            )}
          </p>
        </div>
      }
    />
  );
}
