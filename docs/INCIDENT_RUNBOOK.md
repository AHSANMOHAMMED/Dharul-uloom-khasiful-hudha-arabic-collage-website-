# Incident Runbook & 3am Operations Guide

## 1. Health Checks & Uptime Monitoring
- **Web / Reverse Proxy**: `GET /healthz` (Nginx load balancer in `docker/nginx-lb.conf` returns `200 ok\n`).
- **API & Database Readiness**: `GET <SUPABASE_URL>/functions/v1/health` (`supabase/functions/health/index.ts`) verifies Postgres/PostgREST connectivity under a 4s timeout and returns `{ ok, status, requestId, latencyMs, timestamp }`.
- **Recommended External Uptime Monitor**: Point UptimeRobot / BetterStack / Pingdom at both the public homepage and `/functions/v1/health` at 1–5 minute intervals, alerting on non-200 responses or latency > 3000 ms.

## 2. Structured Logs, Request IDs & p95 Latency
- Every browser request via `src/lib/supabaseClient.js` attaches an `x-request-id` UUID header.
- Edge Functions propagate `X-Request-ID` in responses and emit structured JSON logs (`ts`, `level`, `fn`, `event`, `requestId`, `durationMs`, `status`) via `supabase/functions/_shared/http.ts`.
- Filter Supabase Edge Function logs by `requestId` to trace a user-reported failure end-to-end, or aggregate `latencyMs` / `durationMs` to track p95 latency and error spikes.

## 3. CORS & Rate Limiting
- Set `ALLOWED_ORIGINS` (comma-separated) or `SITE_URL` in Supabase Edge Function secrets so `corsHeadersFor()` restricts browser origins in production.
- Public/expensive Edge Functions (`translate-word`, `create-payment`, `send-email`, `receipt-pdf`, `platform-user-admin`) enforce per-IP sliding-window rate limits (`429 Too Many Requests`), complementing Nginx `limit_req` (`30r/s`) and DB quotas (`consume_ai_quota`).

## 4. Rollbacks & Recovery
- **Frontend (Vercel)**: Open **Vercel Dashboard → Deployments → previous green deployment → Promote to Production** (one-click instant rollback).
- **Self-hosted Docker**: Re-pull the previous immutable image tag in `docker-compose.lb.yml` and run `docker compose -f docker-compose.lb.yml up -d`.
- **Database**: Never run destructive `DROP` migrations in production. Write a forward-fix migration (`supabase/migrations/NNNN_*.sql`) and apply via `npm run db:apply`, or restore from Supabase Point-in-Time Recovery (PITR) if data corruption occurred.

## 5. Deployment Discipline
- **No Friday Deploys**: Avoid non-emergency production releases on Fridays or before holidays.
- **Pre-deploy Gate**: Confirm all CI jobs (`frontend`, `mobile`, `database`, `edge-functions`, `security`) are green before promoting.
