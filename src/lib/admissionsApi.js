import { supabase, isSupabaseConfigured } from './supabaseClient';

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
    age: row.age,
    parentName: row.parent_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    previousEducation: row.previous_education,
    course: row.course,
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
      age: Number(form.age),
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
