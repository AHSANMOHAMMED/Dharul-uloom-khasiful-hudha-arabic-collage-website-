import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** @deprecated receipts are numbered in SQL (next_document_number) */
export function makeReceiptNo(): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `REC-${ym}-${Date.now().toString().slice(-6)}`;
}

/** In-app + SMS/WhatsApp/email outbox for student and linked parents. */
export async function notifyPaymentReceived(
  admin: SupabaseClient,
  studentId: string,
  amount: number,
  feeId: string | null,
  receiptNo: string | null,
) {
  const { error } = await admin.rpc('notify_payment_received', {
    p_student_id: studentId,
    p_amount: amount,
    p_fee_id: feeId,
    p_receipt_no: receiptNo,
  });
  if (error) {
    console.error('[notify] notify_payment_received', error);
    // Fallback: at least write student notification
    await admin.from('notifications').insert({
      user_id: studentId,
      title: 'Payment received',
      message: `Your tuition payment of LKR ${amount} was received successfully.${receiptNo ? ` Receipt: ${receiptNo}.` : ''}`,
    });
  }
}

export async function notifyMonthlyFeeCreated(
  admin: SupabaseClient,
  studentId: string,
  month: string,
  amount: number,
) {
  const title = 'Monthly fee invoice';
  const body = `A tuition invoice for ${month} (LKR ${amount}) has been generated. Please pay via the portal.`;

  await admin.from('notifications').insert({ user_id: studentId, title, message: body });
  await admin.rpc('enqueue_user_messages', {
    p_user_id: studentId,
    p_subject: title,
    p_body: body,
    p_metadata: { type: 'monthly_fee', month, amount },
  });

  const { data: parents } = await admin
    .from('parent_children')
    .select('parent_id')
    .eq('child_id', studentId);

  for (const row of parents || []) {
    await admin.from('notifications').insert({
      user_id: row.parent_id,
      title,
      message: body,
    });
    await admin.rpc('enqueue_user_messages', {
      p_user_id: row.parent_id,
      p_subject: title,
      p_body: body,
      p_metadata: { type: 'monthly_fee', month, amount, student_id: studentId },
    });
  }
}

/** Fire-and-forget trigger for send-outbound worker. */
export async function triggerOutboundWorker(supabaseUrl: string, serviceKey: string) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-outbound`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ limit: 50 }),
    });
  } catch (err) {
    console.error('[notify] triggerOutboundWorker', err);
  }
}
