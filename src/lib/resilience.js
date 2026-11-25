/**
 * Client-side resilience primitives:
 * - Exponential backoff + jitter retries for transient failures
 * - Circuit breaker for failing upstream endpoints
 * - Bounded in-memory TTL cache for read-heavy public/reference data
 */

export function isTransientError(error) {
  if (!error) return false;
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return true;
  const status = error.status ?? error.code;
  if (typeof status === 'number') return status === 408 || status === 429 || status >= 500;
  const msg = String(error.message || error);
  return /network|fetch|timeout|econnreset|502|503|504|429/i.test(msg);
}

export async function withRetry(fn, { retries = 2, baseDelayMs = 250, maxDelayMs = 2500, shouldRetry = isTransientError } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) throw error;
      const exp = Math.min(maxDelayMs, baseDelayMs * (2 ** attempt));
      const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(exp * 0.25)));
      await new Promise((r) => setTimeout(r, exp + jitter));
    }
  }
}

export class CircuitBreaker {
  constructor({ threshold = 5, cooldownMs = 30_000, name = 'default' } = {}) {
    this.threshold = threshold;
    this.cooldownMs = cooldownMs;
    this.name = name;
    this.failures = 0;
    this.state = 'closed'; // closed | open | half_open
    this.openedAt = 0;
  }

  async exec(fn) {
    if (this.state === 'open') {
      if (Date.now() - this.openedAt < this.cooldownMs) {
        const err = new Error(`Service temporarily unavailable (${this.name} circuit open)`);
        err.code = 'CIRCUIT_OPEN';
        throw err;
      }
      this.state = 'half_open';
    }
    try {
      const result = await fn();
      this.failures = 0;
      this.state = 'closed';
      return result;
    } catch (error) {
      this.failures += 1;
      if (this.failures >= this.threshold || this.state === 'half_open') {
        this.state = 'open';
        this.openedAt = Date.now();
      }
      throw error;
    }
  }
}

export class TtlCache {
  constructor({ maxEntries = 100, defaultTtlMs = 60_000 } = {}) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
    this.store = new Map();
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return item.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    if (this.store.has(key)) this.store.delete(key);
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  async getOrLoad(key, loader, ttlMs = this.defaultTtlMs) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const loaded = await loader();
    this.set(key, loaded, ttlMs);
    return loaded;
  }

  clear(prefix = '') {
    if (!prefix) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (String(key).startsWith(prefix)) this.store.delete(key);
    }
  }
}
