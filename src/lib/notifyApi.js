import { supabase, isSupabaseConfigured } from './supabaseClient';

/** Ask the authenticated staff worker to drain its own organization's queue. */
export async function flushOutbound(limit = 20) {
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await supabase.functions.invoke('send-outbound', { body: { limit } });
    if (error) console.warn('[notifyApi] outbound queue remains pending', error);
  } catch (error) {
    console.warn('[notifyApi] outbound queue remains pending', error);
  }
}

/** Mark profile approved and notify student + linked parents (in-app + outbox). */
export async function approveProfile(profileId) {
  if (!isSupabaseConfigured) throw new Error('Not configured');
  // approve_account: server-side permission check + activation notifications.
  const { error } = await supabase.rpc('approve_account', { p_profile_id: profileId, p_approve: true });
  if (error) throw error;

  await flushOutbound(30);
}

/** After manual treasurer payment — notify student + parents. */
export async function notifyPaymentForStudent(studentId, amount, feeId = null, receiptNo = null) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.rpc('notify_payment_received', {
    p_student_id: studentId,
    p_amount: amount,
    p_fee_id: feeId,
    p_receipt_no: receiptNo,
  });
  if (error) console.error('[notifyApi] notify_payment_received', error);
  else await flushOutbound(20);
}

export async function listActivationEventsForChildren(childIds) {
  if (!isSupabaseConfigured || !childIds?.length) return [];
  const { data, error } = await supabase
    .from('activation_events')
    .select('*')
    .in('profile_id', childIds)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) {
    console.error('[notifyApi] listActivationEvents', error);
    return [];
  }
  return data ?? [];
}

export async function listMyNotifications(limit = 30) {
  if (!isSupabaseConfigured) return { items: [], error: null };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { items: [], error: null };
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[notifyApi] listMyNotifications', error);
    return { items: [], error: error.message || 'Failed to load notifications' };
  }
  return { items: data ?? [], error: null };
}

export async function markNotificationRead(id) {
  if (!isSupabaseConfigured || !id) return;
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) console.error('[notifyApi] markNotificationRead', error);
}

export async function markAllNotificationsRead() {
  if (!isSupabaseConfigured) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);
  if (error) throw error;
}

export async function updateNotifyPrefs(prefs) {
  if (!isSupabaseConfigured) throw new Error('Not configured');
  const { error } = await supabase.rpc('update_my_notification_preferences', {
    p_sms: Boolean(prefs.notify_sms),
    p_whatsapp: Boolean(prefs.notify_whatsapp),
    p_push: Boolean(prefs.notify_push),
    p_email: Boolean(prefs.notify_email),
    p_broadcast_channels: Boolean(prefs.notify_broadcast_channels),
  });
  if (error) throw error;
}
