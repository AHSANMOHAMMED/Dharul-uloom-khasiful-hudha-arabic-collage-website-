# Performance, latency budget & load balancing

**Service objective: every API request should answer in under 10 seconds.** The
web and mobile clients now cancel requests at 9 seconds, leaving time to show an
error before the limit. A client timeout is not proof that the server completed
the operation within the objective; use the staging load test to verify the
actual backend and database path.

## 1. How the 10 s budget is enforced

| Layer | Limit | Where |
|---|---|---|
| Browser / mobile API calls | aborted after **9 s**, including response body parsing | `src/lib/supabaseClient.js`, `mobile/lib/supabase.js` (`global.fetch` with timeout) |
| Database statements | **8 s** for signed-in users, **5 s** anonymous | `alter role … set statement_timeout` (0021) |
| Edge functions → providers (SMS, e-mail, push, PayHere, Claude) | **8 s** per external call | `AbortSignal.timeout` / SDK `timeout: 8000` |
| Load balancer (self-hosted) | 3 s connect, 10 s read, retry another replica | `docker/nginx-lb.conf` |

Heavy jobs never run unbounded inside one request:

- **Monthly invoices** are generated in batches (`generate_monthly_invoices(..., p_limit)`, ~300 students ≈ 1 s per call); the UI/edge function loops and shows progress.
- **Outbox delivery** (SMS / WhatsApp / e-mail / push) is a background worker; rows are claimed with `FOR UPDATE SKIP LOCKED` so several workers can run in parallel without double-sending.
- **AI word meanings** are cached in `dictionary_entries` — only the first lookup of an unknown word calls the model (≤ 8 s); later lookups are a single indexed query.

## 2. Measured results

`npm run test:perf` — scratch Postgres + all migrations + a college with **2,000 students, 1,500 parents,
60 staff, 120,000 attendance rows, 6,000 invoices, 20,000 notifications**, served by PostgREST (the
API server Supabase uses) with real signed JWTs for parents, students, tutors and accountants.
These are repository-documented benchmark results; this remediation pass did not rerun them against
the current migration or a production-like Supabase deployment. Run the staging scenario after
applying all migrations before treating the values below as current evidence.

3,000 requests, 50 concurrent users:

| Endpoint | p50 | p95 | max |
|---|---|---|---|
| parent: my children / child fees / notifications | 20–24 ms | 52–65 ms | ≤ 430 ms |
| student: fee statement, arrears, attendance summary | 20–21 ms | 58–64 ms | ≤ 520 ms |
| tutor: class attendance sheet, student directory | 27–87 ms | 81–244 ms | ≤ 510 ms |
| reader: Arabic word lookup | 24 ms | 65 ms | 380 ms |
| accountant: outstanding, KPIs, trial balance | 44–66 ms | 98–211 ms | ≤ 615 ms |
| accountant: **receive payment** (write, 50 cashiers at once) | 550 ms | 2.2 s | 3.5 s |
| **All** (≈ 640 req/s, 0 errors) | **25 ms** | **246 ms** | **3.5 s** |

Receipts serialize on the per-college receipt number (gapless numbering is an audit requirement), so
the write path is the slowest under extreme concurrency — still far inside the budget.

Invoice generation for 2,000 students: ~3–6 s in one call; with batching each call is ~1 s.

## 3. Load balancing & scaling

| Tier | How it scales |
|---|---|
| Web app (static SPA) | Vercel global CDN (`vercel.json` caches `/assets/*` immutable). Self-hosted: `docker compose -f docker-compose.lb.yml up -d --scale frontend=3` — Nginx `least_conn` across replicas, health checks, automatic failover, per-IP rate limits (tested: requests spread 20/18/23 across 3 replicas; stopping one replica → 100 % success). |
| API (PostgREST / Auth / Realtime) | Supabase's managed load balancer. Enable **read replicas** (Dashboard → Database → Read replicas) — Supabase's API load balancer then routes GET requests across replicas automatically. |
| Database | Upgrade compute size as the institution grows; use the **Supavisor pooler** (transaction mode, port 6543) for scripts/workers (`scripts/*` accept `DATABASE_URL`). Indexes for every RLS/portal hot path are in 0021. |
| Edge functions | Stateless, autoscaled by Supabase; outbox workers are safe to run concurrently. |
| Mobile | Talks to the same Supabase endpoints; Realtime channels are RLS-filtered per user. |

## 4. Re-running

```bash
npm run test:perf                                     # 50 concurrent, 3,000 requests
bash scripts/perf/run.sh --concurrency 100 --requests 10000
P95_BUDGET_MS=1000 bash scripts/perf/run.sh           # stricter p95 gate
```
The script fails (exit 1) when any request exceeds 10 s, the p95 exceeds the budget, or any request errors.
