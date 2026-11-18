import { describe, expect, it } from 'vitest';
import { isInvoicePayableOnline, paymentErrorMessage } from '../lib/paymentErrors.js';

describe('paymentErrors', () => {
  it('maps stable create-payment codes', () => {
    expect(paymentErrorMessage('fees_permission_denied', 'x', 'en')).toMatch(/permission/i);
    expect(paymentErrorMessage('guardian_inactive', 'x', 'ar')).toMatch(/ولي/);
    expect(paymentErrorMessage('pay_oldest_first', 'x', 'en')).toMatch(/oldest/i);
    expect(paymentErrorMessage('unknown', 'fallback', 'en')).toBe('fallback');
  });

  it('detects payable online invoices', () => {
    expect(isInvoicePayableOnline({ status: 'unpaid', total_due: 100, paid_amount: 0 })).toBe(true);
    expect(isInvoicePayableOnline({ status: 'partial', total_due: 100, paid_amount: 40 })).toBe(true);
    expect(isInvoicePayableOnline({ status: 'cancelled', total_due: 100, paid_amount: 0 })).toBe(false);
    expect(isInvoicePayableOnline({ status: 'unpaid', cancelled_at: '2026-01-01', total_due: 100, paid_amount: 0 })).toBe(false);
    expect(isInvoicePayableOnline({ status: 'completed', total_due: 100, paid_amount: 100 })).toBe(false);
    expect(isInvoicePayableOnline({ status: 'unpaid', total_due: 100, paid_amount: 100 })).toBe(false);
  });
});
