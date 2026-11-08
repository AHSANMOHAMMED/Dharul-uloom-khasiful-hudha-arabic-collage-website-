// Client-side mirror of the SQL role helpers in 0015_security_tenancy.sql.
// These only decide what UI to show — RLS on the server is the real gate.

const LEADERSHIP = ['principal', 'vice_principal'];

export function staffRoles(profile) {
  if (!profile) return [];
  const roles = [...(profile.extra_roles || [])];
  if (profile.assigned_tutor_role && profile.assigned_tutor_role !== 'none') roles.unshift(profile.assigned_tutor_role);
  return [...new Set(roles)];
}

export function getCaps(profile) {
  const p = profile || {};
  const isAdmin = p.role === 'admin' || p.role === 'super_admin';
  const isEmployeeAccount = (p.account_type === 'tutor' || p.account_type === 'staff') && p.is_approved;
  const roles = isEmployeeAccount ? staffRoles(p) : [];
  const has = (list) => roles.some((r) => list.includes(r));

  const isTutor = p.account_type === 'tutor' && !!p.is_approved;
  const isFinanceStaff = isAdmin || has(['treasurer', 'accountant']);
  const isFinanceViewer = isFinanceStaff || has(LEADERSHIP);
  const isAcademicAdmin = isAdmin || has([...LEADERSHIP, 'exam_officer']);
  const isHr = isAdmin || has(['hr_manager']);
  // Mirrors is_governance_admin(): assigns duties / tasks, marks tasks done.
  const isGovernance = isAdmin || has(LEADERSHIP);
  // Mirrors is_accountant(): reverses receipts.
  const isAccountant = isAdmin || has(['accountant']);
  // Mirrors is_admissions_staff().
  const isAdmissions = isAdmin || has(['admissions_officer', ...LEADERSHIP]);
  // academic_analytics(): academic admin, admin, admissions or HR.
  const canViewAcademicAnalytics = isAcademicAdmin || isAdmissions || isHr;

  return {
    isAdmin,
    isEmployee: isAdmin || isEmployeeAccount,
    isTutor,
    roles,
    isFinanceStaff,
    isFinanceViewer,
    isAcademicAdmin,
    isHr,
    isGovernance,
    isAccountant,
    isAdmissions,
    canViewFinanceAnalytics: isFinanceViewer,
    canViewAcademicAnalytics,
    canViewAnalytics: isFinanceViewer || canViewAcademicAnalytics,
    // Mirrors attendance / leave_requests write policies (is_tutor() or is_staff()).
    canMarkAttendance: isTutor || isAdmin,
    canReviewStudentLeave: isTutor || isAdmin,
    canViewDashboard: isAdmin || isFinanceViewer || isAcademicAdmin || isHr,
  };
}

// Which portal a profile lands on.
export function homeRouteFor(profile) {
  if (!profile) return '/login';
  if (profile.role === 'admin' || profile.role === 'super_admin') return '/admin';
  const type = profile.account_type;
  if (type === 'student' || type === 'parent' || type === 'tutor' || type === 'staff') {
    if (!profile.is_approved) return '/pending';
    if (type === 'student') return '/student';
    if (type === 'parent') return '/parent';
    return '/staff';
  }
  return '/pending';
}

export function accountLabelKey(profile) {
  if (!profile) return 'account.guest';
  if (profile.role === 'admin' || profile.role === 'super_admin') return 'account.admin';
  return `account.${profile.account_type || 'guest'}`;
}

// Announcement audience filter: empty target_roles = everyone.
export function announcementVisible(a, profile) {
  const targets = a?.target_roles || [];
  if (!targets.length) return true;
  if (!profile) return false;
  if (profile.role === 'admin' || profile.role === 'super_admin') return true;
  return targets.includes(profile.account_type) || staffRoles(profile).some((r) => targets.includes(r));
}
