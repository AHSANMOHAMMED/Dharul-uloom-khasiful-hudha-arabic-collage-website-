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

export const sendReminder = (studentId, note) =>
  must(supabase.rpc('send_fee_reminder', { p_student: studentId, p_note: note?.trim() || null }));

export const sendOverdueReminders = (minDays, limit = 200) =>
  must(supabase.rpc('send_overdue_reminders', { p_min_days: minDays, p_limit: limit }));

export const resendReceipt = (receiptId) => must(supabase.rpc('resend_receipt', { p_receipt: receiptId }));

export const reverseReceipt = (receiptId, reason) =>
  must(supabase.rpc('reverse_fee_receipt', { p_receipt: receiptId, p_reason: reason.trim() }));
