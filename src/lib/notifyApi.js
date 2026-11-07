import { supabase, isSupabaseConfigured } from './supabaseClient';

/** Mark profile approved and notify student + linked parents (in-app + outbox). */
export async function approveProfile(profileId) {
  if (!isSupabaseConfigured) throw new Error('Not configured');
  const { error } = await supabase
    .from('profiles')
    .update({ is_approved: true })
    .eq('id', profileId);
  if (error) throw error;

  const { error: notifyErr } = await supabase.rpc('notify_profile_activated', {
    p_profile_id: profileId,
  });
  if (notifyErr) console.error('[notifyApi] notify_profile_activated', notifyErr);

  // Best-effort flush SMS/WhatsApp/email queue
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && import.meta.env.VITE_SUPABASE_URL) {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-outbound`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: 30 }),
      });
    }
  } catch (e) {
    console.warn('[notifyApi] send-outbound trigger failed', e);
  }
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
  if (!isSupabaseConfigured) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[notifyApi] listMyNotifications', error);
    return [];
  }
  return data ?? [];
}

export async function markNotificationRead(id) {
  if (!isSupabaseConfigured || !id) return;
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
}

export async function updateNotifyPrefs(prefs) {
  if (!isSupabaseConfigured) throw new Error('Not configured');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('profiles')
    .update({
      notify_sms: prefs.notify_sms,
      notify_whatsapp: prefs.notify_whatsapp,
      notify_push: prefs.notify_push,
      notify_email: prefs.notify_email,
    })
    .eq('id', user.id);
  if (error) throw error;
}
