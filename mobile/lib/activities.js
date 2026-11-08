import { supabase, must } from './supabase';

/**
 * Activities with several responsible people (0025_finance_ops_activities_analytics.sql).
 * respond_activity / assign_activity_staff / remove_activity_staff are the real gate.
 */

export const ACTIVITY_ROLES = ['lead', 'coordinator', 'supervisor', 'member', 'helper'];
export const ACTIVITY_CATEGORIES = ['event', 'exam_duty', 'trip', 'programme', 'meeting', 'maintenance', 'religious', 'sports', 'other'];

export const ASSIGNEE_STATUS_TONE = { assigned: 'warning', accepted: 'info', declined: 'danger', done: 'success' };
export const ACTIVITY_STATUS_TONE = { planned: 'info', ongoing: 'warning', completed: 'success', cancelled: 'neutral' };

export const CATEGORY_ICON = {
  event: 'sparkles-outline',
  exam_duty: 'school-outline',
  trip: 'bus-outline',
  programme: 'easel-outline',
  meeting: 'people-outline',
  maintenance: 'construct-outline',
  religious: 'moon-outline',
  sports: 'football-outline',
  other: 'flag-outline',
};

/** Translated label with a readable fallback (`activity.role.lead` → "lead"). */
export function labelOr(t, key, raw) {
  const v = t(key);
  return v === key ? String(raw || '').replace(/_/g, ' ') : v;
}

/** accepted | declined (note required) | done */
export async function respondActivity(activityId, status, note) {
  return must(supabase.rpc('respond_activity', { p_activity: activityId, p_status: status, p_note: note?.trim() || null }));
}

/** people: [{ profile_id, role, responsibilities }] → number assigned */
export async function assignActivityStaff(activityId, people) {
  return must(supabase.rpc('assign_activity_staff', { p_activity: activityId, p_people: people }));
}

export async function removeActivityStaff(activityId, profileId) {
  return must(supabase.rpc('remove_activity_staff', { p_activity: activityId, p_profile: profileId }));
}

/** Is the activity in the future (or running now)? */
export function isUpcoming(a) {
  const end = a?.ends_at || a?.starts_at;
  return !!end && new Date(end).getTime() >= Date.now() - 6 * 3600 * 1000;
}
