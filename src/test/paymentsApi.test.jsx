import { afterEach, describe, expect, it, vi } from 'vitest'

describe('paymentsApi', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('rejects checkout creation without a fee id', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')

    const { createPaymentCheckout } = await import('../lib/paymentsApi.js')

    await expect(createPaymentCheckout()).rejects.toThrow('Fee ID is required')
  })
})
