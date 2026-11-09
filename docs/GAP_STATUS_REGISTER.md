# Gap Status Register

**Source:** [Kashiful_Hudha_Real_World_Gap_Analysis.md](../Kashiful_Hudha_Real_World_Gap_Analysis.md)  
**Companion logic:** [FEATURE_LOGIC_ANALYSIS.md](./FEATURE_LOGIC_ANALYSIS.md) · [PRIVACY_PDPA.md](./PRIVACY_PDPA.md) · [GO_LIVE.md](./GO_LIVE.md)  
**Updated:** Phase 0 + Phase 1 P0 closure sprint

Statuses: `Already implemented` · `Partial` · `Missing` · `Needs institutional policy` · `Tested in staging`

Production verification is blank until ops signs off a live drill.

---

## P0 — Highest priority

| Item | Priority | Status | Evidence | Owner notes |
|------|----------|--------|----------|-------------|
| Tenant + role RLS helpers (`is_admin`, `current_org_id`, `mfa_ok`) | P0 | Already implemented | `0015`, `0023`, `0026`; `docs/SECURITY.md` | Prove every table in ongoing tests |
| Cross-tenant / cross-user AuthZ tests | P0 | Partial | `supabase/tests/rls_erp_test.sql` | Expanded in P0/P1 for storage, period lock, lifecycle |
| Storage bucket AuthZ | P0 | Partial | `0004`, `0014`, `0031` policies; pgTAP negatives added | Keep auditing new buckets |
| SECURITY DEFINER RPC caller checks | P0 | Partial | Most RPCs set `search_path`; Edge `_shared/authz.ts` | Continue per-RPC review |
| Break-glass emergency access | P0 | Missing | — | Needs institutional policy + design |
| Privacy data inventory / PDPA readiness | P0 | Partial | `docs/PRIVACY_PDPA.md` template | Legal review = Needs institutional policy |
| Student lifecycle state machine | P0 | Partial | `0040_student_lifecycle.sql` + StudentDetail UI | Full applicant→offer machine still policy |
| Guardian verification + unlink | P0 | Partial | `0041_guardian_relationship.sql` + StudentDetail/ParentDashboard | Custody playbook = policy |
| Fee/payment idempotency (PayHere) | P0 | Already implemented | `apply_gateway_payment`, `payhere-notify` md5sig | Keep webhook audit trail |
| Invoice credit / write-off / immutable lines | P0 | Partial | `0043_fee_adjustments.sql` + FeeInvoiceDetail | Bank recon still Phase 2 |
| Period lock | P0 | Already implemented | `books_locked_until`; tests in `rls_erp_test.sql` §19 | Run `npm run test:db` when Docker available |
| Exam publish lock | P0 | Already implemented | `0016` / `0028`, MarksEntry | — |
| Post-publish result correction audit | P0 | Partial | `0042_result_corrections.sql` + MarksEntry | Appeals/resits still Missing |
| Welfare confidential RLS | P0 | Already implemented | `0020`, WelfarePanel | Escalation playbook = policy |
| Hostel occupancy + leave safety | P0 | Partial | `0044_hostel_leave.sql` + HostelPanel leave tab | Full emergency roll-call still Missing |
| Backup / restore / job monitoring | P0 | Partial | `docs/GO_LIVE.md` restore drill | Run staging restore; set RPO/RTO with college |

## P1 — Operational depth

| Item | Priority | Status | Evidence | Owner notes |
|------|----------|--------|----------|-------------|
| Payroll EPF/ETF | P1 | Partial | `0028` statutory calc, org settings | Effective-dated APIT = Missing |
| Attendance session exceptions | P1 | Partial | attendance + leave | Offline sync = Missing |
| Outbox per-recipient delivery | P1 | Already implemented | `0012`, `0022`, `send-outbound` | Quiet hours / Unicode cost = Missing |
| Consent / notify preferences | P1 | Partial | `profiles.notify_*` | Purpose-level consent = policy |
| Mobile offline sync contract | P1 | Missing | Documented as future in FEATURE_LOGIC | Do not invent client-only authority |
| EN/AR/TA RTL + locale | P1 | Partial | i18n wired | Tamil linguistic review pending |
| Library copy circulation | P1 | Missing | Catalog/reader only | Phase 2 |
| LMS quiz lifecycle | P1 | Partial | assignments/submissions | Quizzes thin |

## P2 — Conditional expansion

| Item | Priority | Status | Evidence | Owner notes |
|------|----------|--------|----------|-------------|
| Procurement / assets / catering / transport | P2 | Missing | — | Only if institution operates them |
| SaaS subscription billing automation | P2 | Partial | `/platform` orgs + ACL | Billing lifecycle Needs institutional policy |

---

## Phase 1 deliverables (this sprint)

| Deliverable | Migration / path |
|-------------|------------------|
| Student lifecycle events + RPC | `0040_student_lifecycle.sql` |
| Guardian status / permissions / unlink | `0041_guardian_relationship.sql` |
| Result corrections | `0042_result_corrections.sql` |
| Fee adjustments | `0043_fee_adjustments.sql` |
| Hostel overnight leave | `0044_hostel_leave.sql` |
| Privacy + restore docs | `PRIVACY_PDPA.md`, `GO_LIVE.md` |
