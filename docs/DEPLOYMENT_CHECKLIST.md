# Production deployment checklist

Engineering gate (repo): `npm run lint` and `npm run build` must pass.  
Ops gate: [OPS_DRILLS.md](./OPS_DRILLS.md) + [POLICY_SIGN_OFF.md](./POLICY_SIGN_OFF.md).  
Item tracker: [GAP_STATUS_REGISTER.md](./GAP_STATUS_REGISTER.md). Full steps: [GO_LIVE.md](./GO_LIVE.md).

## 1. Supabase database

1. Dashboard → Database → **Back up** before schema changes.
2. Apply migrations through latest (`0001` … **`0074_p0_p1_logic_hardening.sql`**):

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --include-all
# Optional local proof (needs Docker):
npm run test:db
```

## 2. Environment variables

### Vercel (frontend)

| Variable | Value |
|----------|--------|
| `VITE_SUPABASE_URL` | `https://YOUR_REF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon/publishable key only |

Never put the service-role key, PayHere secret, or DB password in `VITE_*`.

### Supabase Edge Function secrets

| Secret | Purpose |
|--------|---------|
| `PAYHERE_MERCHANT_ID` / `PAYHERE_MERCHANT_SECRET` | Payments |
| `PAYHERE_SANDBOX` | `true` until sandbox drill Pass, then `false` |
| `SITE_URL` | Production site URL |
| `TWILIO_*` / `WHATSAPP_FROM` | SMS / WhatsApp (optional until messaging go-live) |
| `RESEND_API_KEY` / `MAIL_FROM` / `MAIL_NOTIFY_TO` | Email |

## 3. Deploy Edge Functions

```bash
npm run deploy:functions
# or individually — include payhere-notify and create-payment immediately after fee migrations
```

PayHere **notify URL**: `https://YOUR_REF.supabase.co/functions/v1/payhere-notify`

## 4. Frontend (Vercel)

Project is linked as `dharul-uloom-kashiful-hudha`. Prefer git push to `main` after commit, or:

```bash
vercel deploy --prod -y
```

## 5. First admin / content

Promote admin in SQL if needed; seed CMS via Admin → Content.

## 6. Acceptance before calling it “live”

- [ ] `npm run lint` / `npm run build` green locally (or CI)
- [ ] Migrations through `0074` on production Supabase
- [ ] Edge functions + secrets deployed
- [ ] [OPS_DRILLS.md](./OPS_DRILLS.md) §1 restore + §2 PayHere sandbox signed
- [ ] [POLICY_SIGN_OFF.md](./POLICY_SIGN_OFF.md) PDPA / break-glass / guardian / welfare signed as required
- [ ] College UAT (principal, finance, tutor, student, parent)

Until the ops/policy boxes are checked, treat the site as **deployed engineering**, not institutional production acceptance.
