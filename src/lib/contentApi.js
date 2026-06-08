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
  return (data ?? []).map(mapNewsRow);
}

function mapNewsRow(row) {
  return {
    _id: row.id,
    category: row.category,
    date: row.date,
    author: row.author,
    image: row.image,
    title: { en: row.title_en, ar: row.title_ar },
    content: { en: row.content_en, ar: row.content_ar },
  };
}

/** Single published news article by id. */
export async function getNewsById(id) {
  if (!isSupabaseConfigured || !id) return null;
  const { data, error } = await supabase
    .from('news')
    .select('id, title_en, title_ar, content_en, content_ar, author, image, category, date')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle();
  if (error || !data) {
    console.error('[contentApi] getNewsById', error);
    return null;
  }
  return mapNewsRow(data);
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

// ── Gallery ─────────────────────────────────────────────────────────────────

export async function listGalleryItems() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('gallery_items')
    .select('id, title_en, title_ar, category, image_url, sort_order')
    .eq('is_published', true)
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('[contentApi] listGalleryItems', error);
    return [];
  }
  return (data ?? []).map(mapGalleryRow);
}

function mapGalleryRow(row) {
  return {
    id: row.id,
    title: { en: row.title_en, ar: row.title_ar },
    category: row.category,
    imageUrl: resolveGalleryUrl(row.image_url),
  };
}

// ── Course programs ───────────────────────────────────────────────────────────

export async function listCoursePrograms() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('course_programs')
    .select('id, slug, title_en, title_ar, duration_en, duration_ar, description_en, description_ar, icon, admission_code, sort_order')
    .eq('is_published', true)
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('[contentApi] listCoursePrograms', error);
    return [];
  }
  return (data ?? []).map(mapCourseRow);
}

function mapCourseRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    icon: row.icon,
    admissionCode: row.admission_code,
    title: { en: row.title_en, ar: row.title_ar },
    duration: { en: row.duration_en, ar: row.duration_ar },
    description: { en: row.description_en, ar: row.description_ar },
  };
}

// ── Storage helpers ─────────────────────────────────────────────────────────

const CONTENT_BUCKET = 'content';
const GALLERY_BUCKET = 'gallery';

export function resolveContentUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!isSupabaseConfigured) return null;
  const { data } = supabase.storage.from(CONTENT_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export function resolveGalleryUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!isSupabaseConfigured) return null;
  const { data } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export async function uploadContentImage(file, folder = 'misc') {
  if (!isSupabaseConfigured || !file) return null;
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(CONTENT_BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function uploadGalleryImage(file) {
  if (!isSupabaseConfigured || !file) return null;
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(GALLERY_BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

// ── Admin CRUD (staff only via RLS) ─────────────────────────────────────────

export async function adminListNews() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('news').select('*').order('date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function adminUpsertNews(row) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const payload = {
    title_en: row.title_en,
    title_ar: row.title_ar || null,
    content_en: row.content_en,
    content_ar: row.content_ar || null,
    author: row.author || 'Admin',
    image: row.image || null,
    category: row.category || 'general',
    is_published: row.is_published ?? true,
    date: row.date || new Date().toISOString(),
  };
  if (row.id) {
    const { data, error } = await supabase.from('news').update(payload).eq('id', row.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('news').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function adminDeleteNews(id) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const { error } = await supabase.from('news').delete().eq('id', id);
  if (error) throw error;
}

export async function adminListFaculty() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('faculty').select('*').order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function adminUpsertFaculty(row) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const payload = {
    name_en: row.name_en,
    name_ar: row.name_ar || null,
    role_en: row.role_en,
    role_ar: row.role_ar || null,
    bio_en: row.bio_en || null,
    bio_ar: row.bio_ar || null,
    image: row.image || null,
    qualifications: row.qualifications || [],
    sort_order: row.sort_order ?? 0,
  };
  if (row.id) {
    const { data, error } = await supabase.from('faculty').update(payload).eq('id', row.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('faculty').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function adminDeleteFaculty(id) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const { error } = await supabase.from('faculty').delete().eq('id', id);
  if (error) throw error;
}

export async function adminListCurriculum() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('curriculum').select('*').order('class_number');
  if (error) throw error;
  return data ?? [];
}

export async function adminUpsertCurriculum(row) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const payload = {
    class_number: row.class_number,
    class_name: row.class_name || {},
    age_range: row.age_range || {},
    modules: row.modules || [],
    objectives: row.objectives || {},
    assessment_methods: row.assessment_methods || {},
  };
  if (row.id) {
    const { data, error } = await supabase.from('curriculum').update(payload).eq('id', row.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('curriculum').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function adminListGallery() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('gallery_items').select('*').order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function adminUpsertGallery(row) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const payload = {
    title_en: row.title_en,
    title_ar: row.title_ar || null,
    category: row.category || 'facilities',
    image_url: row.image_url || null,
    sort_order: row.sort_order ?? 0,
    is_published: row.is_published ?? true,
  };
  if (row.id) {
    const { data, error } = await supabase.from('gallery_items').update(payload).eq('id', row.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('gallery_items').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function adminDeleteGallery(id) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const { error } = await supabase.from('gallery_items').delete().eq('id', id);
  if (error) throw error;
}

export async function adminListCoursePrograms() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from('course_programs').select('*').order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function adminUpsertCourseProgram(row) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const payload = {
    slug: row.slug,
    title_en: row.title_en,
    title_ar: row.title_ar || null,
    duration_en: row.duration_en || null,
    duration_ar: row.duration_ar || null,
    description_en: row.description_en || null,
    description_ar: row.description_ar || null,
    icon: row.icon || '📚',
    admission_code: row.admission_code || null,
    sort_order: row.sort_order ?? 0,
    is_published: row.is_published ?? true,
  };
  if (row.id) {
    const { data, error } = await supabase.from('course_programs').update(payload).eq('id', row.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('course_programs').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function adminDeleteCourseProgram(id) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const { error } = await supabase.from('course_programs').delete().eq('id', id);
  if (error) throw error;
}
