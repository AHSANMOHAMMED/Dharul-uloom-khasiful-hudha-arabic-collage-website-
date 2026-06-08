# Production deployment checklist

Complete these steps after merging the website completion work.

## 1. Supabase database

Apply migrations in order (`0001` through `0010`):

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Or paste each file from `supabase/migrations/` into the Supabase SQL editor in numeric order.

## 2. Environment variables

### Vercel (frontend)

| Variable | Value |
|----------|--------|
| `VITE_SUPABASE_URL` | `https://YOUR_REF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon key from Supabase dashboard |

### Supabase Edge Function secrets

Set in **Project Settings → Edge Functions → Secrets**:

| Secret | Purpose |
|--------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected in hosted functions |
| `PAYHERE_MERCHANT_ID` | PayHere merchant ID |
| `PAYHERE_MERCHANT_SECRET` | PayHere secret |
| `PAYHERE_SANDBOX` | `true` for testing, `false` for production |
| `SITE_URL` | Production site URL (e.g. `https://your-domain.vercel.app`) |

## 3. Deploy Edge Functions

```bash
supabase functions deploy generate-monthly-fees
supabase functions deploy create-payment
supabase functions deploy payhere-notify
```

Configure PayHere **notify URL** to:

`https://YOUR_REF.supabase.co/functions/v1/payhere-notify`

## 4. First admin user

After registering, promote your account:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## 5. Seed content

Use **Admin → Content CMS** to upload gallery photos and verify news/faculty/courses, or rely on migration seeds for course programs and gallery titles.

## 6. PayHere go-live

1. Register at [payhere.lk](https://www.payhere.lk/)
2. Test with sandbox credentials (`PAYHERE_SANDBOX=true`)
3. Switch to live credentials and set `PAYHERE_SANDBOX=false`

## 7. Shamela library import (optional)

```bash
npm run import:shamela -- --dry-run --limit 20
npm run import:shamela -- --limit 50
```

Requires `SHAMELA_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`.

## 8. Verify

```bash
npm run lint
npm test
npm run build
```

Smoke-test: login, admissions, library search, admin CMS, student fee pay flow (sandbox), PWA install on mobile.

## Legacy Express/Mongo backend

The SPA no longer calls Express. Use `npm run dev:legacy` only if you need the old Mongo API for local tooling.
