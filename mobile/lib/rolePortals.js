/**
 * Config-driven mobile role homes.
 * Each duty maps to tab routes under the staff (or dedicated) layout.
 */
import { getCaps, staffRoles } from './roles';

/** @typedef {{ name: string, title: string, icon: string, href?: string }} RoleTab */

const BASE_STAFF_TABS = [
  { name: 'index', title: 'tabs.home', icon: 'home-outline' },
  { name: 'more', title: 'tabs.more', icon: 'menu-outline' },
];

/** Extra screens reachable from More / role home shortcuts */
export const ROLE_SHORTCUTS = {
  treasurer: [
    { href: '/receive-payment', title: 'finance.receive', icon: 'cash-outline' },
    { href: '/finance', title: 'finance.title', icon: 'wallet-outline' },
    { href: '/finance/outstanding', title: 'finance.outstanding', icon: 'alert-circle-outline' },
    { href: '/payslips', title: 'hr.payslips', icon: 'document-outline' },
  ],
  accountant: [
    { href: '/finance', title: 'finance.title', icon: 'wallet-outline' },
    { href: '/finance/outstanding', title: 'finance.outstanding', icon: 'alert-circle-outline' },
    { href: '/accounting', title: 'finance.accounting', icon: 'book-outline' },
  ],
  hr_manager: [
    { href: '/staff/hr', title: 'tabs.hr', icon: 'briefcase-outline' },
    { href: '/staff-leave', title: 'hr.leave', icon: 'calendar-outline' },
    { href: '/payslips', title: 'hr.payslips', icon: 'document-outline' },
  ],
  admissions_officer: [
    { href: '/admissions', title: 'admissions.pipeline', icon: 'people-outline' },
  ],
  warden: [
    { href: '/hostel', title: 'hostel.title', icon: 'bed-outline' },
    { href: '/discipline', title: 'discipline.title', icon: 'shield-outline' },
    { href: '/welfare', title: 'welfare.title', icon: 'heart-outline' },
  ],
  counselor: [
    { href: '/welfare', title: 'welfare.title', icon: 'heart-outline' },
  ],
  exam_officer: [
    { href: '/exams', title: 'exams.title', icon: 'school-outline' },
    { href: '/results', title: 'results.title', icon: 'ribbon-outline' },
  ],
  principal: [
    { href: '/staff/dashboard', title: 'tabs.dashboard', icon: 'stats-chart-outline' },
    { href: '/timetable', title: 'timetable.title', icon: 'calendar-outline' },
    { href: '/tasks', title: 'tasks.title', icon: 'checkbox-outline' },
    { href: '/mashoora', title: 'mashoora.title', icon: 'people-outline' },
  ],
  vice_principal: [
    { href: '/staff/dashboard', title: 'tabs.dashboard', icon: 'stats-chart-outline' },
    { href: '/timetable', title: 'timetable.title', icon: 'calendar-outline' },
    { href: '/tasks', title: 'tasks.title', icon: 'checkbox-outline' },
  ],
  tutor: [
    { href: '/staff/attendance', title: 'tabs.attendance', icon: 'checkbox-outline' },
    { href: '/staff/leaves', title: 'tabs.leaves', icon: 'document-text-outline' },
    { href: '/results', title: 'results.title', icon: 'ribbon-outline' },
  ],
  librarian: [
    { href: '/dictionary', title: 'library.dictionary', icon: 'book-outline' },
  ],
};

export function primaryDuty(profile) {
  const caps = getCaps(profile);
  const roles = staffRoles(profile);
  const order = [
    'principal',
    'vice_principal',
    'treasurer',
    'accountant',
    'hr_manager',
    'admissions_officer',
    'exam_officer',
    'warden',
    'counselor',
    'librarian',
  ];
  for (const r of order) {
    if (roles.includes(r)) return r;
  }
  if (caps.isTutor) return 'tutor';
  if (caps.isEmployee) return 'staff';
  return null;
}

export function staffTabsFor(profile) {
  const caps = getCaps(profile);
  const duty = primaryDuty(profile);
  const tabs = [
    { name: 'index', title: 'tabs.home', icon: 'home-outline' },
    {
      name: 'attendance',
      title: 'tabs.attendance',
      icon: 'checkbox-outline',
      hidden: !caps.canMarkAttendance,
    },
    {
      name: 'leaves',
      title: 'tabs.leaves',
      icon: 'document-text-outline',
      hidden: !caps.canReviewStudentLeave,
    },
    { name: 'hr', title: 'tabs.hr', icon: 'briefcase-outline' },
    {
      name: 'dashboard',
      title: 'tabs.dashboard',
      icon: 'stats-chart-outline',
      hidden: !caps.canViewDashboard,
    },
    { name: 'more', title: 'tabs.more', icon: 'menu-outline' },
  ];
  return { duty, tabs, shortcuts: ROLE_SHORTCUTS[duty] || ROLE_SHORTCUTS.tutor || [] };
}

export function multiHatRoles(profile) {
  const caps = getCaps(profile);
  const roles = staffRoles(profile);
  const out = [];
  const push = (key, labelKey) => out.push({ key, labelKey });
  if (roles.includes('treasurer')) push('treasurer', 'roles.treasurer');
  if (roles.includes('accountant') || caps.isAccountant) push('accountant', 'roles.accountant');
  if (roles.includes('hr_manager') || caps.isHr) push('hr_manager', 'roles.hr');
  if (roles.includes('admissions_officer') || caps.isAdmissions) push('admissions_officer', 'roles.admissions');
  if (roles.includes('warden')) push('warden', 'roles.warden');
  if (roles.includes('counselor')) push('counselor', 'roles.counselor');
  if (roles.includes('exam_officer')) push('exam_officer', 'roles.exam');
  if (roles.includes('principal')) push('principal', 'roles.principal');
  if (roles.includes('vice_principal')) push('vice_principal', 'roles.vp');
  if (roles.includes('librarian') || profile?.role === 'librarian') push('librarian', 'roles.librarian');
  if (caps.isTutor) push('tutor', 'roles.tutor');
  return out;
}

export { BASE_STAFF_TABS };
