import { describe, expect, it } from 'vitest'
import { DOT_MATRIX, receiptEscp, receiptLines, receiptText } from '../lib/receiptText'
import { receiptHtml } from '../lib/receiptPrint'

const receipt = {
  id: 'r1', receipt_no: 'KH-RCP-2026-000123', amount: 3000, currency: 'LKR', method: 'cash', reference: null,
  paid_at: '2026-11-07T10:15:00Z', status: 'posted', arrears_after: 2000, public_token: 'a'.repeat(32),
  received_by: 'Accountant One', payer_name: 'Abdullah (father)', notes: null,
  organization: { name_en: 'Dharul Uloom Kashiful Hudha Arabic College', name_ar: 'دار العلوم كاشف الهدى',
    address: 'Mudalippalli, Kalpitiya, Puttalam', phone: '032-5612355', registration_no: 'MRCA/13/1/PAS/187' },
  student: { full_name: 'Ahmad Abdullah', index_number: 'KASHIF-2026-001', class_number: 5, parents: ['Abdullah Ismail'] },
  allocations: [
    { month: '2026-10', month_label: 'October 2026', invoice_no: 'KH-INV-2026-000031', invoice_total: 5000, paid_now: 1000, balance_after: 0 },
    { month: '2026-11', month_label: 'November 2026', invoice_no: 'KH-INV-2026-000045', invoice_total: 5000, paid_now: 2000, balance_after: 3000 },
  ],
  open_months: [{ month: '2026-11', balance: 3000 }],
}

describe('Epson LQ-310 dot-matrix receipt', () => {
  const lines = receiptText(receipt).split('\n')

  it('fits A5 at 12 cpi: every line ≤ 66 columns and one page ≤ 49 lines', () => {
    expect(Math.max(...lines.map((l) => l.length))).toBeLessThanOrEqual(DOT_MATRIX.columns)
    expect(lines.length).toBeLessThanOrEqual(DOT_MATRIX.linesPerPage)
  })

  it('is plain ASCII (impact printer text mode)', () => {
    expect(/^[\x20-\x7E\n]*$/.test(receiptText(receipt))).toBe(true)
  })

  it('contains every slip field', () => {
    const text = receiptText(receipt)
    for (const s of ['KH-RCP-2026-000123', 'Ahmad Abdullah', 'KASHIF-2026-001', 'Class 5', 'Abdullah Ismail',
      'October 2026', 'November 2026', 'PAID', '3,000.00', 'TOTAL RECEIVED', 'Three Thousand', 'Arrears after',
      '2,000.00', 'Cashier signature', 'Official seal', 'MRCA/13/1/PAS/187']) {
      expect(text).toContain(s)
    }
  })

  it('marks reversed receipts', () => {
    expect(receiptText({ ...receipt, status: 'reversed' })).toContain('REVERSED')
  })

  it('ESC/P job: reset, LQ, 12 cpi, 1/6" spacing, 49-line page, form feed', () => {
    const b = Array.from(receiptEscp(receipt))
    expect(b.slice(0, 2)).toEqual([0x1b, 0x40])              // ESC @
    expect(b.slice(2, 5)).toEqual([0x1b, 0x78, 0x01])        // ESC x 1 (LQ)
    expect(b.slice(5, 7)).toEqual([0x1b, 0x4d])              // ESC M (12 cpi)
    expect(b.slice(7, 9)).toEqual([0x1b, 0x32])              // ESC 2 (6 lpi)
    expect(b.slice(9, 12)).toEqual([0x1b, 0x43, 49])         // ESC C 49
    expect(b[b.length - 1]).toBe(0x0c)                       // form feed
    expect(b.every((x) => x < 0x80)).toBe(true)
    expect(receiptEscp(receipt, { quality: 'draft' })[4]).toBe(0x00)
  })

  it('bold markers never leak into the text', () => {
    expect(receiptLines(receipt).some((l) => l.charCodeAt(0) === 1)).toBe(true)
    expect(receiptText(receipt).includes(String.fromCharCode(1))).toBe(false)
  })
})

describe('graphic slip paper size', () => {
  it('defaults to A5 portrait', () => {
    expect(receiptHtml(receipt)).toContain('size: 148mm 210mm')
  })
  it('two copies go on one A4', () => {
    const html = receiptHtml(receipt, { copies: 2 })
    expect(html).toContain('size: A4')
    expect(html).toContain('Office copy')
    expect(html).toContain('Parent copy')
  })
})
