import { supabase } from './supabaseClient';

async function unwrap(label, { data, error }) {
  if (error) throw new Error(error.message || `${label} failed`);
  return data;
}

export async function createBillingJob({ kind, month = null, defaultTuition = null }) {
  return unwrap('create_billing_job', await supabase.rpc('create_billing_job', {
    p_kind: kind,
    p_month: month,
    p_default_tuition: defaultTuition,
  }));
}

export async function listBillingJobs(limit = 40) {
  const { data, error } = await supabase
    .from('billing_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createFinanceDocument(payload) {
  return unwrap('create_finance_document', await supabase.rpc('create_finance_document', {
    p_doc_type: payload.docType,
    p_party_type: payload.partyType || 'external',
    p_party_id: payload.partyId || null,
    p_party_name: payload.partyName || null,
    p_party_phone: payload.partyPhone || null,
    p_notes: payload.notes || null,
    p_letterhead_id: payload.letterheadId || null,
    p_lines: payload.lines || [],
  }));
}

export async function issueFinanceDocument(id) {
  return unwrap('issue_finance_document', await supabase.rpc('issue_finance_document', { p_id: id }));
}

export async function amendFinanceDocument(id, { partyName, notes, lines, reason }) {
  return unwrap('amend_finance_document', await supabase.rpc('amend_finance_document', {
    p_id: id,
    p_party_name: partyName ?? null,
    p_notes: notes ?? null,
    p_lines: lines ?? null,
    p_reason: reason,
  }));
}

export async function voidFinanceDocument(id, reason) {
  return unwrap('void_finance_document', await supabase.rpc('void_finance_document', {
    p_id: id,
    p_reason: reason,
  }));
}

export async function convertQuotationToBill(id) {
  return unwrap('convert_quotation_to_bill', await supabase.rpc('convert_quotation_to_bill', { p_id: id }));
}

export async function hardDeleteFinanceDocument(id) {
  return unwrap('hard_delete_finance_document', await supabase.rpc('hard_delete_finance_document', { p_id: id }));
}

export async function queueFinanceDocShare(id, channel, to, message = null) {
  return unwrap('queue_finance_doc_share', await supabase.rpc('queue_finance_doc_share', {
    p_id: id,
    p_channel: channel,
    p_to: to,
    p_message: message,
  }));
}

export async function listFinanceDocuments({ docType = null, status = null, limit = 50 } = {}) {
  let q = supabase.from('finance_documents').select('*').order('created_at', { ascending: false }).limit(limit);
  if (docType) q = q.eq('doc_type', docType);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function listFinanceDocumentLines(docId) {
  const { data, error } = await supabase
    .from('finance_document_lines')
    .select('*')
    .eq('doc_id', docId)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchFinanceDocumentByToken(token) {
  return unwrap('finance_document_by_token', await supabase.rpc('finance_document_by_token', {
    p_token: token,
  }));
}

export function financePublicPath(doc) {
  if (!doc?.public_token) return null;
  if (doc.doc_type === 'quotation') return `/q/${doc.public_token}`;
  if (doc.doc_type === 'receipt') return `/r/${doc.public_token}`;
  return `/b/${doc.public_token}`;
}

export function financePublicUrl(doc) {
  const path = financePublicPath(doc);
  if (!path) return '';
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

export function whatsappShareUrl(doc, text) {
  const url = financePublicUrl(doc);
  const msg = text || `Kashiful Hudha ${doc.doc_type} ${doc.doc_number || ''} — ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export function smsShareUrl(phone, doc, text) {
  const url = financePublicUrl(doc);
  const msg = text || `Kashiful Hudha ${doc.doc_type} ${doc.doc_number || ''} — ${url}`;
  const to = (phone || '').replace(/[^\d+]/g, '');
  return `sms:${to}?body=${encodeURIComponent(msg)}`;
}
