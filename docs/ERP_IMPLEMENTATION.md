# ERP / HRM / CRM / Accounting / SaaS — implementation & audit report

Companion to [MASTER_PRD.md](./MASTER_PRD.md), [PLATFORM_GUIDE.md](./PLATFORM_GUIDE.md) and
[ROLE_RLS_MATRIX.md](./ROLE_RLS_MATRIX.md). Describes what was audited, what was fixed,
what was added (migrations 0015–0020, edge functions, `/erp` web workspace, mobile app),
and how to verify it.

---

## 1. Audit findings (fixed)

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | Critical | `profiles: update own` had no column guard — any user could `update profiles set role='admin', is_approved=true`. | `tg_profiles_guard` trigger: only admins change role/approval/class/org fields; admins can't grant `super_admin` or change their own role (0015). |
| 2 | Critical | Sign-up trusted client metadata; a hard-coded e-mail became admin on sign-up; students could register with any index (verification was client-side only). | `handle_new_user` rewritten: whitelist account types, index validated + locked in SQL, class/org taken from the index record, invitations applied, auto-admin removed. |
| 3 | Critical | `is_tutor()`/`is_treasurer()` ignored `is_approved` → an unapproved "tutor" sign-up could read/write attendance, results, leaves. | Helpers require approval; new `has_staff_role()` model. |
| 4 | Critical | `parent_children: parent insert own` let any parent link to **any** student (grades, fees, attendance). | Policy dropped; `request_child_link` auto-links only on verified admission contact, otherwise queues `parent_link_requests` for staff review. |
| 5 | Critical | PayHere webhook not idempotent (retries double-credited fees), didn't check merchant/amount; checkout hash case wrong. | `apply_gateway_payment()` (row lock, duplicate no-op, amount/currency check, ledger post); webhook verifies merchant + uppercase MD5 (constant-time); checkout hash per PayHere spec. |
| 6 | Critical | `send-email` (no JWT) accepted any recipient — open e-mail relay. | Anonymous calls can only notify the college inbox (plain text, size-limited); custom recipients need service role/admin. |
| 7 | High | `enqueue_user_messages`, `notify_*` callable by any user (SMS/e-mail spam, forged notices). | Internal-only / authorization-checked wrappers. |
| 8 | High | Students could grade their own LMS submissions (`with check (true)`). | `tg_lms_submission_guard`. |
| 9 | High | Librarians had full admin power via `is_staff()` (fees, approvals, roles). | `is_staff()` = admin; library policies rebuilt on `is_library_staff()`. |
| 10 | High | Any org admin could edit every `organizations` row. | Own-org update only; subscription fields super-admin only. |
| 11 | High | Tutor/treasurer/principal dashboards couldn't read student profiles (empty lists); principal approval update was blocked by RLS. | `profiles: org directory` policy; `approve_account` RPC. |
| 12 | High | Parent "link by index" was broken (parents can't read student profiles). | `request_child_link` RPC wired into ParentDashboard. |
| 13 | Medium | Admin "fee reminder" used a non-existent supabase-js API (`.insert().onConflict().ignore()`). | Calls `generate_monthly_invoices`. |
| 14 | Medium | `20240730000000_create_books_table.sql` broke every fresh deploy (`relation "books" already exists`) and carried a `USING (true)` policy. | Neutralised (no-op) + stray policies dropped. |
| 15 | Medium | Fee ledger was a mutable JSON array; no receipts numbering, reversals, accounting. | Immutable `fee_payments` + double-entry ledger (0017/0018). |
| 16 | Medium | Non-teaching staff and guests were stuck on "Loading your dashboard…". | Staff → `/erp`; guest landing card. |

## 2. What was added

### Database (all tenant-scoped, RLS-enforced, audited)

| Migration | Modules |
|---|---|
| `0015_security_tenancy` | role helpers, SaaS tenancy (`org_id` + restrictive isolation on every tenant table), org invitations, parent link requests, account approval, audit log, document numbering |
| `0016_academics` | academic years/terms, subjects, class-subject-teacher, student records, enrolments + promotion, exams (publish workflow), grade scales, report cards, attendance summaries |
| `0017_accounting` | chart of accounts (seeded per org), immutable balanced journals, period lock, expenses (submit → approve → pay), donations (zakat/sadaqah/waqf/sponsorship…), trial balance, income statement, balance sheet, ledger |
| `0018_student_finance` | fee categories/structures, concessions, invoice lines, receipts ledger, reversals, waivers, cancellations, monthly invoice generator, gateway settlement, statements, outstanding & collection reports, legacy backfill |
| `0019_payroll_hrm` | employee records, salary profiles/components, payroll runs/payslips (EPF 8%/12%, ETF 3% configurable via `organizations.settings.payroll`), unpaid-leave deductions, advances + recovery, staff attendance (check-in/out), leave types/requests/balances |
| `0020_campus_services_saas` | hostel (capacity, billed monthly), discipline (parents notified on major), welfare cases, certificates + public verification, document requests, CRM follow-ups/sources/dashboard, SaaS tenant creation/suspension/plan limits, KPI dashboards |

Accounting postings: invoice line → Dr 1200 / Cr income (4100…); receipt → Dr 1000/1010/1020 / Cr 1200 (overpayment → 2300);
discount/waiver → Dr 5700; payroll approval → Dr 5100+5110 / Cr 2100, 2200, 2210, 1300, 2000; salary payment → Dr 2100 / Cr bank;
expense → Dr expense / Cr cash|bank; donation → Dr cash|bank / Cr 42xx.

### Edge functions

| Function | Change |
|---|---|
| `create-payment` | org-aware authorization, PayHere-spec hash, `client: 'mobile'` → `hosted_checkout_url` |
| `payment-checkout` (new, no JWT) | HMAC-signed auto-submitting PayHere form for the mobile in-app browser |
| `payhere-notify` | merchant + signature check, delegates to idempotent `apply_gateway_payment` |
| `generate-monthly-fees` | cron (service role) → all active orgs; staff JWT → caller's org via `generate_monthly_invoices` |
| `send-email` | open-relay fix |
| `send-outbound` | admin/super-admin or service role only |

### Web

- `/erp` — ERP workspace (`src/pages/erp/ErpWorkspace.jsx`): role-filtered modules for overview KPIs,
  self-service, students, academics & exams, admissions CRM, fees, accounting, expenses, donations,
  payroll, HR, hostel, discipline & welfare, certificates, audit log, SaaS platform.
  Shared kit: `src/components/erp/ui.jsx`, data helpers: `src/lib/erp/rpc.js`.
- `/verify/:code` — public certificate verification.
- Existing dashboards fixed: parent linking, principal approvals, treasurer receipts (ledger RPC),
  admin invoice generation, payment return pages deep-link back to the mobile app,
  Navbar ERP entry, librarian access, SaaS-aware sign-up (`?org=` / `VITE_ORG_SLUG`) and public content.

### Mobile

See [mobile/README.md](../mobile/README.md): role-based Expo Router app (student, parent, tutor/staff,
admin/finance lite), EN/AR, PayHere via hosted checkout + deep links.

## 3. Verification

```bash
npm run lint          # ESLint, 0 warnings
npm run build         # Vite production build
npm test              # Vitest unit tests
npm run test:db       # all migrations on a scratch Postgres + 135 RLS/ERP assertions
deno check supabase/functions/*/index.ts
cd mobile && npx expo export --platform android   # bundles every mobile route
```

CI (`.github/workflows/ci.yml`) runs frontend, backend, **database** and **edge-function** jobs.

## 4. Deployment order (production)

1. Back up the database. Run `npm run test:db` locally.
2. Apply migrations 0015–0020 together (`supabase db push --include-all` if the CLI complains about ordering).
3. **Immediately** deploy all edge functions (old `payhere-notify` writes fee rows directly and would now be rejected).
4. Set secrets: `PAYHERE_*`, `SITE_URL`, `TWILIO_*`, `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_NOTIFY_TO`.
5. Deploy the web app (set `VITE_ORG_SLUG`), then build the mobile app with EAS.
6. Promote the first admin / super admin (see [GO_LIVE.md](./GO_LIVE.md)) and configure academic year, fee structures, salary profiles, and staff invitations in `/erp`.

## 5. Languages, tenancy, push (completed follow-ups)

| Item | How it works |
|---|---|
| **Tamil (ta)** | Web: `src/locales/ta.json` (1,478 strings, keyed by the English text) loaded on demand; `tx(ar, en)` (`src/lib/tx.js`) and the ERP `t(en, ar)` return Tamil when the UI language is `ta`; keyed strings in `src/i18n.js`; selector EN / العربية / தமிழ் in the navbar; Noto Sans Tamil font. Mobile: `ta` dictionary (350 keys) in `mobile/lib/i18n.js`, selectable in Settings / login. **Machine-translated — have a native Sri Lankan Tamil speaker review before launch.** |
| Keeping Tamil complete | New bilingual code: write `tx('عربي', 'English')` (or ERP `t('English', 'عربي')`), then `node scripts/i18n/extractStrings.mjs --missing` lists untranslated strings (`src/test/tamil.test.js` fails CI while any are missing). `node scripts/i18n/codemodTx.mjs` converts old `ar ? '…' : '…'` literals. |
| Tutors per class | `tutor_can_teach_student()`: tutors write attendance, marks and leave reviews only for classes they teach (`class_subjects.tutor_id` or timetable). A class with **no** teacher assignments stays open to all tutors (bootstrap). |
| Multi-tenant public site | `src/lib/siteOrg.js` resolves the institution per request: `?org=slug` → `organizations.custom_domain` = hostname → `<slug>.VITE_PLATFORM_DOMAIN` → `VITE_ORG_SLUG`. Public content and sign-ups follow it, so one deployment can serve every college. |
| Native push | App registers its Expo token (`register_push_token`); trigger `trg_notifications_push` fans every notification out to `message_outbox` (`push`); `send-outbound` delivers via the Expo push API (optional `EXPO_ACCESS_TOKEN`). Respects `profiles.notify_push`. |
| Payment crypto tests | `supabase/functions/_shared/payhere_test.ts` checks checkout hash, notify signature, HMAC links against independently computed vectors (`deno test`, in CI). |

| Receipts & arrears | `receive_student_payment` → one numbered receipt, allocated to the oldest open month first; each month's remaining balance and the student's total arrears are snapshotted on the receipt. Printed slip, PDF (`receipt-pdf`), app screen and SMS all render that one snapshot. |
| Payment notifications | Student + every linked parent/guardian: in-app + native push (deep link to the receipt) + SMS/WhatsApp (masked sender, student name, month(s), balance, arrears, receipt link) + e-mail with the PDF attached; guardian phone fallback. |
| Live app | Supabase Realtime on notifications, fees, receipts, attendance, leave, payslips. |
| Arabic → Tamil reader | `dictionary_entries` + `lookup_arabic_word` (tashkeel/alef normalisation, clitic & suffix stripping, root fallback); `translate-word` adds context-aware AI meanings, cached as unverified. |
| Performance | See [PERFORMANCE.md](./PERFORMANCE.md) — 10 s budget enforced at client, DB, edge and LB; load-tested. |

## 6. Still manual (needs your accounts)

- PayHere **sandbox** end-to-end on a real phone (merchant ID/secret + `SITE_URL`), then live keys.
- `eas init` (sets `extra.eas.projectId`) and an EAS build — required for push tokens and store releases.
- Schedule `send-outbound` (e.g. every 5 minutes) and `generate-monthly-fees` (`0 2 1 * *`).
- DNS for custom domains / wildcard sub-domains → the Vercel project; set `organizations.custom_domain`.
- Native-speaker review of the Tamil strings.
