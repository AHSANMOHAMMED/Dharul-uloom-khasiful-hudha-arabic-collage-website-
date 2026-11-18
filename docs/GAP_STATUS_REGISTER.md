# Gap Status Register

**Source:** [Kashiful_Hudha_Real_World_Gap_Analysis.md](../Kashiful_Hudha_Real_World_Gap_Analysis.md)  
**Companion logic:** [FEATURE_LOGIC_ANALYSIS.md](./FEATURE_LOGIC_ANALYSIS.md) · [PRIVACY_PDPA.md](./PRIVACY_PDPA.md) · [GO_LIVE.md](./GO_LIVE.md) · [OFFLINE_ATTENDANCE_SYNC.md](./OFFLINE_ATTENDANCE_SYNC.md)  
**Updated:** Finish P0 + P1 real-world logic MVP sprint

Statuses: `Already implemented` · `Partial` · `Missing` · `Needs institutional policy` · `Deferred(P2)` · `Tested in staging`

Production verification is blank until ops signs off a live drill.

---

## P0 — Highest priority

| Item | Priority | Status | Evidence | Owner notes |
|------|----------|--------|----------|-------------|
| Tenant + role RLS helpers (`is_admin`, `current_org_id`, `mfa_ok`) | P0 | Already implemented | `0015`, `0023`, `0026`; `docs/SECURITY.md` | Prove every table in ongoing tests |
| Cross-tenant / cross-user AuthZ tests | P0 | Partial | `supabase/tests/rls_erp_test.sql` expanded for new RPCs | Continue per release |
| Storage bucket AuthZ | P0 | Partial | `0004`, `0014`, `0031` policies; pgTAP negatives | Keep auditing new buckets |
| SECURITY DEFINER RPC caller checks | P0 | Partial | Most RPCs set `search_path`; Edge `_shared/authz.ts` | Continue per-RPC review |
| Break-glass emergency access | P0 | Partial (Needs institutional policy) | `0057_break_glass.sql` + Super Admin `BreakGlassPanel` | Policy sign-off before production use |
| Privacy data inventory / PDPA readiness | P0 | Partial (Needs institutional policy) | `PRIVACY_PDPA.md` + `0058_privacy_retention.sql` + Org admin panel | Editable days; no counsel-certified defaults |
| Student lifecycle state machine | P0 | Partial | `0040` + StudentDetail UI | Full applicant→offer still policy |
| Guardian verification + unlink | P0 | Partial | `0041` + StudentDetail/ParentDashboard | Custody playbook = policy |
| Fee/payment idempotency (PayHere) | P0 | Already implemented | `apply_gateway_payment`, `payhere-notify` md5sig | Keep webhook audit trail |
| PayHere checkout AuthZ + UX | P0 | Partial | `0054` + create-payment AuthZ/clients | Live sandbox drill still open |
| Invoice credit / write-off / immutable lines | P0 | Partial | `0043` + FeeInvoiceDetail | — |
| Fee bank recon MVP | P0 | Partial | `0060_bank_recon.sql` + Finance Hub Unmatched | Not full bank feed import |
| Period lock | P0 | Already implemented | `books_locked_until`; tests §19 | — |
| Exam publish lock | P0 | Already implemented | `0016` / `0028`, MarksEntry | — |
| Post-publish result correction / appeals | P0 | Partial | `0042` + `0056_result_appeals.sql` + MarksEntry AppealsQueue | — |
| Welfare confidential RLS | P0 | Already implemented | `0020`, WelfarePanel | Escalation playbook = policy |
| Hostel occupancy + leave + emergency roll-call | P0 | Partial | `0044` + `0055_hostel_rollcall.sql` + HostelPanel Emergency | — |
| Backup / restore / job monitoring | P0 | Partial | `0059_job_runs.sql` + Super Admin Job runs; `GO_LIVE.md` | Staging restore + RPO/RTO with college |

## P1 — Operational depth

| Item | Priority | Status | Evidence | Owner notes |
|------|----------|--------|----------|-------------|
| Payroll EPF/ETF + effective-dated APIT | P1 | Partial | `0028`/`0048` + `0061_payroll_apit_tables.sql` + Payroll APIT tab | Confirm rates with HR/counsel |
| Attendance session exceptions | P1 | Partial | `0062_attendance_exceptions.sql` + ClassAttendance correction | — |
| Outbox quiet hours + Unicode cost preview | P1 | Partial | `0063` quiet hours + `send-outbound`; `smsCost.js` in Admin broadcast | — |
| Purpose-level consent | P1 | Partial | `0063_notify_purposes.sql` + NotificationBell | Marketing default off |
| Mobile offline sync contract | P1 | Partial | `0064` + `OFFLINE_ATTENDANCE_SYNC.md` + `mobile/lib/offlineAttendance.js` | Attendance drafts only |
| EN/AR RTL + locale | P1 | Partial | `localeFormat.js`; Arabic `dir=rtl` shells | Tamil linguistic review not claimed |
| Library copy circulation | P1 | Partial | `0065_library_loans.sql` + Librarian Circulation tab | — |
| LMS quiz lifecycle | P1 | Partial | `0066_lms_quizzes.sql` + Tutor/Student LMS panels | Answer keys staff-only RLS |

## P2 — Conditional expansion

| Item | Priority | Status | Evidence | Owner notes |
|------|----------|--------|----------|-------------|
| Procurement / assets / catering / transport | P2 | Deferred(P2) | — | Only if institution operates them |
| SaaS subscription billing automation | P2 | Partial | `/platform` orgs + ACL | Billing lifecycle Needs institutional policy |

---

## Phase deliverables (this sprint)

| Deliverable | Migration / path |
|-------------|------------------|
| Hostel emergency roll-call | `0055_hostel_rollcall.sql` |
| Result appeals / resits | `0056_result_appeals.sql` |
| Break-glass access | `0057_break_glass.sql` |
| Privacy retention settings | `0058_privacy_retention.sql` |
| Job / cron monitoring | `0059_job_runs.sql` |
| Fee bank recon MVP | `0060_bank_recon.sql` |
| Effective-dated APIT | `0061_payroll_apit_tables.sql` |
| Attendance exceptions | `0062_attendance_exceptions.sql` |
| Quiet hours + purpose consent | `0063_notify_purposes.sql` |
| Offline attendance sync | `0064_offline_sync_queue.sql` |
| Library loans | `0065_library_loans.sql` |
| LMS quizzes | `0066_lms_quizzes.sql` |
| PayHere checkout hygiene | `0054` (shipped earlier) |
