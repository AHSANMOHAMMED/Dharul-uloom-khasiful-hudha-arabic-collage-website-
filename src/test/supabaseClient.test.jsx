import { afterEach, describe, expect, it, vi } from 'vitest'

describe('supabase client bootstrap', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('does not create a client when env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    const { isSupabaseConfigured, supabase } = await import('../lib/supabaseClient.js')

    expect(isSupabaseConfigured).toBe(false)
    expect(supabase).toBeNull()
  })
})
