#!/usr/bin/env bash
# Apply every migration to a throwaway Postgres and run the RLS/ERP test suite.
#
#   TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/postgres npm run test:db
#
# Without TEST_DATABASE_URL a disposable docker container (postgres:16) is used.
# Refuses to run against a *.supabase.co host.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER=""

if [[ -z "${TEST_DATABASE_URL:-}" ]]; then
  CONTAINER="dukh-db-test-$$"
  docker run -d --rm --name "$CONTAINER" -e POSTGRES_PASSWORD=test -p 55439:5432 postgres:16 >/dev/null
  trap 'docker rm -f "$CONTAINER" >/dev/null 2>&1 || true' EXIT
  TEST_DATABASE_URL="postgres://postgres:test@localhost:55439/postgres"
  for _ in $(seq 1 40); do psql "$TEST_DATABASE_URL" -c 'select 1' >/dev/null 2>&1 && break; sleep 1; done
fi

if [[ "$TEST_DATABASE_URL" == *supabase.co* ]]; then
  echo "Refusing to run destructive tests against a Supabase-hosted database." >&2
  exit 1
fi

PSQL=(psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f "$ROOT/supabase/tests/bootstrap.sql"
for f in $(ls "$ROOT"/supabase/migrations/*.sql | sort); do
  base="$(basename "$f" .sql)"
  if [[ "${base%%_*}" == "0018" ]]; then
    "${PSQL[@]}" -f "$ROOT/supabase/tests/fixtures_pre_0018.sql"
  fi
  echo "== $base"
  "${PSQL[@]}" -f "$f" 2>&1 | grep -v NOTICE || true
  [[ ${PIPESTATUS[0]} -eq 0 ]] || { echo "Migration failed: $base" >&2; exit 1; }
done
"${PSQL[@]}" -f "$ROOT/supabase/tests/rls_erp_test.sql" 2>&1 | grep -E 'FAIL|passed|failed|^ +[0-9]+ \|' || true
"${PSQL[@]}" -At -c "select count(*) from tst.results where not ok" | grep -qx 0 && echo "DB TESTS PASSED" || { echo "DB TESTS FAILED" >&2; exit 1; }
