import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getSiteOrgId, getSiteOrgSlug } from './siteOrg';

/** Fallback admission age limits (match public.admission_age_limits defaults). */
export const DEFAULT_AGE_LIMITS = { minAge: 5, maxAge: 25 };

/** Today's date (YYYY-MM-DD) in the institution's time zone (Sri Lanka by default). */
export function todayIso(timeZone = 'Asia/Colombo', now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

const parseIso = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
};

/** Shift an ISO date by whole years / days (calendar arithmetic, UTC-safe). */
export function shiftIso(iso, { years = 0, days = 0 } = {}) {
  const p = parseIso(iso);
  if (!p) return '';
  const dt = new Date(Date.UTC(p.y + years, p.m - 1, p.d));
  // 29 Feb + n years → 28 Feb (not 1 Mar)
  if (dt.getUTCMonth() !== p.m - 1) dt.setUTCDate(0);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Age in completed years + months on `today` (both YYYY-MM-DD); null when invalid/future. */
export function ageFromDob(dob, today = todayIso()) {
  const b = parseIso(dob);
  const t = parseIso(today);
  if (!b || !t || dob > today) return null;
  let months = (t.y - b.y) * 12 + (t.m - b.m);
  if (t.d < b.d) months -= 1;
  return { years: Math.floor(months / 12), months: months % 12 };
}

/** Admission age limits for the site's institution (rpc admission_age_limits). Never throws. */
export async function loadAdmissionAgeLimits() {
  if (!isSupabaseConfigured) return DEFAULT_AGE_LIMITS;
  try {
    const orgId = await getSiteOrgId();
    if (!orgId) return DEFAULT_AGE_LIMITS;
    const { data, error } = await supabase.rpc('admission_age_limits', { p_org: orgId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    const minAge = Number(row?.min_age);
    const maxAge = Number(row?.max_age);
    return {
      minAge: Number.isFinite(minAge) && row?.min_age != null ? minAge : DEFAULT_AGE_LIMITS.minAge,
      maxAge: Number.isFinite(maxAge) && row?.max_age != null ? maxAge : DEFAULT_AGE_LIMITS.maxAge,
    };
  } catch (e) {
    console.error('[admissionsApi] loadAdmissionAgeLimits', e);
    return DEFAULT_AGE_LIMITS;
  }
}

/** Sri Lankan phone: 0XXXXXXXXX or 94XXXXXXXXX once non-digits are removed. */
export const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '');
export const isSriLankanPhone = (phone) => /^(0\d{9}|94\d{9})$/.test(normalizePhone(phone));

/**
 * Admissions data layer (replaces the Express /api/user/admissions and
 * /api/admin/admissions endpoints). All access is governed by RLS:
 *   - authenticated users can insert + read their own applications;
 *   - staff (librarian/admin) can read every application and review it.
 */

async function currentUserId() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/** Map a DB row (snake_case) to the camelCase shape the UI already expects. */
function mapAdmission(row) {
  return {
    _id: row.id,
    studentName: row.student_name,
    dateOfBirth: row.date_of_birth ?? null,
    age: row.age,
    parentName: row.parent_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    previousEducation: row.previous_education,
    course: row.course,
    source: row.source ?? null,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

/** Submit a new application for the signed-in user. */
export async function submitAdmission(form) {
  const userId = await currentUserId();
  if (!userId) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('admissions')
    .insert({
      student_name: form.studentName,
      date_of_birth: form.dateOfBirth || null,
      // the DB trigger recomputes age from date_of_birth; send our value as well
      age: Number(form.age ?? ageFromDob(form.dateOfBirth)?.years),
      parent_name: form.parentName,
      phone: form.phone,
      email: form.email || null,
      address: form.address,
      previous_education: form.previousEducation || null,
      course: form.course,
      submitted_by: userId,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return mapAdmission(data);
}

/**
 * Public (guest) application: rpc submit_public_admission → { ok, id, age }.
 * The RPC puts it into the CRM pipeline and notifies admissions staff; its
 * error message (duplicate, phone, age …) is thrown as-is.
 */
export async function submitPublicAdmission(form) {
  if (!isSupabaseConfigured) throw new Error('Not configured');
  const { data, error } = await supabase.rpc('submit_public_admission', {
    p_student_name: form.studentName,
    p_date_of_birth: form.dateOfBirth,
    p_parent_name: form.parentName,
    p_phone: form.phone,
    p_address: form.address,
    p_course: form.course,
    p_email: form.email || null,
    p_previous_education: form.previousEducation || null,
    p_org_slug: await getSiteOrgSlug(),
  });
  if (error) throw error;
  return data;
}

/** List the signed-in user's applications, newest first. */
export async function listMyAdmissions() {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('admissions')
    .select('*')
    .eq('submitted_by', userId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[admissionsApi] listMyAdmissions', error);
    return [];
  }
  return (data ?? []).map(mapAdmission);
}

async function countAdmissions(filters = {}) {
  let query = supabase.from('admissions').select('*', { count: 'exact', head: true });
  for (const [col, val] of Object.entries(filters)) query = query.eq(col, val);
  const { count, error } = await query;
  if (error) {
    console.error('[admissionsApi] countAdmissions', error);
    return 0;
  }
  return count ?? 0;
}

/** Per-user dashboard stats. */
export async function myAdmissionStats() {
  const userId = await currentUserId();
  if (!userId) return { total: 0, pending: 0, approved: 0 };
  const [total, pending, approved] = await Promise.all([
    countAdmissions({ submitted_by: userId }),
    countAdmissions({ submitted_by: userId, status: 'pending' }),
    countAdmissions({ submitted_by: userId, status: 'approved' }),
  ]);
  return { total, pending, approved };
}

/** Staff: list applications by status (default pending), newest first. */
export async function listAdmissionsByStatus(status = 'pending') {
  const { data, error } = await supabase
    .from('admissions')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[admissionsApi] listAdmissionsByStatus', error);
    return [];
  }
  return (data ?? []).map(mapAdmission);
}

/** Staff: approve / reject an application. */
export async function updateAdmissionStatus(id, status) {
  const reviewerId = await currentUserId();
  const { error } = await supabase
    .from('admissions')
    .update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Staff: aggregate dashboard stats (admissions + content counts). */
export async function adminStats() {
  const [total, pending, approved, rejected, news, faculty] = await Promise.all([
    countAdmissions(),
    countAdmissions({ status: 'pending' }),
    countAdmissions({ status: 'approved' }),
    countAdmissions({ status: 'rejected' }),
    supabase.from('news').select('*', { count: 'exact', head: true }),
    supabase.from('faculty').select('*', { count: 'exact', head: true }),
  ]);
  return {
    admissions: { total, pending, approved, rejected },
    content: { news: news.count ?? 0, faculty: faculty.count ?? 0 },
  };
}
