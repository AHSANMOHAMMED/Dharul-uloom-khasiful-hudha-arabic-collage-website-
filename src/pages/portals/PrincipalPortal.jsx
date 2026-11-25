import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';
import { ROLE_BADGE } from '../../lib/roleTheme';

const ErpDashboard = lazy(() => import('../../components/erp/campus/ErpDashboard'));
const Timetable = lazy(() => import('../../components/erp/campus/Timetable'));
const FeeManagement = lazy(() => import('../../components/erp/finance/FeeManagement'));
const FinanceHubPanel = lazy(() => import('../../components/erp/finance/FinanceHubPanel'));
const AccountingPanel = lazy(() => import('../../components/erp/finance/AccountingPanel'));
const ChequesPanel = lazy(() => import('../../components/erp/finance/ChequesPanel'));
const AuditLogPanel = lazy(() => import('../../components/erp/finance/AuditLogPanel'));
const StudentsPanel = lazy(() => import('../../components/erp/campus/StudentsPanel'));
const StaffHrPanel = lazy(() => import('../../components/erp/campus/StaffHrPanel'));
const AcademicsPanel = lazy(() => import('../../components/erp/campus/AcademicsPanel'));
const WelfarePanel = lazy(() => import('../../components/erp/campus/WelfarePanel'));
const HostelPanel = lazy(() => import('../../components/erp/campus/HostelPanel'));
const CertificatesPanel = lazy(() => import('../../components/erp/campus/CertificatesPanel'));
const DutiesPanel = lazy(() => import('../../components/erp/governance/DutiesPanel'));
const MashooraPanel = lazy(() => import('../../components/erp/governance/MashooraPanel'));
const TaskBoard = lazy(() => import('../../components/erp/governance/TaskBoard'));
const PettyCashPanel = lazy(() => import('../../components/erp/governance/PettyCashPanel'));
const DocumentsPanel = lazy(() => import('../../components/erp/docs/DocumentsPanel'));
const ReportsPanel = lazy(() => import('../../components/erp/ops/ReportsPanel'));
const AnalyticsPanel = lazy(() => import('../../components/erp/ops/AnalyticsPanel'));
const CrmPanel = lazy(() => import('../../components/erp/campus/CrmPanel'));
const ExpensesPanel = lazy(() => import('../../components/erp/finance/ExpensesPanel'));
const DonationsPanel = lazy(() => import('../../components/erp/finance/DonationsPanel'));
const PayrollPanel = lazy(() => import('../../components/erp/finance/PayrollPanel'));

export default function PrincipalPortal({ vpMode = false }) {
  const title_en = vpMode ? 'Vice Principal Portal' : 'Principal Portal';
  const title_ar = vpMode ? 'بوابة نائب المدير' : 'بوابة المدير';

  const tabs = [
    { id: 'overview', label_en: 'Overview', label_ar: 'نظرة عامة', icon: 'dashboard', group: 'Leadership', group_ar: 'القيادة', embed: ErpDashboard },
    { id: 'mashoora', label_en: 'Mashoora', label_ar: 'الشورى', icon: 'diversity_3', group: 'Leadership', group_ar: 'القيادة', embed: MashooraPanel },
    { id: 'tasks', label_en: 'Task Board', label_ar: 'لوحة المهام', icon: 'view_kanban', group: 'Leadership', group_ar: 'القيادة', embed: TaskBoard },
    { id: 'duties', label_en: 'Duties', label_ar: 'المسؤوليات', icon: 'assignment_ind', group: 'Leadership', group_ar: 'القيادة', embed: DutiesPanel },
    { id: 'academics', label_en: 'Academics', label_ar: 'الأكاديميات', icon: 'school', group: 'Academic', group_ar: 'الأكاديمي', embed: AcademicsPanel },
    { id: 'timetable', label_en: 'Timetable', label_ar: 'الجدول', icon: 'calendar_month', group: 'Academic', group_ar: 'الأكاديمي', embed: Timetable },
    { id: 'students', label_en: 'Students', label_ar: 'الطلاب', icon: 'groups', group: 'Academic', group_ar: 'الأكاديمي', embed: StudentsPanel },
    { id: 'staff', label_en: 'Staff HR', label_ar: 'الموظفون', icon: 'badge', group: 'Academic', group_ar: 'الأكاديمي', embed: StaffHrPanel },
    { id: 'pipeline', label_en: 'Admissions CRM', label_ar: 'مسار القبول', icon: 'filter_alt', group: 'Academic', group_ar: 'الأكاديمي', embed: CrmPanel },
    { id: 'fees', label_en: 'Fees', label_ar: 'الرسوم', icon: 'payments', group: 'Finance', group_ar: 'المالية', embed: FeeManagement, embedProps: { embedded: true } },
    { id: 'financehub', label_en: 'Finance Hub', label_ar: 'مركز المالية', icon: 'hub', group: 'Finance', group_ar: 'المالية', embed: FinanceHubPanel },
    { id: 'accounting', label_en: 'Accounting', label_ar: 'المحاسبة', icon: 'account_balance', group: 'Finance', group_ar: 'المالية', embed: AccountingPanel },
    { id: 'cheques', label_en: 'Cheques', label_ar: 'الشيكات', icon: 'request_quote', group: 'Finance', group_ar: 'المالية', embed: ChequesPanel },
    { id: 'expenses', label_en: 'Expenses', label_ar: 'المصروفات', icon: 'receipt_long', group: 'Finance', group_ar: 'المالية', embed: ExpensesPanel },
    { id: 'donations', label_en: 'Donations', label_ar: 'التبرعات', icon: 'volunteer_activism', group: 'Finance', group_ar: 'المالية', embed: DonationsPanel },
    { id: 'payroll', label_en: 'Payroll', label_ar: 'الرواتب', icon: 'payments', group: 'Finance', group_ar: 'المالية', embed: PayrollPanel },
    { id: 'pettycash', label_en: 'Petty Cash', label_ar: 'النثرية', icon: 'account_balance_wallet', group: 'Finance', group_ar: 'المالية', embed: PettyCashPanel },
    { id: 'hostel', label_en: 'Hostel', label_ar: 'السكن', icon: 'apartment', group: 'Campus', group_ar: 'الحرم', embed: HostelPanel },
    { id: 'welfare', label_en: 'Welfare', label_ar: 'الرعاية', icon: 'health_and_safety', group: 'Campus', group_ar: 'الحرم', embed: WelfarePanel },
    { id: 'certificates', label_en: 'Certificates', label_ar: 'الشهادات', icon: 'workspace_premium', group: 'Campus', group_ar: 'الحرم', embed: CertificatesPanel },
    { id: 'documents', label_en: 'Documents', label_ar: 'المستندات', icon: 'description', group: 'Campus', group_ar: 'الحرم', embed: DocumentsPanel },
    { id: 'reports', label_en: 'Reports', label_ar: 'التقارير', icon: 'summarize', group: 'Insights', group_ar: 'التقارير', embed: ReportsPanel },
    { id: 'analytics', label_en: 'Analytics', label_ar: 'التحليلات', icon: 'analytics', group: 'Insights', group_ar: 'التقارير', embed: AnalyticsPanel },
    { id: 'audit', label_en: 'Audit Log', label_ar: 'سجل التدقيق', icon: 'history_edu', group: 'Insights', group_ar: 'التقارير', embed: AuditLogPanel },
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
