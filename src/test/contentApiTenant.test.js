import { afterEach, describe, expect, it, vi } from 'vitest'

/** Minimal thenable query-builder mock (mirrors supabase-js semantics). */
function makeClient(log, rows) {
  const builder = (table) => {
    const q = {
      table,
      calls: [],
      select(...a) { this.calls.push(['select', ...a]); return this },
      eq(...a) { this.calls.push(['eq', ...a]); return this },
      in(...a) { this.calls.push(['in', ...a]); return this },
      order(...a) { this.calls.push(['order', ...a]); return this },
      maybeSingle() { this.calls.push(['maybeSingle']); return this },
      then(resolve, reject) {
        log.push({ table, calls: this.calls })
        const data = table === 'organizations' ? { id: 'org-1' } : rows
        return Promise.resolve({ data, error: null }).then(resolve, reject)
      },
    }
    return q
  }
  return { from: vi.fn(builder) }
}

describe('contentApi tenant scoping', () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('../lib/supabaseClient')
  })

  it('filters public news by the site organization and keeps ordering', async () => {
    const log = []
    const client = makeClient(log, [{ id: 'n1', title_en: 'Hello', date: '2026-01-01' }])
    vi.doMock('../lib/supabaseClient', () => ({ supabase: client, isSupabaseConfigured: true }))
    const { listNews } = await import('../lib/contentApi.js')

    const news = await listNews()

    expect(news).toHaveLength(1)
    const newsQuery = log.find((l) => l.table === 'news')
    expect(newsQuery.calls).toContainEqual(['eq', 'org_id', 'org-1'])
    expect(newsQuery.calls).toContainEqual(['order', 'date', { ascending: false }])
    // the query must execute exactly once, after ordering was applied
    expect(log.filter((l) => l.table === 'news')).toHaveLength(1)
  })
})
