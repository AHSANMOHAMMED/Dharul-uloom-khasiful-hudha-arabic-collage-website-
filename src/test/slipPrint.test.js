import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeSlipSettings, getSlipSettings, saveSlipSettings } from '../lib/slip/slipSettings'
import { alignmentDocument, rawColumns, slipDocument, slipEscp, slipLines } from '../lib/slip/slipRender'
import { donationSlip, expenseVoucherSlip, feeReceiptSlip, financeDocSlip, financePaymentSlip, payslipSlip, pettyVoucherSlip } from '../lib/slip/slipModels'

const org = { name_en: 'Dharul Uloom Kashiful Hudha Arabic College', name_ar: 'دار العلوم كاشف الهدى', address: 'Kalpitiya', contact_phone: '032-5612355' }
const receipt = {
  receipt_no: 'KH-RCP-2026-000123', amount: 3000, method: 'cash', paid_at: '2026-11-07T10:15:00Z', arrears_after: 2000,
  organization: { ...org, phone: '032-5612355' }, payer_name: 'Abdullah', public_token: 'a'.repeat(32),
  student: { full_name: 'அஹமத் Ahmad Abdullah', index_number: 'KASHIF-2026-001', class_number: 5, parents: ['Abdullah Ismail'] },
  allocations: [
    { month: '2026-10', invoice_no: 'INV-31', invoice_total: 5000, paid_now: 1000, balance_after: 0 },
    { month: '2026-11', invoice_no: 'INV-45', invoice_total: 5000, paid_now: 2000, balance_after: 3000 },
  ],
  open_months: [{ month: '2026-11', balance: 3000 }],
}
const LQ = { mode: 'lq310', paper: 'cont_95x55' }

describe('slip printer settings', () => {
  beforeEach(() => {
    const store = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    })
  })

  it('uses the exact continuous-form size and clamps bad input', () => {
    const s = normalizeSlipSettings({ paper: 'cont_95x55', offsetXmm: 99, copies: 7, mode: 'nope' })
    expect([s.widthMm, s.heightMm]).toEqual([241.3, 139.7])
    expect(s.offsetXmm).toBe(20)
    expect(s.copies).toBe(1)
    expect(s.mode).toBe('lq310')
    expect(normalizeSlipSettings({ paper: 'custom', widthMm: 400, heightMm: 50 })).toMatchObject({ widthMm: 254, heightMm: 76 })
  })

  it('migrates the old counter preference and saves per computer', () => {
    localStorage.setItem('kh_receipt_printer', 'a4x2')
    expect(getSlipSettings()).toMatchObject({ mode: 'laser', paper: 'a4', copies: 2 })
    saveSlipSettings({ mode: 'raw', paper: 'a5l', cpi: 12 })
    expect(getSlipSettings()).toMatchObject({ mode: 'raw', paper: 'a5l', cpi: 12, widthMm: 210 })
  })
})

describe('formatted slip for the LQ-310 driver', () => {
  it('sets the page to the form size with no browser margins, one form per copy', () => {
    const html = slipDocument([feeReceiptSlip(receipt)], { ...LQ, copies: 2 })
    expect(html).toContain('@page { size: 241.3mm 139.7mm; margin: 0; }')
    expect((html.match(/<section class="slip impact">/g) || []).length).toBe(2)
    expect(html).toContain('Office copy')
    expect(html).toContain('Customer copy')
    expect(html).toContain('دار العلوم كاشف الهدى') // driver mode keeps Arabic
    expect(html).toContain('Rupees Three Thousand Only')
  })

  it('is black only on impact printers and colour on laser', () => {
    expect(slipDocument(feeReceiptSlip(receipt), LQ)).not.toContain('class="slip color"')
    expect(slipDocument(feeReceiptSlip(receipt), { mode: 'laser', paper: 'a5p' })).toContain('class="slip color"')
  })

  it('applies alignment offsets', () => {
    const html = slipDocument(feeReceiptSlip(receipt), { ...LQ, marginMm: 6, offsetXmm: 3, offsetYmm: -2 })
    expect(html).toContain('padding: 4mm 3mm 6mm 9mm')
    expect(alignmentDocument({ ...LQ, offsetXmm: 3 })).toContain('ALIGNMENT TEST')
  })

  it('escapes user text', () => {
    const html = slipDocument(financeDocSlip(org, { doc_type: 'bill', status: 'issued', total: 1, party_name: '<img src=x onerror=alert(1)>' }, []), LQ)
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })
})

describe('raw ESC/P slip', () => {
  it('fits the printable width: 80 columns at 10 cpi on a 9.5 in form', () => {
    const s = normalizeSlipSettings({ ...LQ, mode: 'raw' })
    expect(rawColumns(s)).toBe(80)
    expect(rawColumns({ ...s, cpi: 12 })).toBe(96) // LQ-310 limit: 8 in × 12 cpi
    for (const m of [feeReceiptSlip(receipt), donationSlip(org, { receipt_no: 'D1', amount: 500, fund_type: 'zakat', donor_name: 'A' }),
      payslipSlip(org, { staff_name: 'B', period: '2026-10', basic: 50000, earnings: [{ name: 'Allowance', amount: 5000 }], deductions: [{ name: 'EPF 8%', amount: 4000 }], gross: 55000, total_deductions: 4000, net: 51000 })]) {
      const lines = slipLines(m, s)
      for (const l of lines) expect(l.text.length * (l.wide ? 2 : 1)).toBeLessThanOrEqual(80)
    }
  })

  it('sets form length, line-drawing table and one form feed per slip', () => {
    const bytes = slipEscp([feeReceiptSlip(receipt), feeReceiptSlip(receipt)], { ...LQ, mode: 'raw' })
    const has = (seq) => bytes.join(',').includes(seq.join(','))
    expect(has([0x1b, 0x40])).toBe(true) // reset
    expect(has([0x1b, 0x43, 33])).toBe(true) // 5.5 in × 6 lpi = 33 lines
    expect(has([0x1b, 0x74, 0x01])).toBe(true) // PC437
    expect(bytes.includes(0xcd) && bytes.includes(0xc4)).toBe(true) // ═ and ─ rules
    expect(bytes.filter((b) => b === 0x0c).length).toBe(2)
    expect([...bytes].every((b) => b < 0x80 || b === 0xc4 || b === 0xcd)).toBe(true) // no stray UTF-8
  })

  it('falls back to plain ASCII rules', () => {
    const bytes = slipEscp(feeReceiptSlip(receipt), { ...LQ, mode: 'raw', boxChars: false })
    expect([...bytes].every((b) => b < 0x80)).toBe(true)
  })
})

describe('slip builders', () => {
  it('bill shows paid and balance; quotation shows validity', () => {
    const bill = financeDocSlip(org, { doc_type: 'bill', status: 'issued', doc_number: 'BIL-1', total: 5500, paid_amount: 2000, party_name: 'X' },
      [{ description: 'Hall', qty: 2, unit_amount: 1500, line_total: 3000 }])
    expect(bill.totals.map((t) => t.label)).toEqual(['TOTAL', 'Paid', 'BALANCE DUE'])
    expect(bill.totals[2].value).toBe('LKR 3,500.00')
    const q = financeDocSlip(org, { doc_type: 'quotation', status: 'issued', total: 10, valid_until: '2026-12-01', party_name: 'Y' }, [])
    expect(q.party.find((p) => p[0] === 'Valid until')[1]).toMatch(/2026/)
    expect(financeDocSlip(org, { doc_type: 'bill', status: 'void', total: 1 }, []).status).toBe('VOID')
  })

  it('vouchers carry payee signatures and status', () => {
    const v = expenseVoucherSlip(org, { expense_no: 'EXP-1', payee: 'Shop', amount: 1200, status: 'approved', submitted_by: 'u1' }, { u1: { full_name: 'Clerk' } })
    expect(v.status).toBe('NOT PAID')
    expect(v.signatures).toContain('Received by (payee)')
    expect(v.details.find((d) => d[0] === 'Requested by')[1]).toBe('Clerk')
    expect(pettyVoucherSlip(org, { id: 'abcdef12-0000', entry_type: 'expense', amount: 300, status: 'approved' }).number).toBe('PCV-ABCDEF12')
    expect(financePaymentSlip(org, { doc_type: 'bill', doc_number: 'B1', total: 100, paid_amount: 40 }, { receipt_no: 'R1', amount: 40 }).party[3][1]).toBe('LKR 60.00')
  })
})
