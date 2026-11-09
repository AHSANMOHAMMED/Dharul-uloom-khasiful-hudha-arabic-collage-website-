# Kashiful Hudha — Full Platform Guide

> Features · why they exist · how they work · architecture · folder structure · data flows.  
> Companion docs: [MASTER_PRD.md](./MASTER_PRD.md) (full product requirements) · [UI_ENHANCEMENT_SPEC.md](./UI_ENHANCEMENT_SPEC.md) · [GO_LIVE.md](./GO_LIVE.md) · [ROLE_RLS_MATRIX.md](./ROLE_RLS_MATRIX.md)

---

## 1. What this project is

**Dharul Uloom Kashiful Hudha Arabic College** (Kalpitiya, Sri Lanka) runs on one platform that combines:

1. A **public bilingual college website** (EN/AR)  
2. A **role-based college ERP / portal** (students, parents, tutors, finance, leadership, library, admin)  
3. A **digital Islamic library** (catalog + in-app reading)  
4. **Payments** (PayHere), **messaging outbox**, **CRM admissions**, **staff HRM**  
5. An **Expo mobile app** (parent / student / tutor / accountant Finance Hub / Super Admin control plane)  
6. **Super Admin control plane** (`/platform` sidebar: institutions, users, feature ACL, communities, audit) + **ERP Finance Hub** (billing jobs, multi-type bills, letterhead quotations, WA/SMS links)  
7. Optional **legacy Express + MongoDB** API (not the primary path)

**Primary live stack:** Vite React SPA → Supabase (Auth, Postgres, RLS, Storage, Edge Functions) → Vercel hosting.

---

## 2. High-level architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Clients                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ Web SPA (Vite)   │  │ Expo Mobile      │  │ PWA / SW       │ │
│  │ src/ + Tailwind  │  │ mobile/          │  │ public/sw.js   │ │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬────────┘ │
└───────────┼─────────────────────┼────────────────────┼──────────┘
            │  anon key + JWT     │                    │
            ▼                     ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase (project nkuafrxzydleirtrvdbt)                         │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────────┐ │
│  │ Auth       │ │ Postgres   │ │ Storage    │ │ Edge Functions│ │
│  │ email/pass │ │ + RLS      │ │ covers/PDF │ │ payments, SMS │ │
│  └────────────┘ └─────┬──────┘ └────────────┘ └───────┬───────┘ │
└───────────────────────┼─────────────────────────────────┼───────┘
                        │                                 │
         ┌──────────────┼──────────────┐                  │
         ▼              ▼              ▼                  ▼
    Public CMS     Portal tables   Library FTS     PayHere / Twilio /
    admissions     fees, LMS…      books/pages     Resend / cron fees
```

**Important:** The browser never uses the service role key. Row Level Security (RLS) enforces who can read/write. Edge Functions use the service role only on the server for webhooks, fee generation, and outbound messaging.

### Legacy path (deprecated — do not use)

```
backend/  →  Express + Mongoose/MongoDB (archived)
```

Hard-gated behind `LEGACY_API_ENABLED=1`. See [`backend/README.md`](../backend/README.md).  
**Canonical backend = Supabase only.**

---

## 3. Repository structure

```
.
├── src/                      # ★ Primary web frontend
│   ├── App.jsx               # Routes, i18n dir, shell
│   ├── main.jsx · i18n.js · index.css
│   ├── context/AuthContext.jsx
│   ├── lib/                  # Data/API layer (Supabase clients)
│   ├── components/           # Shared UI + panels
│   ├── pages/                # Route screens + dashboards
│   └── test/
├── public/                   # Static assets, PWA SW, images
├── mobile/                   # ★ Expo Router native app
├── supabase/
│   ├── migrations/           # 0001–0014 + books migration
│   ├── functions/            # Edge Functions
│   └── config.toml
├── scripts/shamela/          # Bulk library import workers
├── backend/                  # DEPRECATED Mongoose archive (not production)
├── docs/                     # Guides (this file + UI/go-live/RLS)
├── docker* · vercel.json     # Deploy helpers
└── package.json              # Vite SPA scripts
```

---

## 4. How auth & roles work

### Flow

1. User signs up / logs in via **Supabase Auth**.  
2. Trigger `handle_new_user` creates a row in `public.profiles`.  
3. `AuthContext` merges Auth user + profile → `user` object for the UI.  
4. Students need a **pre-seeded index number** (`valid_index_numbers` + RPC `verify_student_index`).  
5. New students/tutors wait until `is_approved = true` (admin/principal).  
6. Routes: `/admin` for `role = admin`; others `/dashboard` → role-specific dashboard.

### Role model

| Identity field | Values | Purpose |
|----------------|--------|---------|
| `profiles.account_type` | student, parent, tutor, … | Primary portal type |
| `profiles.role` | user, admin, … | Admin gate |
| `profiles.assigned_tutor_role` | none, treasurer, principal, vp, librarian, … | Extra staff powers |
| `profiles.is_approved` | bool | Signup gate |

**Why:** One login serves marketing + ERP; school staff can wear multiple hats (tutor + treasurer) via `RoleSwitcher` / `?view=`.

---

## 5. Features catalog — why & how

### A. Public college website

| Feature | Why | How it works |
|---------|-----|--------------|
| Home / About / Contact | Recruit & inform community | Static + CMS-driven pages; i18n EN/AR |
| Courses / Curriculum / Faculty / Gallery / News | Showcase academics | Tables `course_programs`, `curriculum`, `faculty`, `gallery_items`, `news`; public RLS read; Admin CMS writes |
| Admissions form | Collect applications online | Insert into `admissions`; admin reviews |
| EN ↔ AR + RTL | Serve Arabic-first college | `react-i18next`; `document.dir` flips |

### B. Identity & access

| Feature | Why | How |
|---------|-----|-----|
| Register / Login / Reset | Secure portal access | Supabase Auth + profile trigger |
| Index pre-seed | Only real enrolled IDs can register as students | Admin seeds `valid_index_numbers` |
| Approval queue | Prevent fake accounts | Admin/Principal sets `is_approved` |
| Parent↔child link | Parents see their kids only | `parent_children`; invite tokens in `parent_invites` |

### C. Academic operations

| Feature | Why | How |
|---------|-----|-----|
| Attendance | Track presence; alert parents | Tutor writes `attendance`; student/parent read own/child |
| Leave requests | Formal absence process | Parent/student create `leave_requests`; tutor/principal approve |
| Exam results | Publish grades | Staff write `student_results`; student/parent read |
| Timetable | Weekly schedule | Principal manages `class_schedules` |
| Announcements | Campus broadcast | Principal posts `announcements` |
| LMS | Materials & homework | `lms_materials`, `lms_assignments`, `lms_submissions` |

### D. Finance

| Feature | Why | How |
|---------|-----|-----|
| Monthly fees | Tuition billing | Treasurer or cron → Edge `generate-monthly-fees` → `student_fees` |
| Partial payments / ledger | Track arrears | Treasurer logs deposits on fee rows |
| PayHere checkout | Online pay | `PayFeeButton` → Edge `create-payment` → PayHere → webhook `payhere-notify` → update fee + `payment_transactions` |
| Receipts | Proof of payment | Client print via `exportUtils` |
| Tutor salaries | Staff payroll | `tutor_salaries`; HRM slip print |

### E. Digital library

| Feature | Why | How |
|---------|-----|-----|
| Catalog + search | Islamic/Arabic books for students | `books`, authors, categories; FTS RPCs (`search_books`) |
| Infinite browse | Large catalog UX | `Library.jsx` + IntersectionObserver |
| In-app reader | Read without leaving site | Drive preview / PDF embed (`BookReader`) |
| Bookmarks / notes / favorites | Personal study | `bookmarks`, `user_notes`, `favorites`, `reads` |
| Librarian CRUD | Maintain catalog | `/library-admin` |
| Shamela import | Bulk fill from Shamela API | `scripts/shamela` + `import_jobs` table |

### F. Admissions CRM

| Feature | Why | How |
|---------|-----|-----|
| Pipeline stages | Track lead → enrolled | `admissions.crm_stage` + `admission_status_history` |
| Notes | Counselor follow-up | `admission_notes` |
| Enroll | Convert accepted → student seat | CRM enroll sets index + class; can kick fee/parent invite |

### G. Staff HRM & org

| Feature | Why | How |
|---------|-----|-----|
| Staff HR records | Employment metadata | `staff_hr` + storage docs |
| Organization branding | SaaS multi-tenant foundation | `organizations` + branding JSON (`orgApi`) |
| Broadcast | Mass notify roles | Inserts `notifications` (+ outbox path) |

### H. Messaging & activations

| Feature | Why | How |
|---------|-----|-----|
| `message_outbox` | Reliable SMS/WhatsApp/email queue | Writers enqueue; Edge `send-outbound` / `send-email` drains |
| Activation events | Alert parents when student approved | `activation_events` + notify helpers |
| Notification bell | In-app inbox | `notifications` + prefs / `push_subscriptions` |

### I. Mobile app

| Feature | Why | How |
|---------|-----|-----|
| Parent/Student/Tutor apps | Day-to-day without desktop | Expo Router + same Supabase JWT/RLS |
| Deep links | Return from PayHere | `kashifulhudha://payment/*` |
| Lite screens | Fast MVP | Fees, results, children, leave list (expand per UI spec) |

### J. Platform quality

| Feature | Why | How |
|---------|-----|-----|
| PWA | Installable on phones | `manifest.json`, SW, InstallPrompt |
| Offline banner | Honest UX offline | OfflineIndicator |
| Analytics dashboard | Admin insight | Recharts over admissions/users |

---

## 6. Request / data flows (how systems collaborate)

### 6.1 Login → dashboard

```
Login form → supabase.auth.signInWithPassword
          → AuthContext.buildUser(profiles)
          → if admin → /admin
             else if !approved → pending screen
             else → /dashboard → Student|Parent|Tutor|…
```

### 6.2 Pay fee online

```
PayFeeButton → paymentsApi → Edge create-payment
            → redirects to PayHere
            → PayHere POST → Edge payhere-notify (no JWT; signature check)
            → updates student_fees + payment_transactions
            → optional message_outbox (SMS/receipt)
            → browser → /payment/success (or mobile deep link)
```

### 6.3 Monthly fee generation

```
Cron / Treasurer button → Edge generate-monthly-fees (service role)
                       → upsert student_fees for active students
                       → notify parents via outbox / notifications
```

### 6.4 Library search

```
Library UI → booksApi.searchBooks → RPC search_books (FTS + filters)
           → BookCard → /library/:id → BookReader (Drive/PDF)
```

### 6.5 CRM enroll

```
Admin CRM board → move stage → accepted → enrollAdmission(index, class)
               → may create parent_invite + fee kickoff
```

### 6.6 Content CMS

```
Admin Content tab → AdminContentCMS → contentApi → news|faculty|… tables
                 → public pages read same tables (anon/authenticated RLS)
```

---

## 7. Database map (by domain)

| Domain | Tables (main) | Migrations |
|--------|---------------|------------|
| Identity | `profiles`, `valid_index_numbers`, `parent_children`, `parent_invites` | 0001, 0006, 0014 |
| Library | `authors`, `categories`, `books`, `book_*`, `bookmarks`, `reads`, `user_notes`, `favorites` | 0001–0004, 0011 |
| CMS / public | `admissions`, `news`, `faculty`, `curriculum`, `contact_messages`, `gallery_items`, `course_programs` | 0005, 0008 |
| Academic | `attendance`, `leave_requests`, `student_results`, `class_schedules`, `announcements`, `events`, `tutor_jobs` | 0006, 0007 |
| Finance | `student_fees`, `tutor_salaries`, `payment_transactions` | 0006, 0009 |
| LMS | `lms_materials`, `lms_assignments`, `lms_submissions` | 0010 |
| Messaging | `notifications`, `message_outbox`, `activation_events`, `push_subscriptions` | 0006, 0012, 0013 |
| CRM / HRM / SaaS | `admission_notes`, `admission_status_history`, `staff_hr`, `organizations`, `import_jobs` | 0013 |

RLS policies: see [ROLE_RLS_MATRIX.md](./ROLE_RLS_MATRIX.md).

---

## 8. Edge Functions

| Function | JWT | Purpose |
|----------|-----|---------|
| `create-payment` | yes (user) | Start PayHere session for a fee |
| `payhere-notify` | **no** | Webhook; verify MD5; mark paid |
| `generate-monthly-fees` | yes / cron secret | Bulk create month fees |
| `send-outbound` | no / secret | Drain SMS/WhatsApp outbox (Twilio) |
| `send-email` | no / secret | Drain email (Resend) |

Shared helpers: `supabase/functions/_shared/notify.ts`.

---

## 9. Frontend layers

| Layer | Responsibility |
|-------|----------------|
| `pages/*` | Screens, layout per route/role |
| `components/*` | Reusable UI + heavy panels (CRM, HRM, CMS, library) |
| `lib/*Api.js` | Thin Supabase queries / Edge invokes |
| `context/AuthContext` | Session + role helpers (`isStudent`, `isAdmin`, …) |
| `i18n.js` | EN/AR strings |

### Web routes (summary)

| Path | Audience |
|------|----------|
| `/`, `/about`, `/courses`, … | Public |
| `/login`, `/register`, … | Auth |
| `/library`, `/library/:id` | Public/auth library |
| `/dashboard` | Role portals |
| `/admin` | Admin console |
| `/library-admin` | Librarian |
| `/payment/success\|cancel` | PayHere return |

### Mobile routes

| Path | Role |
|------|------|
| `/`, `/login` | Entry |
| `/student`, `/parent`, `/tutor` | Portals |
| `/payment-success`, `/payment-cancel` | Deep link returns |

---

## 10. Who uses what (portal map)

```
                    ┌──────── Public site + Library ────────┐
                    │                                       │
    Student ────────┤ attendance grades fees LMS library   │
    Parent ─────────┤ children fees leave grades invite    │
    Tutor ──────────┤ attendance leaves LMS salary         │
    Treasurer ──────┤ generate fees log pay salaries       │
    Principal / VP ─┤ overview leaves timetable announce   │
    Librarian ──────┤ catalog CRUD                         │
    Admin ──────────┤ ALL tabs: CRM HRM CMS org analytics  │
                    └───────────────────────────────────────┘
```

---

## 11. Deployment topology

| Piece | Where | Notes |
|-------|-------|-------|
| SPA | **Vercel** | Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| DB / Auth / Storage / Functions | **Supabase** | Migrations 0001–0014 applied |
| Secrets | Supabase Edge secrets | PayHere, Twilio, Resend, `SITE_URL` |
| Mobile | Expo / EAS (when published) | `EXPO_PUBLIC_SUPABASE_*` |
| Shamela bulk | Local or DO worker | Service role + `SHAMELA_API_KEY` |
| Legacy API | Optional Docker / Node | Not required for current SPA |

Go-live steps: [GO_LIVE.md](./GO_LIVE.md).

---

## 12. Environment variables

### Web (`.env`)

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Mobile (`mobile/.env`)

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

### Edge secrets (Dashboard / CLI)

`PAYHERE_*`, `SITE_URL`, `TWILIO_*`, `WHATSAPP_FROM`, `RESEND_API_KEY`, `MAIL_FROM`, …

Never put **service role** in the Vite or Expo public env.

---

## 13. End-to-end user journeys

1. **Applicant** fills `/admissions` → admin CRM moves stages → enroll + index → student registers with index → approval → portal opens; parent gets invite.  
2. **Student** checks attendance/grades, pays fee via PayHere, reads library, submits LMS.  
3. **Parent** links child / claims invite, monitors attendance & fees, requests leave, pays.  
4. **Tutor** marks attendance, reviews leaves, manages LMS, sees salary.  
5. **Treasurer** generates month fees, logs cash payments, pays tutors.  
6. **Principal** posts announcements, manages timetable, reviews leaves/approvals.  
7. **Librarian** adds books; **import job** can bulk-load Shamela.  
8. **Admin** runs CMS, CRM, HRM, broadcast, analytics, org branding.

---

## 14. Design / UX note

Two visual modes today (see [UI_ENHANCEMENT_SPEC.md](./UI_ENHANCEMENT_SPEC.md)):

- **Marketing:** light emerald/amber college site  
- **Portals:** dark glass dashboards  
- **Mobile:** light emerald prototype  

Enhancement work should unify tokens while keeping every feature above.

---

## 15. Related documentation index

| Doc | Contents |
|-----|----------|
| [MASTER_PRD.md](./MASTER_PRD.md) | Master PRD — vision, modules, DB entities, AI build phases |
| [PLATFORM_GUIDE.md](./PLATFORM_GUIDE.md) | **This file** — current product/architecture map |
| [UI_ENHANCEMENT_SPEC.md](./UI_ENHANCEMENT_SPEC.md) | Screen-level UI redesign brief (web + mobile) |
| [GO_LIVE.md](./GO_LIVE.md) | Deploy / secrets / smoke checklist |
| [ROLE_RLS_MATRIX.md](./ROLE_RLS_MATRIX.md) | Who can do what in DB |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Older library-focused layout notes |
| [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) | Ops checklist |
| [LIBRARY_EXPANSION.md](./LIBRARY_EXPANSION.md) | Library growth / Shamela |

---

*Single map of the complete college platform: website + ERP + library + payments + mobile.*
