# Go-live execution (full plan)

Code for the complete platform plan is in this repo. These steps apply it to **your** Supabase + Vercel + PayHere accounts.

## 1. Supabase

```bash
# Login once
supabase login

# Link this folder to your project
supabase link --project-ref YOUR_PROJECT_REF

# 0. Back up production first (Dashboard → Database → Backups) and run the
#    full suite locally: npm run test:db   (must print "DB TESTS PASSED")

# Apply all migrations (0001–0020). 0015–0020 must be applied in one go and the
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
# EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo start
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
