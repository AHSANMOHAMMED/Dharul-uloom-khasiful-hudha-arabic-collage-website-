# Go-live execution (full plan)

Code for the complete platform plan is in this repo. These steps apply it to **your** Supabase + Vercel + PayHere accounts.

## 1. Supabase

```bash
# Login once
supabase login

# Link this folder to your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply all migrations (0001–0014)
supabase db push

# Deploy edge functions
supabase functions deploy create-payment
supabase functions deploy payhere-notify
supabase functions deploy generate-monthly-fees
supabase functions deploy send-outbound
supabase functions deploy send-email

# Secrets (Dashboard → Edge Functions → Secrets)
# PAYHERE_MERCHANT_ID, PAYHERE_MERCHANT_SECRET, PAYHERE_SANDBOX
# SITE_URL, TWILIO_*, WHATSAPP_FROM, RESEND_API_KEY, MAIL_FROM, MAIL_NOTIFY_TO
```

Schedule monthly fees: Dashboard schedule **or** cron `0 2 1 * *` on `generate-monthly-fees`.

Promote first admin:

```sql
update public.profiles set role = 'admin', is_approved = true where email = 'you@example.com';
```

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
