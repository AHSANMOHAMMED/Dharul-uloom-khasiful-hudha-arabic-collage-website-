# Gap Status Register

**Source:** [Kashiful_Hudha_Real_World_Gap_Analysis.md](../Kashiful_Hudha_Real_World_Gap_Analysis.md)  
**Companion logic:** [FEATURE_LOGIC_ANALYSIS.md](./FEATURE_LOGIC_ANALYSIS.md) · [PRIVACY_PDPA.md](./PRIVACY_PDPA.md) · [GO_LIVE.md](./GO_LIVE.md) · [OFFLINE_ATTENDANCE_SYNC.md](./OFFLINE_ATTENDANCE_SYNC.md) · [OPS_DRILLS.md](./OPS_DRILLS.md) · [POLICY_SIGN_OFF.md](./POLICY_SIGN_OFF.md) · [APP_COMPLETION_ROADMAP.md](./APP_COMPLETION_ROADMAP.md)  
**Updated:** 27 Nov 2026 — store-manager role allowlist/inventory authorization added (`0081`, `0085`); local database suite passed (510 RLS/ERP assertions + five business-logic suites).

Statuses: `Already implemented` · `Partial` · `Missing` · `Needs institutional policy` · `Deferred(P2)` · `Tested in staging`

**Production verification** stays blank until ops signs the drills in [OPS_DRILLS.md](./OPS_DRILLS.md). Do not treat “Already implemented” as production-ready without that column filled.

---

## P0 — Highest priority

| Item | Priority | Status | Evidence | Prod verified | Owner notes |
|------|----------|--------|----------|---------------|-------------|
| Tenant + role RLS helpers (`is_admin`, `current_org_id`, `mfa_ok`) | P0 | Already implemented | `0015`, `0023`, `0026`; `docs/SECURITY.md` | | Prove every table in ongoing tests |
| Cross-tenant / cross-user AuthZ tests | P0 | Partial | `rls_erp_test.sql` §20–22 passed in local disposable Postgres on 27 Nov 2026 (510 assertions total); storage/RPC coverage and staging proof remain ongoing | | Continue per release |
| Storage bucket AuthZ | P0 | Partial | `0004`, `0014`, `0031`, `0046`; pgTAP storage negatives | | Keep auditing new buckets |
| SECURITY DEFINER RPC caller checks | P0 | Partial | Fixed `search_path`; Edge `_shared/authz.ts`; `0068`/`0074` gates | | Continue per-RPC review |
| Break-glass emergency access | P0 | Partial (Needs institutional policy) | `0057` + `0067` + Super Admin; [POLICY_SIGN_OFF.md](./POLICY_SIGN_OFF.md) §2 | | Policy sign-off before production use |
| Privacy data inventory / PDPA readiness | P0 | Partial (Needs institutional policy) | `PRIVACY_PDPA.md` + `0058` + Org admin; [POLICY_SIGN_OFF.md](./POLICY_SIGN_OFF.md) §1 | | Counsel-certified defaults required |
| Student lifecycle state machine | P0 | Partial | `0073` + **`0074` `transition_admission_stage`** + crmApi; enroll via `enroll_admission` | | Applicant→offer graph coded; policy for exceptions |
| Guardian verification + unlink | P0 | Partial | `0041` + `0069` + UI; [POLICY_SIGN_OFF.md](./POLICY_SIGN_OFF.md) §3 | | Custody playbook = policy |
| Fee/payment idempotency (PayHere) | P0 | Already implemented | `apply_gateway_payment`, `payhere-notify` md5sig | | Keep webhook audit trail |
| PayHere checkout AuthZ + UX | P0 | Partial | `0054` + create-payment; [OPS_DRILLS.md](./OPS_DRILLS.md) §2 | | Live sandbox drill still open |
| Invoice credit / write-off / immutable lines | P0 | Already implemented | `0043` + **`0074` GL via `_post_invoice_lines_journal`; direct line INSERT revoked** + FeeInvoiceDetail RPCs | | — |
| Fee bank recon MVP | P0 | Partial | `0060` + **`0074` CSV import + `suggest_bank_matches`** + BankReconPanel | | Not full bank-feed API |
| Period lock | P0 | Already implemented | `books_locked_until`; tests §19 | | — |
| Exam publish lock | P0 | Already implemented | `0016` / `0028`, MarksEntry | | — |
| Post-publish result correction / appeals | P0 | Already implemented | `0042` + `0056` + **`0074` accept → draft `result_corrections`** + AppealsQueue | | Apply marks via existing correction RPC |
| Welfare confidential RLS | P0 | Already implemented | `0020`, WelfarePanel; [POLICY_SIGN_OFF.md](./POLICY_SIGN_OFF.md) §4 | | Escalation playbook = policy |
| Hostel occupancy + leave + emergency roll-call | P0 | Partial | `0055` + **`0074` escalations log** + HostelPanel contact attempts | | Warden drill still ops |
| Backup / restore / job monitoring | P0 | Partial | `0059` + Job runs UI; [OPS_DRILLS.md](./OPS_DRILLS.md) §1 | | Staging restore + RPO/RTO |

## P1 — Operational depth

| Item | Priority | Status | Evidence | Prod verified | Owner notes |
|------|----------|--------|----------|---------------|-------------|
| Payroll EPF/ETF + effective-dated APIT | P1 | Partial | `0061` + ApitTaxPanel **bracket validation** + pgTAP compute | | Confirm rates with HR/counsel |
| Attendance session exceptions | P1 | Already implemented | `0062`/`0068` + **`0074` `save_class_attendance_session`** + ClassAttendance | | Bulk upsert removed |
| Outbox quiet hours + Unicode cost preview | P1 | Already implemented | `0063` + `smsCost.js` on Admin + **platform BroadcastTab** | | — |
| Purpose-level consent | P1 | Partial | `0063` + **`0074` broadcast outbox `purpose=marketing`** + NotificationBell | | Marketing default off |
| Mobile offline sync contract | P1 | Already implemented | `0064` + **`0074` conflict (not LWW)** + mobile conflict queue + OFFLINE doc | | Attendance drafts only |
| EN/AR RTL + locale | P1 | Partial | `localeFormat.js`; `0070` preferred_locale; Arabic RTL shells | | Tamil linguistic review not claimed |
| Library copy circulation | P1 | Partial | `0065` + **`0074` renew + lost** + Librarian Circulation | | No holds/fines suite |
| LMS quiz lifecycle | P1 | Partial | `0066` + **`0074` max_attempts / time_limit** + Tutor/Student LMS panels | | Answer keys staff-only |

## P2 — Conditional expansion

| Item | Priority | Status | Evidence | Prod verified | Owner notes |
|------|----------|--------|----------|---------------|-------------|
| Meals / store inventory | P2 | Partial | `0081` + `0082` + `0084` + `0085`; `MessInventoryPanel`; `rls_erp_test.sql` §22 | | Basic meal and stock workflows; no approved procurement or catering budget policy |
| Procurement / fixed assets / transport | P2 | Deferred(P2) | — | | Service scope, approvals, and operational policies are not specified; confirm before implementation |
| SaaS subscription billing automation | P2 | Partial | `/platform` orgs + ACL | | Billing lifecycle Needs institutional policy |

---

## Phase deliverables

### Logic MVP (`0054`–`0066`) + hardening (`0067`–`0073`)

See prior register history for the `0054`–`0073` sprint. The authoritative migration chain must be applied through the latest checked-in migration (currently `0085`).

### P0/P1 logic sprint (`0074`)

| Deliverable | Path |
|-------------|------|
| Admissions stage RPC + guard | `0074` `transition_admission_stage`, stage trigger |
| Fee GL + immutable lines | `0074` credit/write-off + drop finance INSERT policy |
| Appeals → correction | `0074` `review_result_appeal` |
| Class attendance session | `0074` `save_class_attendance_session` |
| Hostel escalation log | `0074` `hostel_rollcall_escalations` |
| Bank CSV + suggest match | `0074` `import_bank_statement_lines`, `suggest_bank_matches` |
| Offline conflicts | `0074` `apply_offline_attendance_draft` |
| Library renew/lost | `0074` RPCs + Circulation UI |
| LMS retake/timer | `0074` quiz columns + start/submit |
| Broadcast purpose tag | `0074` `tg_notification_broadcast_outbox` |
| AuthZ negatives | `rls_erp_test.sql` §21 |

---

## Scorecard (engineering, not production)

| Priority | Already implemented | Partial | Missing / Deferred |
|----------|---------------------|---------|--------------------|
| P0 (17) | 8 | 9 | 0 Missing |
| P1 (8) | 4 | 4 | — |
| P2 | — | 2 (SaaS billing, meals/store inventory) | Procurement/assets/transport Deferred |

Trust for go-live: [MASTER_PRD.md](./MASTER_PRD.md) §2 + [APP_COMPLETION_ROADMAP.md](./APP_COMPLETION_ROADMAP.md) + [OPS_DRILLS.md](./OPS_DRILLS.md) + [POLICY_SIGN_OFF.md](./POLICY_SIGN_OFF.md). Ignore obsolete claims in root `PROJECT_SUMMARY.md`.
