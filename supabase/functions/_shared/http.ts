// Shared HTTP, CORS, request-ID, structured logging, and rate-limit helpers
// for Supabase Edge Functions.

export function getRequestId(req: Request): string {
  const incoming = req.headers.get('x-request-id')?.trim();
  if (incoming && /^[A-Za-z0-9._-]{8,64}$/.test(incoming)) return incoming;
  return crypto.randomUUID();
}

export function clientIpOf(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

function parseAllowedOrigins(): string[] {
  const raw = [
    Deno.env.get('ALLOWED_ORIGINS') || '',
    Deno.env.get('SITE_URL') || '',
  ]
    .join(',')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (Deno.env.get('ENVIRONMENT') !== 'production') {
    raw.push('http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000');
  }
  return [...new Set(raw)];
}

export function corsHeadersFor(req: Request, extraHeaders = 'authorization, x-client-info, apikey, content-type, x-request-id'): Record<string, string> {
  const allowed = parseAllowedOrigins();
  const origin = req.headers.get('origin')?.replace(/\/$/, '') || '';
  let allowOrigin = '*';
  if (allowed.length > 0) {
    allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
  }
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': extraHeaders,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export function jsonResponse(
  req: Request,
  requestId: string,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeadersFor(req),
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
    },
  });
}

export function logJson(
  level: 'info' | 'warn' | 'error',
  fn: string,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    fn,
    event,
    ...fields,
  });
  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.log(entry);
}

// Per-isolate sliding-window rate limiter (defence-in-depth alongside DB quotas / LB).
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= limit) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }
  entry.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}
