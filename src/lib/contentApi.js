import { supabase, isSupabaseConfigured } from './supabaseClient';

/**
 * Public content data layer (replaces the Express /api/news, /api/faculty,
 * /api/curriculum and /api/contact endpoints). Reads are governed by RLS:
 * news/faculty/curriculum are world-readable; contact messages are insert-only
 * for the public and readable only by staff.
 *
 * Each helper maps the flat snake_case DB columns back to the nested
 * bilingual { en, ar } shape the existing React pages already render, so the
 * page markup needs no structural changes.
 */

/** News articles, newest first. */
export async function listNews() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('news')
    .select('id, title_en, title_ar, content_en, content_ar, author, image, category, date')
    .eq('is_published', true)
    .order('date', { ascending: false });
  if (error) {
    console.error('[contentApi] listNews', error);
    return [];
  }
  return (data ?? []).map((row) => ({
    _id: row.id,
    category: row.category,
    date: row.date,
    author: row.author,
    image: row.image,
    title: { en: row.title_en, ar: row.title_ar },
    content: { en: row.content_en, ar: row.content_ar },
  }));
}

/** Faculty directory, ordered by sort_order. */
export async function listFaculty() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('faculty')
    .select('id, name_en, name_ar, role_en, role_ar, bio_en, bio_ar, image, qualifications, sort_order')
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('[contentApi] listFaculty', error);
    return [];
  }
  return (data ?? []).map((row) => ({
    _id: row.id,
    image: row.image,
    qualifications: row.qualifications ?? [],
    name: { en: row.name_en, ar: row.name_ar },
    role: { en: row.role_en, ar: row.role_ar },
    bio: { en: row.bio_en, ar: row.bio_ar },
  }));
}

/** 7-year curriculum, ordered by class number. */
export async function listCurriculum() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('curriculum')
    .select('id, class_number, class_name, age_range, modules, objectives, assessment_methods')
    .order('class_number', { ascending: true });
  if (error) {
    console.error('[contentApi] listCurriculum', error);
    return [];
  }
  return (data ?? []).map((row) => ({
    _id: row.id,
    classNumber: row.class_number,
    className: row.class_name ?? {},
    ageRange: row.age_range ?? {},
    modules: row.modules ?? [],
    objectives: row.objectives ?? {},
    assessmentMethods: row.assessment_methods ?? {},
  }));
}

/** Submit a public contact / enquiry message. */
export async function sendContactMessage(form) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const { error } = await supabase.from('contact_messages').insert({
    name: form.name,
    email: form.email,
    phone: form.phone || null,
    subject: form.subject || null,
    message: form.message,
  });
  if (error) throw error;
}
