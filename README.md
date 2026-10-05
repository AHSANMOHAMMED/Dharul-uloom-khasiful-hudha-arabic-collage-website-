# Dharul Uloom Kashiful Hudha Arabic College

Official website and digital college-management application for Dharul Uloom Kashiful Hudha Arabic College, located in Mudalippalli, Kalpitiya, Puttalam District, Sri Lanka.

> **Project status:** This repository contains a substantial application, but feature presence is not the same as production readiness. Database permissions, migrations, payment processing, deployment reproducibility, and end-to-end workflows must pass the roadmap and acceptance checks below before production launch. This README describes the code reviewed in the repository; it does not verify the state of any deployed Supabase project.

## About the College

- **Established:** 2004
- **Registered:** February 12, 2008, Ministry of Religious Affairs
- **Registration number:** MRCA/13/1/PAS/187
- **Location:** 5P2C+VMC, Mudalippalli, Kalpitiya, Puttalam, Sri Lanka
- **Official phone:** 032-5612355
- **Mobile:** 070-5668463, 071-5576060
- **Facebook:** [Dharul Uloom Kashiful Hudha](https://www.facebook.com/100088419063008)

The college's mission is to nurture faith and knowledge through quality Islamic education, serving as a foundational school for young students in the coastal community of Kalpitiya.

## Application Overview

The application combines a public college website with digital services for students, parents, tutors, librarians, and administrators. Repository code includes public content pages, admissions, account registration, role-specific dashboards, a digital library, learning-management workflows, and PayHere payment integration.

### Main technology

- **Frontend:** React 19, Vite, Tailwind CSS, React Router
- **Authentication and application data:** Supabase Auth and PostgreSQL
- **Server-side operations:** Supabase Edge Functions
- **Forms and interface:** React Hook Form, Yup, Framer Motion
- **Languages:** English and Arabic, including right-to-left layout support
- **Tests and CI:** Vitest, Testing Library, ESLint, GitHub Actions
- **Optional legacy service:** Express and MongoDB code in `backend/`; Supabase is the primary application path described by the project

### Repository map

| Path | Purpose |
|---|---|
| `src/pages/` | Public pages, account screens, dashboards, library, and reader |
| `src/components/` | Shared interface components |
| `src/context/` | Application authentication/session context |
| `src/lib/` | Supabase client and feature data-access helpers |
| `src/test/` | Frontend tests |
| `supabase/migrations/` | Database schema, policies, and seed migrations |
| `supabase/functions/` | Edge Functions, including payment operations |
| `scripts/` | Database, library-import, and setup utilities |
| `backend/` | Optional legacy Express/MongoDB application |
| `docs/` | Deployment and project documentation |
| `.github/workflows/` | Continuous-integration and Docker workflows |

## Local Development

### Prerequisites

- Node.js 18 or a compatible supported version
- npm
- A Supabase project for authentication and data-backed features

### Setup

1. Clone the repository and enter the project directory.
2. Copy `.env.example` to `.env`.
3. Set the browser-safe Supabase URL and anonymous/publishable key as described below.
4. Install dependencies and start the Vite development server:

```bash
npm install
npm run dev
```

The Vite server listens on port `3000` by default. Without Supabase configuration, some data-backed features will not work; use a staging Supabase project to develop and test them.

### Environment variables and secrets

The frontend uses:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
```

Only browser-safe values belong in `VITE_*` variables. **Never put the Supabase service-role key, PayHere merchant secret, database password, or other server credentials in frontend variables, committed files, or client-side code.** Configure privileged credentials as server-side secrets for the relevant Edge Functions or deployment platform.

For the optional legacy backend only, configure its own `backend/.env` from the variables its code requires. Do not copy production credentials into a local development environment.

### Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the primary Vite frontend |
| `npm run build` | Build the frontend for production |
| `npm run preview` | Preview a local production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run frontend Vitest tests |
| `npm run dev:legacy` | Start the optional legacy frontend/backend development processes |
| `npm run db:apply` | Run the repository's database migration script; use only after reviewing its target and migration state |
| `npm run import:shamela` | Run the Shamela import utility; review its documentation and target database before use |

Check each script's implementation and environment requirements before running it against shared or production systems. Do not assume a migration or import script is safe to rerun against production.

## Feature Status

The repository includes code for the following capabilities. The list is **not** a claim that every workflow has passed acceptance testing or is ready for public use.

- Public pages for the college, courses, admissions, faculty, gallery, news, and contact
- English and Arabic interface support with RTL switching
- Supabase sign-in and registration, with role-specific portal screens
- Content-management screens for college information
- Digital library catalog, Arabic search, book reader, bookmarks, and reading progress
- Student/parent portal features, including attendance, results, and fees
- LMS materials, assignments, and submissions
- PayHere tuition checkout and payment notification functions
- PWA installation and offline-shell support
- Google Maps and WhatsApp links

## Completion Roadmap

Work through the stages in order. Keep stages marked **Not verified** until their acceptance checks pass in a staging environment. Security-sensitive work must be checked at the database and server-function level, not only in the UI.

| Stage | Work | Acceptance checks | Status |
|---|---|---|---|
| **1. Establish a reliable baseline** | Create a staging Supabase project; back up existing data; record deployed schema, grants, and migration state; establish characterization tests; add and commit dependency lockfiles. | Clean dependency installation, recorded test baseline, documented staging target, and verified backup before schema changes. | Not verified |
| **2. Secure authentication and roles** | Restrict profile updates to safe fields; prevent self-approval and role escalation; handle unavailable profiles safely; enforce approved tutor access; separate student submission edits from grading. | Database-level positive and negative tests show each role can access only the permitted rows and columns. | Not verified |
| **3. Repair database migrations** | Reconcile conflicting books-table definitions; fix the attendance update trigger; establish one authoritative migration workflow; separate demo data from production data. | Both clean database setup and upgrade of a representative existing database succeed in staging without data loss. | Not verified |
| **4. Validate college workflows** | Exercise registration, account approval, admissions review, parent-child linking, attendance, leave requests, results, schedules, announcements, and administration. | End-to-end tests cover authorized actions, denied actions, validation failures, empty states, and relevant role combinations. | Not verified |
| **5. Validate LMS and library** | Exercise tutor materials and assignments, student submissions, grading, file privacy, Arabic search, book reading, bookmarks, and reading progress. | Tutor, student, parent, and librarian workflows pass; unauthorized users cannot access protected records or files. | Not verified |
| **6. Make payments production-safe** | Match PayHere signing to the official integration requirements; process notifications atomically and idempotently; validate amount, currency, order, and transaction state; cover retries and reconciliation. | Sandbox tests cover success, failure, cancellation, duplicate notifications, and concurrent delivery without duplicate or incorrect fee balances. | Not verified |
| **7. Finish public experience** | Verify public facts and homepage statistics; centralize translations; correct language inconsistencies; assess mobile layouts, accessibility, loading/error states, and route-level bundle loading. | Public and portal pages pass agreed English/Arabic mobile and desktop checks, including keyboard and screen-reader review. | Not verified |
| **8. Validate release and operations** | Pass CI; configure production redirects, server secrets, storage, and functions; document monitoring, backup/restore, rollback, and support procedures; complete user acceptance testing. | Release checklist is approved; critical findings are closed; restore and rollback procedures are exercised; production settings are independently reviewed. | Not verified |

### Definition of done

A stage is complete only when its acceptance checks have been run and recorded. Before launch, require:

- Successful reproducible install, lint, production build, and relevant automated tests.
- Database authorization tests for permitted **and denied** actions.
- Successful staging migration and rollback/recovery rehearsal appropriate to the change.
- PayHere sandbox evidence for success, failure, retries, and duplicate notifications.
- College staff and representative student/parent/tutor acceptance of their workflows.
- Production secrets, backups, monitoring, and incident/rollback procedures reviewed.

## Testing and CI

The repository defines frontend lint/build/test commands and a GitHub Actions workflow that also runs backend tests. CI currently uses `npm ci`, so the relevant lockfiles must be committed and maintained for clean CI installs. Passing frontend tests alone does not validate PostgreSQL RLS, Edge Functions, payment callbacks, storage permissions, or complete user journeys; add and run integration and end-to-end tests for those boundaries.

Do not claim CI or deployment is healthy until the workflow has run successfully for the branch being released. Record unresolved failures and the environment used for each test.

## Deployment Notes

- The primary architecture is the Vite frontend with Supabase Auth, database, storage, and Edge Functions.
- `vercel.json` configures the SPA rewrite. Confirm project environment variables and routing in a staging deployment before production.
- Apply migrations through the documented, reviewed migration process; inspect the target project and current schema first. Take and verify a backup before production schema changes.
- Configure PayHere and Supabase privileged values as server-side secrets. Start with PayHere sandbox credentials and do not enable live payments until Stage 6 passes.
- The `backend/` Express/MongoDB service is a legacy/optional path; do not deploy it as a second production backend unless the team has explicitly chosen and documented that architecture.
- See `docs/DEPLOYMENT_CHECKLIST.md` if present and keep it aligned with this README and the actual release process.

## External Services

- Supabase project for authentication, PostgreSQL, storage, and Edge Functions
- PayHere merchant account; use sandbox mode during implementation and acceptance testing
- Optional Shamela data source and import workflow for library population
- Optional MongoDB deployment only if the legacy backend is deliberately retained

## Contribution and Licensing

This is a college project. Coordinate changes with the college administration and maintainers. The existing repository states: Copyright © 2024 Dharul Uloom Kashiful Hudha Arabic College. All rights reserved. Confirm the applicable licensing and redistribution terms with the college before reuse or distribution.

---

**Built with dedication for Islamic education in Sri Lanka** 🕌📚
