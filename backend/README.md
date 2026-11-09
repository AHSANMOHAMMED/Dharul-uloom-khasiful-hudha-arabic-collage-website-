# DEPRECATED — Legacy Express + Mongoose API

**Do not use this folder for production or new features.**

The live college platform (website, portals, ERP, Finance Hub, Super Admin, mobile) uses **Supabase Postgres + Auth + RLS + Edge Functions**. The Vite SPA never calls these `/api/*` routes in the current architecture.

## What this was
- Express HTTP API (`server.js`)
- **Mongoose** models → MongoDB collections (`User`, `Admission`, `Book`, `News`, `Faculty`, `Curriculum`, `Contact`)
- JWT auth, bcrypt passwords, seed scripts

## Why it stays in the repo
Kept only as **historical reference** and old Docker/seed scripts. Equivalent data now lives in Supabase tables (`profiles`, admissions CRM, `books`, CMS content, etc.).

## Starting it (local archaeology only)
Requires an explicit opt-in so it cannot be started by accident:

```bash
cd backend
LEGACY_API_ENABLED=1 MONGO_URI=mongodb://127.0.0.1:27017/kashiful-hudha JWT_SECRET=dev-only npm run dev
```

Without `LEGACY_API_ENABLED=1`, the process exits immediately.

## Mapping (Mongoose → Supabase)
| Mongoose model | Live path today |
|---|---|
| `User` | Supabase Auth + `profiles` |
| `Admission` | Admissions CRM / `admissionsApi` |
| `Book` | `books` + library RPCs |
| `News` / `Faculty` / `Curriculum` / `Contact` | Supabase content tables via `contentApi` |

For platform docs see [`docs/PLATFORM_GUIDE.md`](../docs/PLATFORM_GUIDE.md) and [`docs/FINANCE_HUB.md`](../docs/FINANCE_HUB.md).
