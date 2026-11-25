// supabase/functions/health/index.ts
// Public uptime & readiness probe: verifies Postgres/PostgREST reachability.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeadersFor, getRequestId, jsonResponse, logJson } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const requestId = getRequestId(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeadersFor(req), 'X-Request-ID': requestId } });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return jsonResponse(req, requestId, { error: 'Method not allowed' }, 405);
  }

  const started = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    logJson('error', 'health', 'missing_env', { requestId });
    return jsonResponse(req, requestId, { ok: false, status: 'misconfigured', requestId }, 503);
  }

  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(4000) }) },
    });
    const { error } = await admin.from('organizations').select('id').limit(1);
    const latencyMs = Date.now() - started;
    if (error) {
      logJson('error', 'health', 'db_check_failed', { requestId, latencyMs, error: error.message });
      return jsonResponse(req, requestId, { ok: false, status: 'degraded', requestId, latencyMs }, 503);
    }
    logJson('info', 'health', 'ok', { requestId, latencyMs, status: 200 });
    return jsonResponse(
      req,
      requestId,
      { ok: true, status: 'healthy', requestId, latencyMs, timestamp: new Date().toISOString() },
      200,
    );
  } catch (err) {
    const latencyMs = Date.now() - started;
    logJson('error', 'health', 'exception', { requestId, latencyMs, error: (err as Error).message });
    return jsonResponse(req, requestId, { ok: false, status: 'unhealthy', requestId, latencyMs }, 503);
  }
});
