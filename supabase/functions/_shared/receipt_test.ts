// deno test supabase/functions/_shared/
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { amountInWords, buildReceiptPdf, pdfSafe, money } from './receiptPdf.ts';
import { normalizeLkPhone } from './phone.ts';

const sample = {
  id: 'r1', receipt_no: 'KH-RCP-2026-000123', amount: 3000, currency: 'LKR', method: 'cash', reference: null,
  paid_at: '2026-11-07T10:15:00Z', status: 'posted', arrears_after: 2000, public_token: 'a'.repeat(32),
  received_by: 'Accountant One', payer_name: 'Mother',
  organization: { name_en: 'Dharul Uloom Kashiful Hudha Arabic College', address: 'Mudalippalli, Kalpitiya',
                  phone: '032-5612355', email: 'info@kashifulhudha.lk', registration_no: 'MRCA/13/1/PAS/187' },
  student: { full_name: 'Ahmad Abdullah', index_number: 'KASHIF-2026-001', class_number: 5, parents: ['Abdullah'] },
  allocations: [{ month: '2026-11', month_label: 'November 2026', invoice_no: 'KH-INV-2026-000045',
                  invoice_total: 5000, paid_now: 3000, balance_after: 2000 }],
  open_months: [{ month: '2026-11', balance: 2000 }],
};

Deno.test('receipt PDF renders (valid PDF, one page)', async () => {
  const bytes = await buildReceiptPdf(sample, { verifyUrl: 'https://kashifulhudha.lk/r/' + 'a'.repeat(32) });
  assertEquals(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
  assert(bytes.length > 1500);
});

Deno.test('reversed receipt and non-Latin names do not crash the renderer', async () => {
  const bytes = await buildReceiptPdf({ ...sample, status: 'reversed',
    student: { ...sample.student, full_name: 'அஹ்மத் أحمد Ahmad' } });
  assertEquals(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
});

Deno.test('amount in words', () => {
  assertEquals(amountInWords(3000), 'Three thousand rupees only');
  assertEquals(amountInWords(2500.5), 'Two thousand five hundred rupees and fifty cents only');
  assertEquals(amountInWords(125000), 'One hundred and twenty-five thousand rupees only');
});

Deno.test('pdfSafe / money', () => {
  assertEquals(pdfSafe('Fee – Nov'), 'Fee - Nov');
  assertEquals(pdfSafe('أحمد Ahmad'), 'Ahmad');
  assertEquals(money(2000), '2,000.00');
});

Deno.test('Sri Lankan phone normalisation', () => {
  assertEquals(normalizeLkPhone('0771234567'), '94771234567');
  assertEquals(normalizeLkPhone('+94 77 123 4567'), '94771234567');
  assertEquals(normalizeLkPhone('771234567'), '94771234567');
});
