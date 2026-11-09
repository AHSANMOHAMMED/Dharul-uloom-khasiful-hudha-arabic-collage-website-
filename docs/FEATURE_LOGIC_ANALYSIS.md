# Feature Logic Analysis (single source)

**Institution:** Dhārul Ulūm Kashiful Hudāhā Arabic College  
**Purpose:** One document for **what exists**, **how it works**, **who sees it**, and **how to extend it** without breaking the official look or security model.  
**Stack:** Vite/React SPA + Expo mobile → Supabase (Auth / Postgres / RLS / Storage / Edge) → Vercel  
**Companions:** [MASTER_PRD.md](./MASTER_PRD.md) · [PLATFORM_GUIDE.md](./PLATFORM_GUIDE.md) · [ROLE_RLS_MATRIX.md](./ROLE_RLS_MATRIX.md) · [SECURITY.md](./SECURITY.md) · [FINANCE_HUB.md](./FINANCE_HUB.md) · [ERP_IMPLEMENTATION.md](./ERP_IMPLEMENTATION.md)

> Prefer this file when you need product + logic. Architecture summary that previously lived only in `ARCHITECTURE_ANALYSIS.md` is folded in here.

---

## 1. Product in one sentence

A **multi-tenant college platform**: public bilingual site + role portals + full campus ERP + digital library + payments/messaging — **one Supabase project**, thin web/mobile clients, RLS as the real gate.

```text
Public site  →  /dashboard role portals  →  /erp staff modules  →  /admin · /platform
     │                    │                      │                    │
     └────────── same Auth JWT + org_id + RLS ───┴────────────────────┘
```

---

## 2. Official visual system (one look for every role)

All authenticated workspaces share **Modern Manuscript** — not per-role rainbow themes.

| Token | Value | Use |
|-------|-------|-----|
| Parchment | `#FBF8F0` | Page background (`DashboardSidebarLayout`, AppShell dashboards) |
| Paper | `#FFFFFF` | Panels / cards |
| Sand border | `#E8E1D0` | Dividers, inputs |
| Ink green | `#0B3B2E` | Primary text, brand headers |
| Emerald | `#11694A` | Actions, active nav, academic accents |
| Brass | `#C29A3A` | Finance / admissions accents only |
| Mint wash | `#E3F1EA` | Soft emerald chips |
| Gold wash | `#FEF9EE` | Soft brass chips |

**Role chrome (badges only — not whole-page themes):**

| Badge | Roles |
|-------|--------|
| `ROLE_BADGE.emerald` | Principal, VP, HR, Warden, Counselor, Tutor, Student, Librarian, most academic |
| `ROLE_BADGE.brass` | Treasurer, Accountant, Admissions, Exam Officer, Parent |
| `ROLE_BADGE.admin` | Admin / Super Admin ink pill |

Source: `src/lib/roleTheme.js`. Portals import this; do not invent new hex themes per role.

**Embed bridge:** `main.erp-theme` (sidebar layout) remaps legacy `gray-*` / dark utility classes inside ERP panels to parchment/ink so embedded modules keep the official light look (`src/index.css`).

**Sign out rule:** exactly **one** Sign out control per workspace — sticky **header** of `DashboardSidebarLayout` (or Super Admin header). Sidebar footer = profile + language only. Never add a second logout inside portal banners or legacy dashboards.

---

## 3. Auth & routing logic

### 3.1 Identity flow

```text
Supabase Auth sign-in
  → profiles row (handle_new_user)
  → AuthContext merges session + profile + staff hats
  → is_approved gate (students/tutors)
  → MFA gate on protected routes (MfaGate)
  → FeatureFlagsProvider (org + role + user ACL)
```

### 3.2 Where users land

| Condition | Destination |
|-----------|-------------|
| `admin` / `super_admin` | `/admin` (college) · `/platform` (SaaS) |
| Multi-hat staff | `/dashboard?view=<hat>` via `UserDashboard` + `RoleSwitcher` |
| Single staff hat | Matching `*Portal` or Tutor/Librarian dashboard |
| Student / parent | `StudentDashboard` / `ParentDashboard` |
| Non-teaching employee | `/erp` |
| Public | Marketing routes; Navbar/Footer shown |

Workspace routes hide public Navbar/Footer (`DASHBOARD_ROUTES` in `App.jsx`).

### 3.3 Staff hats vs leadership

Duty hats (`accountant`, `hr_manager`, `admissions_officer`, `warden`, `counselor`, `exam_officer`) must use **`hasRole('…')`**, not loose `isAccountant`-style helpers that also return true for admins — otherwise leadership wrongly multi-routes into duty portals (`UserDashboard` comment + logic).

### 3.4 Feature flags

UI menus check `enabled(featureKey)`. **Database RLS/RPC still enforces access.** Keys map ERP modules via `ERP_MODULE_FEATURES` (`platformApi`). Super Admin toggles global / org / role / user overrides on `/platform`.

---

## 4. Portal shell architecture (best logic)

### 4.1 Shared shell

```text
RolePortalShell
  → DashboardSidebarLayout (nav, header, single Sign out, erp-theme main)
  → PortalNavProvider (goTab / goErpModule)
  → OverviewBanner (home only)
  → PortalTabChrome + ErpEmbedProvider
  → lazy ERP panel or custom render
```

Tab state lives in `?tab=` (`useTabParam`) so Back/Forward, refresh, and shared links work.

### 4.2 Overview tile → full module (not preview)

`ErpDashboard` KPI tiles call `portalNav.goErpModule(module)`:

1. If current portal has a matching tab → **switch tab** (scroll top).  
2. Else if already on `/erp` → set `?module=`.  
3. Else → navigate `/erp?module=…`.

Admin mirrors this with `ERP_TILE_TO_TAB` + `openTab` inside `AdminDashboard` so overview clicks open full admin tabs, never stacked mini-previews.

Map (portal): `src/components/portals/RolePortalShell.jsx` → `ERP_MODULE_TO_TAB`.

### 4.3 Role portals (web)

| Portal file | Hats | Typical tabs |
|-------------|------|----------------|
| `PrincipalPortal` | principal, VP | overview, academics, timetable, students, staff, fees, expenses, donations, payroll, CRM, hostel, welfare, certificates, duties, reports |
| `TreasurerPortal` | treasurer | overview, finance hub, fees, accounting, cheques, expenses, donations, today, analytics… |
| `AccountantPortal` | accountant | finance-focused embeds |
| `HrPortal` | hr_manager | staff, leave, payroll, self |
| `AdmissionsPortal` | admissions_officer | pipeline, enrolment, invitations |
| `WardenPortal` | warden | hostel, discipline, welfare |
| `CounselorPortal` | counselor | welfare, students |
| `ExamPortal` | exam_officer | exams, marks, report cards, documents |
| `AdminDashboard` | admin | CMS + approvals + full ERP embeds as tabs |
| Student / Parent / Tutor / Librarian | dedicated dashboards using same sidebar layout |

Legacy `PrincipalDashboard.jsx` / `TreasurerDashboard.jsx` are **not** the live entry path (routing uses portals). Prefer portals + ERP embeds for new work.

### 4.4 ERP workspace (`/erp`)

Module list in `ErpWorkspace.jsx`: filtered by auth helpers **and** feature flags. Groups: Workspace · Governance · Academic · Finance · People · Campus · Admin. Super Admin “acting org” banner exits via `setActingOrg(null)`.

---

## 5. Feature map (what the product does)

### A. Public site & CMS — live

Home, About, Courses, Curriculum, Faculty, Gallery, News, Admissions form, Contact, Library browse/reader. Admin CMS tabs. EN / AR / TA.

### B. Auth & accounts — live

Register paths, login, forgot/reset, approvals, parent invite + `request_child_link` RPC, org invitations, MFA (`/account`), password policy.

### C. Student portal — live

Attendance, results, fees + PayHere, receipts/arrears, LMS panel, staff query chat.

### D. Parent portal — live

Linked children, fees, leave requests, grades, link-ward flow.

### E. Tutor / faculty — live

Attendance, leaves, LMS materials/assignments, salary visibility (as permitted).

### F. Finance — live

Fee structures → monthly invoices → cash/bank/PayHere → partial payments → receipts → arrears → cheques → donations/expenses → accounting journals → Finance Hub (billing jobs, quotations, WA/SMS pay links). See [FINANCE_HUB.md](./FINANCE_HUB.md).

### G. Payroll & HR — live

Staff HR, salary profiles, payroll runs, payslips (EPF/ETF), advances, staff leave/attendance, self-service.

### H. Academics & exams — live

Years/terms, subjects, enrolments, timetable, attendance, exams/marks/report cards, secure exam-paper workflow.

### I. LMS — foundation live

Materials, assignments, submissions (guards against self-grade abuse). Quizzes/discussion still thin vs full LMS.

### J. Library — live

Catalog FTS, reader, bookmarks/notes, librarian admin, Shamela import path, Arabic–Tamil dictionary + `translate-word`.

### K. Hostel / welfare / discipline / certificates — live

Allocations, cases, certificate issue + `/verify/:code`.

### L. Governance — live

Duties, Mashoora, tasks, petty cash, activities.

### M. Messaging — live

Notification bell, `/messages` chat, outbox (SMS / email / WhatsApp / push), broadcast RPCs, daily reminders.

### N. Documents — live

Letterheads, A4 editor, versioning, exam-paper chain (assign → draft → IT → approve → print → release).

### O. Platform / SaaS — live

`/platform`: organizations, users, feature ACL, communities, audit; acting-org into college ERP.

### P. Mobile (Expo) — live parity expanded

Same backend/RLS. Role homes + finance hub, platform controls, donations/expenses/cheques, library, tutor LMS, welfare create/notes/status, payments deep links (`kashifulhudha://`).

---

## 6. Backend logic model

There is **no production Express API** for the SPA. Backend = Postgres + RLS + RPCs + triggers + Edge Functions.

| Layer | Responsibility |
|-------|----------------|
| Tables | Source of truth (`org_id` tenancy) |
| RLS | Every private row |
| RPCs | Business rules (fees, payroll, links, reports, Finance Hub) |
| Triggers | Guards (profile, LMS, payslips, notifications → outbox) |
| Edge | Secrets, PayHere, PDF, outbound, cron fees, AI word |

**Legacy `backend/`** (Express/Mongo) is deprecated — do not extend.

### Critical money flow

```text
PayFeeButton → create-payment (JWT)
  → PayHere (or payment-checkout HMAC)
  → payhere-notify (signature + merchant)
  → apply_gateway_payment (idempotent)
  → fee_receipts + notify channels
```

### Parent link flow

```text
request_child_link(index)
  → auto-link if admission contact matches
  → else staff approval queue
  (no free attach to arbitrary students)
```

---

## 7. Web ↔ mobile parity logic

| Domain | Web | Mobile |
|--------|-----|--------|
| Auth / MFA / pending | ✅ | ✅ |
| Student fees / results / attendance | ✅ | ✅ |
| Parent children / leave / fees | ✅ | ✅ |
| Tutor LMS / attendance | ✅ | ✅ |
| Finance Hub / donations / expenses / cheques | ✅ ERP + portals | ✅ staff routes |
| Platform ACL / communities | ✅ `/platform` | ✅ `platform.jsx` |
| Library reader / catalog | ✅ | ✅ |
| Full CMS / document editor | ✅ | Limited / link-out |
| Dense Recharts ERP overview | ✅ | KPI lists / screens |

Parity rule: **same RPCs and tables**; mobile may use simpler UI but must not invent a second permission model.

---

## 8. Known gaps & polish backlog (honest)

Track verifiable status in [GAP_STATUS_REGISTER.md](./GAP_STATUS_REGISTER.md) — do not treat “listed in a portal” as production-verified.

Still open after Phase 1 P0:

1. **Legacy dashboards** (`PrincipalDashboard`, `TreasurerDashboard`) — unused entry path; prefer portals.  
2. **ERP panel token migration** — `.erp-theme` bridge; gradual cleanup.  
3. **LMS quizzes / discussion** — foundation only.  
4. **Bank reconciliation / budgeting UI** — Partial.  
5. **Ops integrations** — PayHere live E2E, Twilio/Resend/Expo crons, EAS IDs.  
6. **Exam appeals / resits** — Missing (corrections closed in P0).  
7. **Hostel emergency roll-call** — Missing (overnight leave closed in P0).  
8. **APIT / effective-dated payroll tables** — Missing.  
9. **Mobile offline sync** — Missing (see §11.8).

---

## 9. How to add a feature (correct path)

1. **Schema:** new migration + `org_id` + RLS (+ `apply_mfa_policy` where required).  
2. **Logic:** prefer RPC over client-side multi-step writes for money/identity.  
3. **UI:** embed panel under `/erp` **and** add a portal tab if a hat needs day-to-day access.  
4. **Navigation:** extend `ERP_MODULE_TO_TAB` / `ERP_TILE_TO_TAB` so overview tiles open the full module.  
5. **Flags:** register feature key; map in `ERP_MODULE_FEATURES` if ERP-gated.  
6. **Mobile:** Expo screen calling the same RPC; wire role “more” menus.  
7. **Chrome:** `DashboardSidebarLayout` / `RolePortalShell` only — one Sign out, parchment bg, emerald/brass badge.  
8. **Verify:** `npm run lint` · `npm run build` · targeted tests · `npm run test:db` for RLS/finance.

---

## 10. Mental model

> **One official look** (parchment + ink + emerald + brass accents).  
> **One Sign out** (header).  
> **One backend** (Supabase).  
> **Portals** = role-shaped day work; **`/erp`** = full institutional surface; **`/platform`** = SaaS control plane.  
> **UI hides; RLS decides.**

---

## 11. Operational rulebook (Phase 0 / P0)

Statuses: see [GAP_STATUS_REGISTER.md](./GAP_STATUS_REGISTER.md). Privacy: [PRIVACY_PDPA.md](./PRIVACY_PDPA.md). Ops: [GO_LIVE.md](./GO_LIVE.md).

### 11.1 Student lifecycle state machine

Canonical record statuses on `student_details.status`: `active`, `suspended`, `graduated`, `withdrawn`, `transferred`, `alumni`.

**Audited transitions** via `transition_student_status` → `student_lifecycle_events` (never delete the student to mean exit):

| From | To | Who |
|------|----|-----|
| active | suspended / withdrawn / transferred / graduated | principal, VP, admin |
| suspended | active / withdrawn | principal, VP, admin |
| withdrawn / transferred / graduated | (no auto reverse) | Requires new policy decision |

Side effects on withdraw/transfer: end open hostel allocations. Fee cancel/credit is a separate finance RPC (do not auto-void paid receipts).

### 11.2 Guardian relationship model

- Links live in `parent_children` with `status` (`active`|`revoked`), category `permissions`, verification/revoke metadata.
- `request_child_link`: auto-link only when a **single** admission contact match; ambiguous matches → staff review queue.
- `unlink_child` revokes future access; history retained.
- Parent RLS reads require `status = 'active'`.

### 11.3 Permission matrix (summary)

| Layer | Rule |
|-------|------|
| Tenant | `org_id` / `current_org_id()` — never trust client org alone |
| Role/hat | staff helpers + duties; UI RoleSwitcher is navigation only |
| Relationship | tutor↔class, parent↔active child, counselor↔assigned case |
| Record state | published results locked; books period lock; confidential welfare |
| Approval | payroll maker≠checker; result correction apply path; finance adjustments audited |
| MFA | `mfa_ok()` on privileged helpers |

### 11.4 Financial invariants

- Invoice line amounts are not silently rewritten after issue; use `fee_adjustments` / credit / write-off RPCs.
- One PayHere payment ID applied at most once (`apply_gateway_payment`).
- Browser return URL is not authority — notify_url + md5sig is.
- Posted journals balance; reverse/adjust, do not delete.
- `books_locked_until` blocks posting in locked periods.

### 11.5 Assessment / result lifecycle

`draft → scheduled → marking → published`. After publish, tutors cannot edit marks; controlled path = `result_corrections` + `apply_result_correction`. Appeals/resits = Missing (Phase 2).

### 11.6 Safeguarding / confidentiality

Welfare cases: `is_confidential`, assignee, `is_welfare_staff()`. Do not put case detail in SMS/push. Escalation routes = Needs institutional policy. Hostel overnight leave tracked in `hostel_leave_passes`; emergency roll-call UI still Missing.

### 11.7 Privacy register and retention

See [PRIVACY_PDPA.md](./PRIVACY_PDPA.md). Legal basis and retention numbers require college counsel before 1 Jan 2027 PDPA commencement provisions.

### 11.8 Offline / mobile sync contract

**Authoritative server required** for: payments, result publish/correction, role changes, welfare case closure, guardian link/unlink, fee adjustments.  
**Future (Phase 2):** attendance draft offline with idempotency keys — not implemented. Never last-write-wins for marks/fees/safeguarding.

### 11.9 Outbox delivery contract

Per-recipient rows: queued → processing → accepted/delivered/failed (see messaging migrations). Consent: `profiles.notify_*`. Quiet hours / Unicode segment cost preview = Missing.

### 11.10 Operational readiness

Backup/restore drill and job owners: [GO_LIVE.md](./GO_LIVE.md). Set RPO/RTO with college management. A backup never restored is unproven.

### 11.11 Tenant SaaS lifecycle

`/platform` provisions orgs, ACL, acting-org. Subscription suspension must not erase academic/financial history — Needs institutional policy for export/grace read-only.

### 11.12 Acceptance test catalogue

| Scenario (gap MD §16) | Automated / UAT |
|-----------------------|-----------------|
| Ambiguous parent phone → no auto-link | `test:db` + `0041` |
| Guardian unlink revokes access | `test:db` unlink |
| Triple PayHere callback | existing `apply_gateway_payment` tests |
| Wrong amount callback rejected | payhere-notify + RPC |
| Edit marks after publish blocked | `0042` + MarksEntry |
| Withdraw preserves history | `0040` + `test:db` |
| Cross-tenant org_id change | existing RLS suite |
| Storage wrong parent denied | `test:db` storage negatives |
| Hostel leave overdue visible | `0044` UI + RPC |
| Tamil/Arabic broadcast cost | UAT (Missing automation) |
| Production restore drill | GO_LIVE checklist (ops) |

---

*Updated for P0 gap closure (lifecycle, guardians, result corrections, fee adjustments, hostel leave) and operational rulebook. Evidence: GAP_STATUS_REGISTER.md.*

