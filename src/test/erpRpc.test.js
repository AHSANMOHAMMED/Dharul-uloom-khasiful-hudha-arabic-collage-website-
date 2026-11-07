import { afterEach, describe, expect, it, vi } from 'vitest'

describe('erp rpc helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.resetModules()
    vi.doUnmock('../lib/supabaseClient')
  })

  it('formats LKR money with two decimals', async () => {
    const { formatMoney } = await import('../lib/erp/rpc.js')
    expect(formatMoney(2500)).toBe('LKR 2,500.00')
    expect(formatMoney('1234.5')).toBe('LKR 1,234.50')
    expect(formatMoney(null)).toBe('LKR 0.00')
  })

  it('throws a clear error when Supabase is not configured', async () => {
    vi.doMock('../lib/supabaseClient', () => ({ supabase: null, isSupabaseConfigured: false }))
    const { rpc } = await import('../lib/erp/rpc.js')
    await expect(rpc('record_fee_payment')).rejects.toThrow(/not configured/)
  })

  it('maps permission errors from the database to a friendly message', async () => {
    vi.doMock('../lib/supabaseClient', () => ({
      isSupabaseConfigured: true,
      supabase: {
        rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'forbidden' } }),
      },
    }))
    const { rpc, ErpError } = await import('../lib/erp/rpc.js')
    const call = rpc('reverse_fee_payment', { p_payment: 'x', p_reason: 'y' })
    await expect(call).rejects.toBeInstanceOf(ErpError)
    await expect(rpc('reverse_fee_payment')).rejects.toThrow('You do not have permission for this action.')
  })

  it('passes ledger validation messages through unchanged', async () => {
    vi.doMock('../lib/supabaseClient', () => ({
      isSupabaseConfigured: true,
      supabase: {
        rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', message: 'Amount 99999.00 exceeds outstanding balance 2500.00' } }),
      },
    }))
    const { rpc } = await import('../lib/erp/rpc.js')
    await expect(rpc('record_fee_payment')).rejects.toThrow('exceeds outstanding balance')
  })

  it('returns RPC data on success', async () => {
    vi.doMock('../lib/supabaseClient', () => ({
      isSupabaseConfigured: true,
      supabase: { rpc: vi.fn().mockResolvedValue({ data: { receipt_no: 'KH-RCP-2026-000001' }, error: null }) },
    }))
    const { rpc } = await import('../lib/erp/rpc.js')
    await expect(rpc('record_fee_payment', {})).resolves.toEqual({ receipt_no: 'KH-RCP-2026-000001' })
  })
})
