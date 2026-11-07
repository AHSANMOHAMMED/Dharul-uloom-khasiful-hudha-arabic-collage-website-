import { supabase, isSupabaseConfigured } from './supabaseClient';

export const CRM_STAGES = ['lead', 'submitted', 'interview', 'accepted', 'enrolled', 'rejected'];

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
    pipelineStage: row.pipeline_stage || 'submitted',
    assignedTo: row.assigned_to,
    enrolledIndex: row.enrolled_index,
    enrolledClass: row.enrolled_class,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function listCrmAdmissions() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('admissions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[crmApi] listCrmAdmissions', error);
    return [];
  }
  return (data ?? []).map(mapAdmission);
}

export async function moveAdmissionStage(id, toStage, note = '') {
  if (!isSupabaseConfigured) throw new Error('Not configured');
  const { data: current } = await supabase
    .from('admissions')
    .select('pipeline_stage, status')
    .eq('id', id)
    .single();

  const statusMap = {
    lead: 'lead',
    submitted: 'pending',
    interview: 'pending',
    accepted: 'approved',
    enrolled: 'enrolled',
    rejected: 'rejected',
  };

  const { error } = await supabase
    .from('admissions')
    .update({
      pipeline_stage: toStage,
      status: statusMap[toStage] || toStage,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;

  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('admission_status_history').insert({
    admission_id: id,
    from_stage: current?.pipeline_stage || null,
    to_stage: toStage,
    changed_by: user?.id || null,
    note: note || null,
  });
}

export async function addAdmissionNote(admissionId, body) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('admission_notes').insert({
    admission_id: admissionId,
    author_id: user?.id,
    body,
  });
  if (error) throw error;
}

export async function listAdmissionNotes(admissionId) {
  const { data, error } = await supabase
    .from('admission_notes')
    .select('*, profiles:author_id(full_name)')
    .eq('admission_id', admissionId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function enrollAdmission(admissionId, indexNumber, classNumber = 1) {
  const { data, error } = await supabase.rpc('enroll_admission', {
    p_admission_id: admissionId,
    p_index_number: indexNumber,
    p_class_number: classNumber,
  });
  if (error) throw error;
  return data;
}
