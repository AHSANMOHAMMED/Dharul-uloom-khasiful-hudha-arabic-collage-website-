import DOMPurify from 'dompurify';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { ErpError } from './rpc';

/**
 * Documents, letterheads and exam papers (0031_documents_exam_papers.sql).
 * Document HTML is written by one user and rendered for others, so it is
 * sanitised both before saving and before rendering.
 */

function db() {
  if (!isSupabaseConfigured || !supabase) throw new ErpError('Supabase is not configured');
  return supabase;
}
async function unwrap(p) {
  const { data, error } = await p;
  if (error) throw new ErpError(error.message, error);
  return data;
}

export const DOC_KINDS = [
  ['letter', ['Letter', 'رسالة']],
  ['notice', ['Notice', 'إعلان']],
  ['circular', ['Circular', 'تعميم']],
  ['certificate', ['Certificate', 'شهادة']],
  ['minutes', ['Meeting minutes', 'محضر اجتماع']],
  ['report', ['Report', 'تقرير']],
  ['quotation', ['Quotation', 'عرض سعر']],
  ['other', ['Other', 'أخرى']],
];

export const PAPER_STATUSES = {
  assigned: ['Assigned', 'مُسند'],
  drafting: ['Drafting', 'قيد الإعداد'],
  submitted: ['Submitted', 'مُقدَّم'],
  it_review: ['IT review', 'مراجعة تقنية'],
  approved: ['Approved', 'معتمد'],
  printed: ['Printed', 'مطبوع'],
  released: ['Released', 'منشور'],
};

const SANITIZE = {
  ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr', 'span', 'div', 'blockquote', 'img', 'a'],
  ALLOWED_ATTR: ['style', 'dir', 'colspan', 'rowspan', 'src', 'alt', 'width', 'height', 'href', 'align'],
  ALLOWED_URI_REGEXP: /^(?:https?:|data:image\/(?:png|jpe?g|gif|webp);base64,|#)/i,
};
// Inline styles may not load anything (url(), image-set(), legacy expression()),
// so an opened document cannot beacon to an outside server.
let hooked = false;
function ensureHook() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'style' && /url\s*\(|image-set|expression\s*\(|@import/i.test(data.attrValue)) {
      data.keepAttr = false;
    }
    if (data.attrName === 'src' && !/^data:image\//i.test(data.attrValue)) {
      // Images must be embedded (pasted/inserted), not hot-linked.
      data.keepAttr = false;
    }
  });
}

export function sanitizeHtml(html) {
  ensureHook();
  return DOMPurify.sanitize(String(html || ''), SANITIZE);
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export async function listDocuments({ search = '', kind = '' } = {}) {
  let q = db()
    .from('documents')
    .select('id, title, kind, status, ref_no, version, locked, owner_id, updated_at, share_roles, profiles:owner_id(full_name)')
    .order('updated_at', { ascending: false })
    .limit(300);
  if (kind) q = q.eq('kind', kind);
  if (search.trim()) q = q.ilike('title', `%${search.trim().replace(/[%_]/g, '\\$&')}%`);
  return unwrap(q);
}

/** Opens via RPC so exam-paper access is logged. */
export async function openDocument(id, action = 'viewed') {
  return unwrap(db().rpc('open_document', { p_doc: id, p_action: action }));
}

export async function createDocument({ title, kind = 'letter', body_html = '', letterhead_id = null }) {
  return unwrap(
    db()
      .from('documents')
      .insert({ title, kind, body_html: sanitizeHtml(body_html), letterhead_id })
      .select('id')
      .single()
  );
}

export async function saveDocument(id, patch) {
  const row = { ...patch };
  if ('body_html' in row) row.body_html = sanitizeHtml(row.body_html);
  const data = await unwrap(db().from('documents').update(row).eq('id', id).select('id, version, updated_at, locked'));
  // RLS turns a forbidden update into "0 rows" rather than an error.
  if (!data?.length) throw new ErpError('You cannot edit this document (it may be locked or submitted).');
  return data[0];
}

export async function deleteDocument(id) {
  return unwrap(db().from('documents').delete().eq('id', id));
}

export async function listVersions(id) {
  return unwrap(
    db()
      .from('document_versions')
      .select('id, version, title, body_html, saved_at, profiles:saved_by(full_name)')
      .eq('document_id', id)
      .order('version', { ascending: false })
      .limit(50)
  );
}

// ---------------------------------------------------------------------------
// Letterheads (A4 background image in the private org-documents bucket)
// ---------------------------------------------------------------------------
export async function listLetterheads() {
  return unwrap(db().from('letterheads').select('*').order('is_default', { ascending: false }).order('created_at'));
}

const urlCache = new Map();
/** Signed URL (1 h) for a letterhead image; cached per page load. */
export async function letterheadUrl(path) {
  if (!path) return null;
  const hit = urlCache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;
  const data = await unwrap(db().storage.from('org-documents').createSignedUrl(path, 3600));
  urlCache.set(path, { url: data.signedUrl, expires: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}

export async function createLetterhead({ orgId, name, file, margins, orientation = 'portrait', isDefault = false }) {
  if (!orgId) throw new ErpError('No institution selected');
  if (!file) throw new ErpError('Choose the letterhead image');
  if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) {
    throw new ErpError('Upload the letterhead as a PNG, JPG, WEBP or SVG image of the full A4 page');
  }
  if (file.size > 10 * 1024 * 1024) throw new ErpError('The image must be smaller than 10 MB');
  const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${orgId}/letterheads/${crypto.randomUUID()}.${ext}`;
  await unwrap(db().storage.from('org-documents').upload(path, file, { contentType: file.type, upsert: false }));
  return unwrap(
    db()
      .from('letterheads')
      .insert({
        name,
        storage_path: path,
        orientation,
        is_default: isDefault,
        margin_top_mm: margins.top,
        margin_bottom_mm: margins.bottom,
        margin_left_mm: margins.left,
        margin_right_mm: margins.right,
      })
      .select()
      .single()
  );
}

export async function updateLetterhead(id, patch) {
  return unwrap(db().from('letterheads').update(patch).eq('id', id).select().single());
}

export async function deleteLetterhead(lh) {
  await unwrap(db().from('letterheads').delete().eq('id', lh.id));
  if (lh.storage_path) await db().storage.from('org-documents').remove([lh.storage_path]);
}

// ---------------------------------------------------------------------------
// Exam papers
// ---------------------------------------------------------------------------
export async function listExamPapers() {
  return unwrap(
    db()
      .from('exam_papers')
      .select('*, exams(name, class_number), subjects(code, name_en), examiner:examiner_id(full_name), documents(title, locked, version)')
      .order('created_at', { ascending: false })
      .limit(300)
  );
}

export async function paperForDocument(docId) {
  return unwrap(db().from('exam_papers').select('*, exams(name, class_number), subjects(code, name_en), examiner:examiner_id(full_name)').eq('document_id', docId).maybeSingle());
}

export async function paperEvents(paperId) {
  return unwrap(
    db()
      .from('exam_paper_events')
      .select('id, action, note, created_at, actor:actor_id(full_name)')
      .eq('paper_id', paperId)
      .order('created_at', { ascending: false })
      .limit(100)
  );
}

export async function assignExamPaper(p) {
  return unwrap(
    db().rpc('assign_exam_paper', {
      p_exam: p.exam,
      p_subject: p.subject,
      p_examiner: p.examiner,
      p_due: p.due || null,
      p_instructions: p.instructions || null,
      p_duration: p.duration ? Number(p.duration) : null,
      p_total_marks: p.totalMarks ? Number(p.totalMarks) : null,
      p_letterhead: p.letterhead || null,
    })
  );
}

export async function paperTransition(paperId, action, note = null) {
  return unwrap(db().rpc('exam_paper_transition', { p_paper: paperId, p_action: action, p_note: note }));
}
