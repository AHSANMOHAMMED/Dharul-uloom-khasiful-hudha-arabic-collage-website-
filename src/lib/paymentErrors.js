/** Map create-payment `{ code }` values to user-facing EN/AR copy. */
const PAYMENT_ERROR_COPY = {
  unauthorized: ['يجب تسجيل الدخول', 'Please sign in to continue'],
  forbidden: ['غير مسموح', 'You are not allowed to pay this invoice'],
  guardian_inactive: ['تم إيقاف ارتباط ولي الأمر', 'This guardian link is no longer active'],
  fees_permission_denied: ['لا صلاحية لدفع الرسوم', 'You do not have permission to pay fees for this student'],
  payments_disabled: ['الدفع الإلكتروني معطّل', 'Online payments are disabled for this college'],
  fee_not_found: ['الفاتورة غير موجودة', 'Fee invoice not found'],
  invoice_cancelled: ['الفاتورة ملغاة', 'This invoice has been cancelled'],
  no_balance: ['لا يوجد رصيد مستحق', 'No balance due on this invoice'],
  invoice_not_payable: ['لا يمكن دفع هذه الفاتورة إلكترونيًا', 'This invoice cannot be paid online'],
  fee_id_required: ['معرّف الفاتورة مطلوب', 'Fee ID is required'],
  gateway_not_configured: ['بوابة الدفع غير مهيأة', 'Payment gateway is not configured'],
  return_url_misconfigured: ['رابط العودة غير صحيح', 'Payment return URL is not configured correctly'],
  txn_create_failed: ['تعذّر إنشاء المعاملة', 'Could not create payment transaction'],
  method_not_allowed: ['طريقة غير مسموحة', 'Method not allowed'],
};

export function paymentErrorMessage(code, fallback, lang = 'en') {
  const pair = code ? PAYMENT_ERROR_COPY[code] : null;
  if (!pair) return fallback || 'Payment initiation failed';
  return lang === 'ar' ? pair[0] : pair[1];
}

export function isInvoicePayableOnline(fee) {
  if (!fee) return false;
  if (fee.cancelled_at || fee.status === 'cancelled') return false;
  if (fee.status !== 'unpaid' && fee.status !== 'partial') return false;
  const remaining = Number(fee.total_due || 0) - Number(fee.paid_amount || 0);
  return remaining > 0;
}

export class PaymentApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'PaymentApiError';
    this.code = code || null;
    this.status = status || null;
  }
}
