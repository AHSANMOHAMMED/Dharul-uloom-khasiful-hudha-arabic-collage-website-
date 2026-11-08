# Security: two-step verification, app lock, password policy

## What is enforced, and where

| Control | Enforced by | Notes |
|---|---|---|
| Two-step verification (TOTP authenticator app) | **Database** (`0026_security_mfa.sql`) | A user with a verified factor gets no privileged access from a password-only (`aal1`) session |
| "Require 2FA for privileged staff" (per institution) | **Database** | Admins, treasurer, accountant, principal, vice principal, exam officer, HR |
| Password: 10+ characters, letters and digits | **Supabase Auth** | Client checks in `src/lib/passwordPolicy.js` only explain the rule |
| Mobile app lock (fingerprint / Face ID / app PIN) | Device | Protects a signed-in phone; does not replace 2FA |

The UI (`MfaGate`, the login code step) only shows the right screen. The
database refuses the data either way, so a modified client or a direct API
call cannot skip the code.

### How the database gate works

- `public.mfa_ok()` is true when the session is `aal2`, or the user has no
  verified factor and their organisation does not require one for their role.
- Every permission helper (`is_admin`, `has_staff_role`, `is_employee`,
  `is_tutor`, `has_duty`, `is_parent_of`, …) is AND-ed with `mfa_ok()`, so
  `SECURITY DEFINER` RPCs refuse privileged work too.
- Every RLS table in `public` has a **restrictive** policy `"mfa: enforced"`.
  The only exception is reading your own `profiles` row, so the app can show
  the code prompt.
- Edge functions that grant admin powers check the caller with their own
  JWT (`supabase/functions/_shared/authz.ts`), never with a service-role
  profile lookup.
- **New tables:** a migration that creates a table must also run
  `select public.apply_mfa_policy('public.<table>');` (after
  `enable row level security`). Otherwise the table is not covered.

## Rollout (hosted Supabase)

`supabase/config.toml` only configures the local stack. On the hosted project:

1. **Dashboard → Authentication → Multi-Factor:** enable **TOTP** (enroll + verify).
2. **Dashboard → Authentication → Policies (Passwords):** minimum length **10**,
   require **letters and digits**. Turn on **secure password change**.
3. Apply the migration: `npm run db:apply` (adds `0026_security_mfa.sql`).
4. Deploy the edge functions: `npm run deploy:functions`
   (`create-payment`, `send-email` and `send-outbound` changed).
5. Each admin signs in, opens **Security & sign-in** (shield icon in the top
   bar, or `/account/security`), and turns on two-step verification.
6. Once the admins are enrolled, an admin who signed in **with a code** ticks
   **Require two-step verification for privileged staff**. The database refuses
   this from a password-only session, so nobody can lock themselves out by
   ticking it first.
7. Privileged staff who have not enrolled see the setup screen at their next
   visit. Until they finish it, they can't open protected data.

Existing passwords keep working. The new password rule applies when a
password is set or changed.

## Lost phone / recovery

Users can add a **backup device** on the security page; a code from any
enrolled device works.

If someone loses all their devices, a super admin opens **Supabase Dashboard →
Authentication → Users → (user) → Multi-factor** and deletes the factor. The
user then signs in with their password and enrols again. (If the organisation
requires 2FA for their role, they go straight to setup.)

## Mobile app lock

**Settings → Security → Lock the app**:

- With fingerprint or Face ID enrolled on the phone, unlocking uses biometrics,
  with the phone's own screen lock as fallback. An app PIN can be added as well.
- Without biometrics, a 6-digit app PIN is required.
- The app locks on launch, and again after 60 seconds in the background.
- The PIN is stored only as a salted SHA-256 hash in the Keychain/Keystore
  (`expo-secure-store`). After 5 wrong PINs the user is signed out and the lock
  is reset.

The mobile sign-in screen also asks for the 2FA code. Enrolment itself is done
on the web (`/account/security`), because scanning a QR code needs a second screen.

After changing `mobile/package.json` / `app.json` (new: `expo-local-authentication`,
`expo-crypto`), make a new development / EAS build; Expo Go can't use a new
native plugin config.

## Tests

- `npm run test:db`: 20 database tests cover the gate (aal1 vs aal2, enrolled vs
  not, org requirement, other-org isolation, the self-lockout guard).
- `npm test`: `src/test/security.test.jsx` covers the gate, the code step,
  enrolment and the password policy.
