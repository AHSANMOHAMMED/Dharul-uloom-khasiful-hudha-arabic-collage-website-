# Application completion roadmap

**Purpose:** Stage-gated path from repository code to production acceptance.  
**Not a README duplicate.** College overview and setup live in [../README.md](../README.md).  
**Track item-level engineering status in** [GAP_STATUS_REGISTER.md](./GAP_STATUS_REGISTER.md).  
**Ops evidence:** [OPS_DRILLS.md](./OPS_DRILLS.md) · **Policy evidence:** [POLICY_SIGN_OFF.md](./POLICY_SIGN_OFF.md).

Keep stages marked **Not verified** until acceptance checks pass in **staging**. Security-sensitive work must be proven at the database and Edge Function layer, not only in the UI.

## Latest local verification (not staging acceptance)

As of 27 Nov 2026, `npm test` passed (26 files / 143 tests), `npm run lint`,
`npm run build`, and `npm run test:db` passed. The database suite applied all
checked-in migrations to a disposable local Postgres database, passed 510 RLS/ERP
assertions, and passed all five business-logic suites. These results validate the
local checked-in scope only. `deno check supabase/functions/*/index.ts` and
`deno test supabase/functions/_shared/` also passed (10 functions checked; 15
shared tests). These results do not complete policy-dependent requirements or
staging/production acceptance, so the stage statuses below remain **Not verified**.

---

## Stages

| Stage | Work | Acceptance checks | Status |
|---|---|---|---|
| **1. Reliable baseline** | Staging Supabase project; backup before schema changes; record migration head; lockfiles committed; characterization/`npm run test:db` baseline | Clean install, documented staging target, verified backup | Not verified |
| **2. Auth & roles** | Profile/role escalation denied; MFA gate; approved staff; parent/student scopes | pgTAP positive **and** negative role tests (see `supabase/tests/rls_erp_test.sql`) | Not verified |
| **3. Migrations** | Single authoritative migration path through the latest checked-in migration (currently `0085`); demo vs production data separated | Clean DB setup and upgrade of a representative DB without data loss | Not verified |
| **4. College workflows** | Registration, approval, admissions, guardian link/unlink, attendance, leave, results, schedules, admin CMS | E2E authorized + denied paths for key roles | Not verified |
| **5. LMS & library** | Materials, assignments, grading, loans/circulation, Arabic search, reader privacy | Unauthorized users cannot access protected records/files | Not verified |
| **6. Payments** | PayHere signing, idempotent notify, AuthZ on checkout, credits/recon awareness | [OPS_DRILLS.md](./OPS_DRILLS.md) §2 sandbox matrix Pass | Not verified |
| **7. Public UX / i18n** | Public facts, EN/AR RTL, Tamil review as claimed, a11y/mobile | Agreed desktop/mobile checks recorded | Not verified |
| **8. Release & operations** | CI green; secrets; storage; functions; monitoring; restore drill; UAT | [OPS_DRILLS.md](./OPS_DRILLS.md) §1 Pass; [GO_LIVE.md](./GO_LIVE.md) checklist approved | Not verified |

---

## Mapping to gap priorities

| Roadmap stage | Primary gap-register themes |
|---------------|----------------------------|
| 1–2, 8 | AuthZ proof, backup/restore, job monitoring |
| 3–4 | Student lifecycle, guardians, hostel roll-call |
| 5 | Library loans, LMS quizzes |
| 6 | PayHere checkout, fee credits, bank recon |
| 7 | Locale / RTL |
| Policy (parallel) | PDPA, break-glass, custody, welfare — [POLICY_SIGN_OFF.md](./POLICY_SIGN_OFF.md) |

**Recommendation (from gap analysis):** Finish P0 rules and verification before expanding P2 modules (procurement, assets, catering, transport).

---

## Definition of done (launch)

A stage is complete only when its acceptance checks have been **run and recorded**. Before launch require:

- Reproducible install, lint, production build, Vitest, and `npm run test:db`
- Database AuthZ tests for permitted **and** denied actions (including new RPCs this release)
- Staging migration + restore rehearsal with agreed RPO/RTO ([OPS_DRILLS.md](./OPS_DRILLS.md))
- PayHere sandbox evidence (success, failure, duplicate notify)
- Institutional policy sign-offs where the register says Needs institutional policy
- College UAT for principal, finance, tutor, student, and parent paths
- Production secrets reviewed; no service-role keys in `VITE_*` or mobile bundles

---

## Architecture reminder

- **Primary:** Vite frontend + Supabase Auth/Postgres/Storage/Edge Functions (+ Expo `mobile/`)
- **Legacy:** `backend/` Express/MongoDB is deprecated — do not deploy as a second production API
- **Obsolete claims:** Root [PROJECT_SUMMARY.md](../PROJECT_SUMMARY.md) is marked obsolete; do not use it for go-live

When a stage passes staging, change its Status from **Not verified** to **Verified (date, environment)** in this file and fill matching **Prod verified** cells in the gap register after production drills.
