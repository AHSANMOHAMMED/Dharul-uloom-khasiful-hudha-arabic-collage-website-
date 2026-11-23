# Project summary (obsolete — do not use for go-live)

> **Obsolete as of 23 Nov 2026.**  
> This file previously claimed the site was “COMPLETE AND READY FOR DEPLOYMENT” on a **React + Express + MongoDB** stack. That narrative is **wrong** for the current product.

## Current source of truth

| Topic | Use this instead |
|-------|------------------|
| Architecture & features | [README.md](./README.md) · [docs/PLATFORM_GUIDE.md](./docs/PLATFORM_GUIDE.md) |
| Production readiness / gaps | [Kashiful_Hudha_Real_World_Gap_Analysis.md](./Kashiful_Hudha_Real_World_Gap_Analysis.md) · [docs/GAP_STATUS_REGISTER.md](./docs/GAP_STATUS_REGISTER.md) |
| Completion stages | [docs/APP_COMPLETION_ROADMAP.md](./docs/APP_COMPLETION_ROADMAP.md) |
| Deploy / secrets | [docs/GO_LIVE.md](./docs/GO_LIVE.md) · [docs/OPS_DRILLS.md](./docs/OPS_DRILLS.md) |
| Policy / PDPA | [docs/PRIVACY_PDPA.md](./docs/PRIVACY_PDPA.md) · [docs/POLICY_SIGN_OFF.md](./docs/POLICY_SIGN_OFF.md) |

## What the platform actually is

- **Primary stack:** React 19 + Vite frontend, **Supabase** (Auth, Postgres/RLS, Storage, Edge Functions), optional Expo mobile app under `mobile/`.
- **Legacy:** `backend/` Express/MongoDB is **deprecated** and must not be treated as the production API (`npm run dev:legacy` exits with that message).
- **Status:** Broad module coverage exists; **not** production-verified until gap-register P0 ops drills and institutional policy sign-offs are complete.

Do not cite this file in release decisions. Prefer deleting or further archiving it after maintainers confirm no external links depend on the path.
