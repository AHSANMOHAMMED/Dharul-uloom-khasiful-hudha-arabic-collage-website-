import { supabase, isSupabaseConfigured } from './supabaseClient';

export async function listMaterialsForClass(classNumber) {
  if (!isSupabaseConfigured || !classNumber) return [];
  const { data, error } = await supabase
    .from('lms_materials')
    .select('*')
    .eq('class_number', classNumber)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[lmsApi] listMaterialsForClass', error);
    return [];
  }
  return data ?? [];
}

export async function listAssignmentsForClass(classNumber) {
  if (!isSupabaseConfigured || !classNumber) return [];
  const { data, error } = await supabase
    .from('lms_assignments')
    .select('*')
    .eq('class_number', classNumber)
    .order('due_date', { ascending: true });
  if (error) {
    console.error('[lmsApi] listAssignmentsForClass', error);
    return [];
  }
  return data ?? [];
}

export async function createMaterial(row) {
  if (!isSupabaseConfigured) throw new Error('Not configured');
  const { data, error } = await supabase.from('lms_materials').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function createAssignment(row) {
  if (!isSupabaseConfigured) throw new Error('Not configured');
  const { data, error } = await supabase.from('lms_assignments').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function submitAssignment(assignmentId, studentId, content) {
  if (!isSupabaseConfigured) throw new Error('Not configured');
  const { data, error } = await supabase
    .from('lms_submissions')
    .upsert(
      { assignment_id: assignmentId, student_id: studentId, content, submitted_at: new Date().toISOString() },
      { onConflict: 'assignment_id,student_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listSubmissionsForAssignment(assignmentId) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('lms_submissions')
    .select('*, profiles!lms_submissions_student_id_fkey(full_name)')
    .eq('assignment_id', assignmentId);
  if (error) throw error;
  return data ?? [];
}

export async function gradeSubmission(submissionId, grade, feedback) {
  if (!isSupabaseConfigured) throw new Error('Not configured');
  const { data, error } = await supabase
    .from('lms_submissions')
    .update({ grade, feedback })
    .eq('id', submissionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getStudentSubmissions(studentId) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('lms_submissions')
    .select('*, lms_assignments(title, due_date, subject)')
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function listClassSchedules(classNumber) {
  if (!isSupabaseConfigured || !classNumber) return [];
  const { data, error } = await supabase
    .from('class_schedules')
    .select('*, profiles!class_schedules_tutor_id_fkey(full_name)')
    .eq('class_number', classNumber)
    .order('day_of_week');
  if (error) return [];
  return data ?? [];
}
