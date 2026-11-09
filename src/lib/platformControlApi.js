import { supabase } from './supabaseClient';

async function unwrap(label, { data, error }) {
  if (error) throw new Error(error.message || `${label} failed`);
  return data;
}

export const ROLE_TEMPLATE_KEYS = [
  'student', 'parent', 'tutor', 'staff', 'admin', 'librarian',
  'principal', 'vice_principal', 'treasurer', 'accountant', 'hr_manager',
  'admissions_officer', 'warden', 'counselor', 'exam_officer', 'it_officer',
];

export const STAFF_HATS = [
  'none', 'principal', 'vice_principal', 'treasurer', 'accountant', 'hr_manager',
  'librarian', 'admissions_officer', 'warden', 'counselor', 'exam_officer', 'it_officer',
];

export async function platformInviteUser(payload) {
  return unwrap('platform_invite_user', await supabase.rpc('platform_invite_user', {
    p_org: payload.orgId,
    p_email: payload.email,
    p_full_name: payload.fullName || null,
    p_account_type: payload.accountType || 'staff',
    p_role: payload.role || 'user',
    p_assigned_tutor_role: payload.assignedTutorRole || 'none',
    p_extra_roles: payload.extraRoles || [],
    p_approve: Boolean(payload.approve),
  }));
}

export async function platformUpdateUser(payload) {
  return unwrap('platform_update_user', await supabase.rpc('platform_update_user', {
    p_profile: payload.id,
    p_org: payload.orgId ?? null,
    p_account_type: payload.accountType ?? null,
    p_role: payload.role ?? null,
    p_assigned_tutor_role: payload.assignedTutorRole ?? null,
    p_extra_roles: payload.extraRoles ?? null,
    p_full_name: payload.fullName ?? null,
    p_class_number: payload.classNumber ?? null,
    p_is_approved: payload.isApproved ?? null,
  }));
}

export async function platformDeactivateUser(id, reason = null) {
  return unwrap('platform_deactivate_user', await supabase.rpc('platform_deactivate_user', {
    p_profile: id,
    p_reason: reason,
  }));
}

export async function listRoleFeatures(role = null) {
  return unwrap('platform_list_role_features', await supabase.rpc('platform_list_role_features', {
    p_role: role,
  })) || [];
}

export async function setRoleFeature(role, key, enabled) {
  return unwrap('platform_set_role_feature', await supabase.rpc('platform_set_role_feature', {
    p_role: role,
    p_key: key,
    p_enabled: enabled,
  }));
}

export async function listUserFeatures(userId) {
  return unwrap('platform_list_user_features', await supabase.rpc('platform_list_user_features', {
    p_user: userId,
  })) || [];
}

export async function setUserFeature(userId, key, enabled) {
  return unwrap('platform_set_user_feature', await supabase.rpc('platform_set_user_feature', {
    p_user: userId,
    p_key: key,
    p_enabled: enabled,
  }));
}

export async function clearUserFeature(userId, key) {
  return unwrap('platform_clear_user_feature', await supabase.rpc('platform_clear_user_feature', {
    p_user: userId,
    p_key: key,
  }));
}

export async function listCommunities(orgId = null) {
  return unwrap('platform_list_communities', await supabase.rpc('platform_list_communities', {
    p_org: orgId,
  })) || [];
}

export async function createCommunity(row) {
  const { data, error } = await supabase.from('communities').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateCommunity(id, patch) {
  const { data, error } = await supabase.from('communities').update(patch).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listCommunityMembers(communityId) {
  const { data, error } = await supabase
    .from('community_members')
    .select('community_id, user_id, member_role, status, joined_at, profiles:user_id(full_name, email)')
    .eq('community_id', communityId);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function addCommunityMember(communityId, userId, memberRole = 'member') {
  const { data, error } = await supabase
    .from('community_members')
    .upsert({ community_id: communityId, user_id: userId, member_role: memberRole, status: 'active' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createCommunityPost(communityId, orgId, body) {
  const { data, error } = await supabase
    .from('community_posts')
    .insert({ community_id: communityId, org_id: orgId, body })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listCommunityPosts(communityId) {
  const { data, error } = await supabase
    .from('community_posts')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchPlatformAuditFeed({ orgId = null, table = null, limit = 50 } = {}) {
  return unwrap('platform_audit_feed', await supabase.rpc('platform_audit_feed', {
    p_org: orgId,
    p_table: table,
    p_limit: limit,
  })) || [];
}
