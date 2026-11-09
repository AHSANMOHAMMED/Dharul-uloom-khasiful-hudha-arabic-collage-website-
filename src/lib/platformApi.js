import { supabase } from './supabaseClient';

async function unwrap(label, { data, error }) {
  if (error) throw new Error(error.message || `${label} failed`);
  return data;
}

export const FEATURE_META = [
  { key: 'public_site', group: 'public', label: ['Public website', 'الموقع العام'] },
  { key: 'admissions_form', group: 'public', label: ['Admissions form', 'نموذج القبول'] },
  { key: 'library', group: 'public', label: ['Digital library', 'المكتبة الرقمية'] },
  { key: 'library_reader', group: 'public', label: ['Book reader', 'قارئ الكتب'] },
  { key: 'registrations', group: 'access', label: ['New registrations', 'التسجيلات الجديدة'] },
  { key: 'student_portal', group: 'access', label: ['Student portal', 'بوابة الطالب'] },
  { key: 'parent_portal', group: 'access', label: ['Parent portal', 'بوابة ولي الأمر'] },
  { key: 'staff_portal', group: 'access', label: ['Staff portal', 'بوابة الموظفين'] },
  { key: 'mobile_app', group: 'access', label: ['Mobile app access', 'تطبيق الجوال'] },
  { key: 'messaging', group: 'access', label: ['In-app messaging', 'الرسائل'] },
  { key: 'payments', group: 'finance', label: ['Online payments (PayHere)', 'الدفع الإلكتروني'] },
  { key: 'erp', group: 'erp', label: ['Campus ERP (master)', 'نظام الإدارة'] },
  { key: 'erp_dashboard', group: 'erp', label: ['ERP overview', 'نظرة عامة'] },
  { key: 'erp_analytics', group: 'erp', label: ['Analytics', 'التحليلات'] },
  { key: 'erp_reports', group: 'erp', label: ['Reports', 'التقارير'] },
  { key: 'erp_import', group: 'erp', label: ['Bulk import', 'الاستيراد'] },
  { key: 'erp_documents', group: 'erp', label: ['Documents & exam papers', 'المستندات'] },
  { key: 'erp_tasks', group: 'erp', label: ['Task board', 'المهام'] },
  { key: 'erp_students', group: 'erp', label: ['Students', 'الطلاب'] },
  { key: 'erp_academics', group: 'erp', label: ['Academics & exams', 'الأكاديميات'] },
  { key: 'erp_crm', group: 'erp', label: ['Admissions CRM', 'إدارة القبول'] },
  { key: 'erp_fees', group: 'erp', label: ['Student fees', 'الرسوم'] },
  { key: 'erp_accounting', group: 'erp', label: ['Accounting', 'المحاسبة'] },
  { key: 'erp_cheques', group: 'erp', label: ['Cheques', 'الشيكات'] },
  { key: 'erp_expenses', group: 'erp', label: ['Expenses', 'المصروفات'] },
  { key: 'erp_donations', group: 'erp', label: ['Donations', 'التبرعات'] },
  { key: 'erp_billing_jobs', group: 'erp', label: ['Billing jobs', 'مهام الفوترة'] },
  { key: 'erp_quotations', group: 'erp', label: ['Quotations', 'عروض الأسعار'] },
  { key: 'erp_finance_hub', group: 'erp', label: ['Finance hub', 'مركز المالية'] },
  { key: 'erp_payroll', group: 'erp', label: ['Payroll', 'الرواتب'] },
  { key: 'erp_hr', group: 'erp', label: ['HR & staff', 'الموارد البشرية'] },
  { key: 'erp_hostel', group: 'erp', label: ['Hostel', 'السكن'] },
  { key: 'erp_welfare', group: 'erp', label: ['Discipline & welfare', 'الانضباط'] },
  { key: 'erp_certificates', group: 'erp', label: ['Certificates', 'الشهادات'] },
  { key: 'erp_duties', group: 'erp', label: ['Duties', 'المسؤوليات'] },
  { key: 'erp_activities', group: 'erp', label: ['Activities', 'الأنشطة'] },
  { key: 'erp_mashoora', group: 'erp', label: ['Mashoora', 'الشورى'] },
  { key: 'erp_pettycash', group: 'erp', label: ['Petty cash', 'النثرية'] },
  { key: 'erp_audit', group: 'erp', label: ['Audit log', 'سجل التدقيق'] },
];

/** Map ERP module ids → feature keys */
export const ERP_MODULE_FEATURES = {
  dashboard: 'erp_dashboard',
  analytics: 'erp_analytics',
  reports: 'erp_reports',
  import: 'erp_import',
  documents: 'erp_documents',
  tasks: 'erp_tasks',
  self: 'staff_portal',
  students: 'erp_students',
  academics: 'erp_academics',
  crm: 'erp_crm',
  financetoday: 'erp_fees',
  fees: 'erp_fees',
  accounting: 'erp_accounting',
  cheques: 'erp_cheques',
  expenses: 'erp_expenses',
  donations: 'erp_donations',
  financehub: 'erp_finance_hub',
  payroll: 'erp_payroll',
  hr: 'erp_hr',
  hostel: 'erp_hostel',
  welfare: 'erp_welfare',
  certificates: 'erp_certificates',
  duties: 'erp_duties',
  activities: 'erp_activities',
  mashoora: 'erp_mashoora',
  pettycash: 'erp_pettycash',
  audit: 'erp_audit',
  platform: null, // always for super admin
};

export function isFeatureOn(features, key) {
  if (!key) return true;
  if (!features || typeof features !== 'object') return true;
  if (Object.prototype.hasOwnProperty.call(features, key)) return Boolean(features[key]);
  return true;
}

export async function fetchMyFeatures() {
  return unwrap('my_features', await supabase.rpc('my_features'));
}

export async function fetchPlatformControls() {
  return unwrap('get_platform_controls', await supabase.rpc('get_platform_controls'));
}

export async function setPlatformFeature(key, enabled, note = null) {
  return unwrap('set_platform_feature', await supabase.rpc('set_platform_feature', {
    p_key: key,
    p_enabled: enabled,
    p_note: note,
  }));
}

export async function setOrgFeature(orgId, key, enabled, note = null) {
  return unwrap('set_org_feature', await supabase.rpc('set_org_feature', {
    p_org: orgId,
    p_key: key,
    p_enabled: enabled,
    p_note: note,
  }));
}

export async function clearOrgFeature(orgId, key) {
  return unwrap('clear_org_feature', await supabase.rpc('clear_org_feature', {
    p_org: orgId,
    p_key: key,
  }));
}

export async function fetchPlatformUsers(search = '', limit = 100) {
  return unwrap('platform_user_directory', await supabase.rpc('platform_user_directory', {
    p_search: search || null,
    p_limit: limit,
  }));
}

export async function setPlatformUserApproved(profileId, approve) {
  return unwrap('platform_set_user_approved', await supabase.rpc('platform_set_user_approved', {
    p_profile: profileId,
    p_approve: approve,
  }));
}

export async function fetchPlatformControlHistory(limit = 40) {
  return unwrap('platform_control_history', await supabase.rpc('platform_control_history', {
    p_limit: limit,
  }));
}

// ---------------------------------------------------------------------------
// Platform operator tools (0036_platform_admin.sql + platform-user-admin fn)
// ---------------------------------------------------------------------------

/** reset_mfa | send_password_reset | set_sign_in({ enabled }) via the Auth admin API. */
export async function platformUserAction(action, userId, extra = {}) {
  const { data, error } = await supabase.functions.invoke('platform-user-admin', {
    body: { action, user_id: userId, ...extra },
  });
  if (error) {
    let message = error.message;
    try {
      const body = await error.context?.json?.();
      if (body?.error) message = body.error;
    } catch {
      /* keep the generic message */
    }
    throw new Error(message || `${action} failed`);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function updatePlatformOrg(orgId, patch) {
  return unwrap('platform_update_org', await supabase.rpc('platform_update_org', { p_org: orgId, p_patch: patch }));
}
export async function fetchOrgInvitations(orgId) {
  return unwrap('platform_org_invitations', await supabase.rpc('platform_org_invitations', { p_org: orgId }));
}
export async function inviteOrgAdmin(orgId, email, fullName = null) {
  return unwrap('platform_invite_admin', await supabase.rpc('platform_invite_admin', { p_org: orgId, p_email: email, p_full_name: fullName }));
}
export async function revokeInvitation(invitationId) {
  return unwrap('platform_revoke_invitation', await supabase.rpc('platform_revoke_invitation', { p_invitation: invitationId }));
}
export async function fetchPlatformHealth() {
  return unwrap('platform_health', await supabase.rpc('platform_health'));
}
export async function platformBroadcast(title, message, audience, orgIds = null) {
  return unwrap('platform_broadcast', await supabase.rpc('platform_broadcast', {
    p_title: title, p_message: message, p_audience: audience, p_orgs: orgIds && orgIds.length ? orgIds : null,
  }));
}
