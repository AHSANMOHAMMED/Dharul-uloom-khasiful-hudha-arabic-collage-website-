# Go-live execution (full plan)

Code for the complete platform plan is in this repo. These steps apply it to **your** Supabase + Vercel + PayHere accounts.

> **Credential boundary:** repository validation is complete, but Supabase, Vercel,
> PayHere, notification-provider, and Expo/EAS account operations require credentials
> owned by the deployment operator. Never commit those values or place service-role
> keys in the frontend or mobile bundle.

## Required account-bound release steps

Run these steps from an authenticated deployment machine. Replace every placeholder
with a value from the relevant provider; do not add the resulting secrets to git.

```bash
# Supabase migrations and Edge Functions
supabase login
supabase link --project-ref YOUR_SUPABASE_PROJECT_REF
supabase db push
cp .env.example .env
# Fill .env with production values, then:
npm run deploy:functions

# EAS project registration and mobile credentials
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init
# Copy the generated projectId into mobile/app.json.
npx eas-cli@latest secret:create --scope project --name SUPABASE_URL --value "$VITE_SUPABASE_URL"
npx eas-cli@latest secret:create --scope project --name SUPABASE_ANON_KEY --value "$VITE_SUPABASE_ANON_KEY"
# Requires `eas login` (or EXPO_TOKEN). Preview APK includes Super Admin /platform
# control plane sections and staff Finance Hub (/finance-hub).
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile production --platform android
```

`mobile/app.json` intentionally retains a visible EAS project-ID placeholder until
`eas init` is run by the owner of the EAS account. A generated or guessed ID would
make builds point at the wrong project.

## 1. Supabase

```bash
# Login once
supabase login

# Link this folder to your project
supabase link --project-ref YOUR_PROJECT_REF

# 0. Back up production first (Dashboard → Database → Backups) and run the
#    full suite locally: npm run test:db   (must print "DB TESTS PASSED")

# Apply all migrations (0001–0022). 0015–0022 must be appliedied in one go and the
# edge functions below deployed IMMEDIATELY after: 0018 makes student_fees
# paid_amount ledger-controlled, so the OLD payhere-notify would fail.
# NOTE: the stray 20240730000000 file is now a no-op; if the CLI complains that
# local migrations sort before the last remote one, use:
supabase db push --include-all

# Deploy edge functions (payment-checkout is new: mobile hosted checkout)
supabase functions deploy create-payment
supabase functions deploy payment-checkout --no-verify-jwt
supabase functions deploy payhere-notify --no-verify-jwt
supabase functions deploy generate-monthly-fees
supabase functions deploy send-outbound --no-verify-jwt
supabase functions deploy send-email --no-verify-jwt
supabase functions deploy receipt-pdf --no-verify-jwt     # receipt PDF by secret link
supabase functions deploy translate-word --no-verify-jwt  # Arabic → Tamil word meanings (AI only for signed-in users)

# Secrets (Dashboard → Edge Functions → Secrets)
# PAYHERE_MERCHANT_ID, PAYHERE_MERCHANT_SECRET, PAYHERE_SANDBOX
# SITE_URL, TWILIO_*, WHATSAPP_FROM, RESEND_API_KEY, MAIL_FROM, MAIL_NOTIFY_TO
```

Schedule monthly fees: Dashboard schedule **or** cron `0 2 1 * *` on `generate-monthly-fees`.
Schedule `send-outbound` every 5 minutes (drains SMS / WhatsApp / e-mail / **native push**).
Optional secret `EXPO_ACCESS_TOKEN` (Expo push security).

**SMS with the college name as sender (masking).** Register a sender ID (e.g. `KASHIFHUDHA`) with a
Sri Lankan gateway, then set secrets:
`SMS_PROVIDER=notifylk` + `NOTIFYLK_USER_ID`, `NOTIFYLK_API_KEY` — or `SMS_PROVIDER=textlk` + `TEXTLK_API_TOKEN`
(or keep Twilio). Per college, in SQL / Org settings:
```sql
update organizations set settings = settings || '{"sms_sender_id":"KASHIFHUDHA","short_name":"Kashiful Hudha","registration_no":"MRCA/13/1/PAS/187"}'
where slug = 'kashiful-hudha';
```
Payment SMS example: *"Kashiful Hudha: Payment received for Ahmad Abdullah (KASHIF-2026-001). November 2026: LKR 3,000.00
(balance LKR 2,000.00). Total LKR 3,000.00 by cash. Total arrears now LKR 2,000.00. Receipt KH-RCP-2026-000123. https://…/r/…"*
— the link opens the exact receipt and its PDF; e-mails carry the PDF as an attachment; parents with the app get a push that opens the receipt.

**Word meanings (Shamela reader).** Optional secret `ANTHROPIC_API_KEY` enables AI meanings for words not in the
dictionary (cached, marked "unverified" until a librarian verifies them). Import a **licensed** Arabic–Tamil
word list with `node scripts/library/importDictionary.mjs words.csv` (do not copy al-Munjid or other
copyrighted dictionaries without permission).

**Realtime.** Migration 0021 adds the portal tables to the `supabase_realtime` publication (live updates in the app). Mobile: run `eas init` once so push tokens work.

SaaS hosting: either one Vercel project per college (`VITE_ORG_SLUG`), or one project for all with
`VITE_PLATFORM_DOMAIN=yourplatform.lk` + wildcard DNS (`*.yourplatform.lk`) and/or each college's
own domain stored in `organizations.custom_domain`.

Promote first admin (SQL editor — runs as postgres, so the profile guard allows it).
The old auto-admin e-mail (`admin@kashifulhudha.lk`) has been removed from the
sign-up trigger; promote explicitly:

```sql
update public.profiles set role = 'admin', is_approved = true where email = 'you@example.com';
-- SaaS operator account (can create institutions in /erp → SaaS Platform):
update public.profiles set role = 'super_admin', is_approved = true where email = 'operator@example.com';
```

Then, in **/erp**: create the academic year, subjects, fee structures (Fees → Setup),
salary profiles (Payroll), and invite staff by e-mail (Admissions CRM → Invitations)
with their role (treasurer, accountant, hr_manager, principal, warden …).

## 2. Vercel frontend

```bash
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

npm install
npm run build
vercel --prod
# Also set the same VITE_* env vars in Vercel Project Settings
```

## 3. Full Shamela import (DigitalOcean or local)

See `scripts/shamela/do-worker-readme.md`. Requires `SHAMELA_API_KEY` + service role.

```bash
npm run import:shamela -- --limit 50   # smoke
npm run import:shamela -- --concurrency 4
```

## 4. Mobile

```bash
cd mobile
cp .env.example .env   # fill EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo start
```

Seed every portal / duty-role demo account plus sample fees, timetable, results, LMS and hostel data (service role only; no DIRECT_URL needed):

```bash
npm run setup:production-demo
```

## 5. Smoke checklist

- [ ] Login / register / approve student → parent activation alert
- [ ] CRM enroll → invite token → parent claim
- [ ] Treasurer / PayHere sandbox → receipt print + SMS/WhatsApp outbox
- [ ] Generate monthly fees → parent notify
- [ ] Library search + librarian CSV export
- [ ] Staff HRM + document upload
- [ ] Notification bell prefs + optional push
- [ ] Admin Organization branding tab
- [ ] /erp: generate invoices → record cash receipt → receipt number `KH-RCP-…`
- [ ] Reverse a receipt (accountant) → invoice back to unpaid, journal reversal posted
- [ ] Accounting → Reports: trial balance debits = credits, balance sheet "balanced"
- [ ] Payroll: generate (HR) → approve (accountant, different person) → pay (treasurer) → staff sees payslip
- [ ] Expense claim (tutor) → approve → pay
- [ ] Publish exam → student/parent see results + report card
- [ ] Issue certificate → open /verify/<code> logged out
- [ ] Mobile: parent pays fee via PayHere sandbox → returns to app → invoice completed
- [ ] Second tenant (super admin → create organization) sees none of college A's data
- [ ] Switch language to தமிழ் on web and mobile; ERP, portals and public pages show Tamil
- [ ] Tutor assigned to class 3 can mark class 3 but not class 4 (once class 4 has its own teacher)
- [ ] Phone receives a native push when an invoice is generated
- [ ] Accountant: ERP → Fees → Receive payment: 3,000 against a 5,000 month → receipt shows 2,000 arrears; parent gets SMS (masked sender, student name, month), push opens the receipt, PDF downloads, printed slip matches
- [ ] Reader: tap an Arabic word in a Shamela text page → Tamil meaning
- [ ] `npm run test:perf` passes (max < 10 s)

## Blockers without your secrets

| Item | Needs |
|------|--------|
| `supabase db push` | Logged-in CLI + project ref |
| Edge deploy | Same |
| Live SMS/WhatsApp | Twilio secrets |
| Live email | Resend API key |
| Full Shamela | SHAMELA_API_KEY |
| PayHere live | Merchant ID/secret |
| Store publish | Apple/Google accounts |
| Mobile production build | Run `eas init` and replace the placeholder project ID in `mobile/app.json` |

## Production safety gates

Before enabling real payments or opening registration:

1. Deploy to a staging Vercel project first with staging Supabase credentials.
2. Run `npm ci`, `npm run lint`, `npm run build`, `npm test`, `npm run test:db`,
   `deno check supabase/functions/*/index.ts`, and the edge-function tests.
3. Configure `SITE_URL` to the canonical HTTPS origin. Payment creation now fails
   closed when this value is missing or malformed; it never falls back to localhost.
4. Confirm PayHere sandbox checkout, webhook retries, duplicate webhook delivery,
   cancellation, receipt PDF access, and receipt reversal.
5. Verify the outbox worker is running and monitor failed/retrying messages.
6. Confirm a second organization cannot read the first organization's data.
7. Take a Supabase backup before each migration batch and record the migration
   version and deployed edge-function versions.
8. Keep the previous Vercel deployment available for instant rollback. If a
   migration has already changed the database contract, roll back the frontend
   and edge functions only after checking compatibility with the deployed schema.

## Backup, restore drill, and recovery targets

A backup that has never been restored is an unproven recovery plan.

| Field | Value (set with college management) |
|-------|-------------------------------------|
| RPO (max acceptable data loss) | _e.g. 24h — confirm_ |
| RTO (max acceptable recovery time) | _e.g. 8h — confirm_ |
| Supabase plan / PITR | _record plan_ |
| Off-site dump owner | _name_ |
| Last successful restore drill | _date / staging project_ |

### Restore checklist (staging)

1. Record production migration version and Edge Function versions.  
2. `supabase db dump` (or plan backup) **and** export required Storage buckets (DB dump alone does not restore student documents).  
3. Store encrypted backup off the production project with restricted access.  
4. Restore into a **separate** staging project.  
5. Validate: one student, one fee receipt, one parent link, one published result, one library/cover object if used.  
6. Log duration, data-loss window, failures, and sign-off.  
7. Before each migration batch in production, take a backup and note version (see safety gates above).

### Scheduled job owners

| Job | Schedule / trigger | Idempotent? | Alert when | Owner |
|-----|--------------------|-------------|------------|-------|
| `generate-monthly-fees` | Cron / staff | Must not double-invoice | Failure / timeout | Finance |
| `send-outbound` | Worker / cron | Per-row claim | Stuck queued / high fail | IT |
| `run_daily_reminders` | Cron | Yes | Missed day | IT |
| PayHere notify | Gateway POST | `apply_gateway_payment` | Rejected / unmatched | Finance + IT |

## Monitoring and rollback

Monitor these signals after release:

- Supabase database errors, statement timeouts, connection pool saturation, and
  authentication failures.
- Edge-function 4xx/5xx rates and latency, especially payment and notification
  functions.
- Pending, failed, and retrying outbox rows.
- PayHere transaction records that remain `pending` beyond the gateway window.
- Vercel build status, runtime errors, and frontend asset failures.
- Mobile crash reports, push-token registration failures, and deep-link returns.

Do not place service-role keys, PayHere secrets, provider tokens, or EAS secrets
in the repository, browser environment, mobile bundle, or chat. Store them only
in Supabase Edge Function secrets, Vercel encrypted environment variables, or
EAS secrets.
