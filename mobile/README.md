# Kashiful Hudha mobile (Expo)

Shares the same Supabase Auth + RLS as the web SPA.

## Setup

```bash
cd mobile
cp ../.env.example .env
# Set:
# EXPO_PUBLIC_SUPABASE_URL=
# EXPO_PUBLIC_SUPABASE_ANON_KEY=
npm install
npx expo start
```

Deep link scheme: `kashifulhudha://` (payment return can open web `/payment/success` until native PayHere SDK is added).

## Screens

- Login
- Parent (children + fees)
- Student (fees + results)
- Tutor (pending leaves)
