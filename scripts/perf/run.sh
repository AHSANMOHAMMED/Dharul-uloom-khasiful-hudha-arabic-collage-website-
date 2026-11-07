#!/usr/bin/env bash
# Full latency test: scratch Postgres + all migrations + volume seed + PostgREST + load.
#   bash scripts/perf/run.sh [--concurrency 50] [--requests 2000]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NET=dukh-perf-net; DB=dukh-perf-db; API=dukh-perf-api
SECRET=perf-test-secret-perf-test-secret-123456
cleanup() { docker rm -f $API $DB >/dev/null 2>&1 || true; docker network rm $NET >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
docker network create $NET >/dev/null
docker run -d --name $DB --network $NET -e POSTGRES_PASSWORD=test -p 55440:5432 postgres:16 \
  -c max_connections=200 -c shared_buffers=256MB >/dev/null
URL=postgres://postgres:test@localhost:55440/postgres
for _ in $(seq 1 40); do psql "$URL" -c 'select 1' >/dev/null 2>&1 && break; sleep 1; done
TEST_DATABASE_URL=$URL bash "$ROOT/scripts/testDatabase.sh" >/dev/null
psql "$URL" -q -f "$ROOT/scripts/perf/seed.sql" >/dev/null
for m in 2027-01 2027-02 2027-03; do
  psql "$URL" -Atq -c "select public.generate_monthly_invoices('$m', public.default_org_id(), 5000)" >/dev/null
done
psql "$URL" -q <<SQL
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login password 'auth' noinherit;
  end if; end \$\$;
grant anon, authenticated, service_role to authenticator;
SQL
docker run -d --name $API --network $NET -p 3005:3000 \
  -e PGRST_DB_URI="postgres://authenticator:auth@$DB:5432/postgres" \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_DB_POOL=40 \
  -e PGRST_JWT_SECRET=$SECRET -e PGRST_JWT_AUD=authenticated \
  postgrest/postgrest:v12.2.3 >/dev/null
for _ in $(seq 1 30); do curl -sf localhost:3005/ >/dev/null 2>&1 && break; sleep 1; done
psql "$URL" -Atc "select 'invoices: ' || count(*) from student_fees; select 'attendance rows: ' || count(*) from attendance; select 'journal lines: ' || count(*) from journal_lines"
API_URL=http://localhost:3005 JWT_SECRET=$SECRET node "$ROOT/scripts/perf/loadTest.mjs" "$@"
