import { describe, expect, it, vi } from 'vitest';
import { CircuitBreaker, TtlCache, withRetry } from '../lib/resilience';

describe('resilience helpers', () => {
  it('withRetry retries transient errors and stops on 4xx errors', async () => {
    let attempts = 0;
    const ok = await withRetry(async () => {
      attempts += 1;
      if (attempts < 2) {
        const err = new Error('network timeout');
        err.status = 503;
        throw err;
      }
      return 'done';
    }, { retries: 2, baseDelayMs: 1, maxDelayMs: 5 });
    expect(ok).toBe('done');
    expect(attempts).toBe(2);

    const badReq = vi.fn(async () => {
      const err = new Error('Bad Request');
      err.status = 400;
      throw err;
    });
    await expect(withRetry(badReq, { retries: 2, baseDelayMs: 1 })).rejects.toThrow('Bad Request');
    expect(badReq).toHaveBeenCalledTimes(1);
  });

  it('CircuitBreaker opens after threshold failures and recovers after cooldown', async () => {
    const cb = new CircuitBreaker({ threshold: 2, cooldownMs: 20, name: 'test' });
    await expect(cb.exec(async () => { throw new Error('boom1'); })).rejects.toThrow('boom1');
    await expect(cb.exec(async () => { throw new Error('boom2'); })).rejects.toThrow('boom2');
    await expect(cb.exec(async () => 'ok')).rejects.toThrow(/circuit open/i);

    await new Promise((r) => setTimeout(r, 25));
    await expect(cb.exec(async () => 'recovered')).resolves.toBe('recovered');
    expect(cb.state).toBe('closed');
  });

  it('TtlCache caches values until expiry and bounds size', async () => {
    const cache = new TtlCache({ maxEntries: 2, defaultTtlMs: 50 });
    const loader = vi.fn(async () => 'v1');
    expect(await cache.getOrLoad('k1', loader)).toBe('v1');
    expect(await cache.getOrLoad('k1', loader)).toBe('v1');
    expect(loader).toHaveBeenCalledTimes(1);

    cache.set('k2', 'v2');
    cache.set('k3', 'v3');
    expect(cache.get('k1')).toBeUndefined();
    expect(cache.get('k3')).toBe('v3');
  });
});
