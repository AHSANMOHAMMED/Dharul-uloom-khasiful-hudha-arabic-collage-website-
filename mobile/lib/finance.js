import { supabase, must } from './supabase';

/**
 * Finance-on-the-phone helpers (0025_finance_ops_activities_analytics.sql).
 * finance_today / student_message_log need is_finance_viewer(); reminders and
 * resend need is_finance_staff(); reverse_fee_receipt needs is_accountant().
 */

export const CHANNEL_ICON = {
  sms: 'chatbox-outline',
  whatsapp: 'logo-whatsapp',
  email: 'mail-outline',
  push: 'phone-portrait-outline',
};

export const MESSAGE_STATUS_TONE = {
  pending: 'warning',
  sending: 'info',
  sent: 'success',
  failed: 'danger',
  blocked: 'danger',
  skipped: 'neutral',
};

export const MAX_AMOUNT = 10_000_000;

/**
 * Parse a user-typed money amount. Returns a positive number with at most two
 * decimals, or null when the input is empty, negative, zero, not finite, has
 * more than 2 decimals, or exceeds MAX_AMOUNT. Accepts thousands separators.
 */
export function parseAmount(input) {
  const raw = String(input ?? '').replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT ? n : null;
}

/** Whole-number quantity between 1 and 10 000, else null. */
export function parseQty(input) {
  const raw = String(input ?? '').trim();
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= 10000 ? n : null;
}

// PostgREST `or` filters use , ( ) as syntax; strip them from user input.
export const cleanTerm = (s) => String(s || '').replace(/[,()*%\\]/g, ' ').trim();

export const STUDENT_COLUMNS = 'id, full_name, index_number, class_number, phone';

export async function searchStudents(term, limit = 25) {
  const q = cleanTerm(term);
  return must(
    supabase
      .from('profiles')
      .select(STUDENT_COLUMNS)
      .eq('account_type', 'student')
      .or(`full_name.ilike.%${q}%,index_number.ilike.%${q}%`)
      .order('full_name')
      .limit(limit),
  );
}

/**
 * Ask send-outbound to drain this college's queue now (staff only; the
 * function checks). Best effort: rows stay queued for the scheduled worker.
 */
export function flushOutbound(limit = 20) {
  if (!supabase) return;
  supabase.functions.invoke('send-outbound', { body: { limit } })
    .then(({ error }) => error && console.warn('[finance] outbound queue remains pending', error))
    .catch((e) => console.warn('[finance] outbound queue remains pending', e));
}

const thenFlush = (limit) => (result) => {
  flushOutbound(limit);
  return result;
};

export const sendReminder = (studentId, note) =>
  must(supabase.rpc('send_fee_reminder', { p_student: studentId, p_note: note?.trim() || null })).then(thenFlush(20));

export const sendOverdueReminders = (minDays, limit = 200) =>
  must(supabase.rpc('send_overdue_reminders', { p_min_days: minDays, p_limit: limit })).then(thenFlush(50));

export const resendReceipt = (receiptId) =>
  must(supabase.rpc('resend_receipt', { p_receipt: receiptId })).then(thenFlush(20));

export const reverseReceipt = (receiptId, reason) =>
  must(supabase.rpc('reverse_fee_receipt', { p_receipt: receiptId, p_reason: reason.trim() }));
