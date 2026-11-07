# Dharul Uloom Kashiful Hudha — Full UI / Feature Spec (for New UI Enhancement)

> Single source of truth for redesigning the **web SPA** and **Expo mobile app**. Preserve **all features and routes** below; replace visuals, spacing, typography, and composition with a new cohesive system shared across platforms.

**Product:** Islamic Arabic College portal + ERP + mobile portals  
**Web stack today:** Vite · React · Tailwind · Framer Motion · react-i18next (EN/AR + RTL) · Supabase · PWA  
**Mobile stack today:** Expo Router · React Native · Supabase Auth/RLS · Secure Store · deep link `kashifulhudha://`  
**Live web:** `https://dharul-uloom-kashiful-hudha.vercel.app`  
**Mobile package:** `mobile/` (Expo app “Kashiful Hudha”)

---

## 1. Product goals (keep)

1. Public college marketing site (bilingual).
2. Role-based portals (student, parent, tutor, treasurer, principal/VP, librarian, admin).
3. Digital Islamic library (browse + in-app reader).
4. Admissions CRM, staff HRM, fees/PayHere, notifications, org branding.
5. Mobile-friendly + installable PWA; offline indicator; EN ↔ AR with full RTL.
6. Native Expo mobile app for day-to-day parent / student / tutor tasks (same Supabase backend).

---

## 2. Current design system (baseline to replace)

### Brand tokens

| Token | Current value | Role |
|-------|---------------|------|
| Islamic green | `#0F5132` / emerald-700–950 | Primary brand, CTAs, active states |
| Islamic gold / amber | `#FFD700` + amber-400–500 | Accents, gradients, secondary highlights |
| Beige | `#F5F5DC` | Soft secondary (light surfaces) |
| Dark shell | `#1A3C2E` / `gray-950` | Footer + authenticated dashboards |
| Theme (PWA) | `#1a5c38` | Browser chrome |

### Typography

| Use | Font |
|-----|------|
| Latin / UI | Inter |
| Arabic / Urdu | Amiri → Scheherazade New → Noto Naskh Arabic |
| Display headings | Often `font-arabic` even on EN for brand feel |

### Patterns today (candidates for redesign)

- **Public:** light `slate-50` / white, soft emerald→amber washes, pill labels, `rounded-3xl` cards, emoji icons.
- **App / dashboards:** dark `gray-950`, glassmorphism (`.glass-card` / `.glass-panel`), emerald glow borders, gradient title text.
- **Nav:** sticky white blur bar; emerald active pills.
- **Footer:** dark with amber gradient brand text.
- **Motion:** Framer fade/slide; hover lift/scale; marquee / float / pulse utilities.
- **Charts:** Recharts — emerald / amber / blue / red.

### Enhancement direction (recommended)

Define **one** visual language for both marketing and app (shared tokens, density rules). Prefer:

- Strong brand-first hero (logo/name dominant).
- Full-bleed imagery for marketing heroes where available.
- Clear type hierarchy; avoid emoji as primary iconography (replace with SVG icon set).
- Fewer nested glass cards; one job per section.
- Shared component kit: Button, Input, Select, Table, Tabs, Stat, Empty, Modal, Toast, Badge, Sidebar.
- Keep bilingual + RTL first-class (mirrored layouts, Arabic line-height ~1.8–1.9).

---

## 3. Global shell (every page)

| Element | File | Features / UI blocks |
|---------|------|----------------------|
| Navbar | `Navbar.jsx` | Logo, brand name, Home, About, Academics dropdown (Courses, Curriculum, Faculty), Explore dropdown (Library, Gallery, News), Admissions, Contact, EN/AR toggle, Login / Dashboard / Admin, NotificationBell (auth), mobile hamburger + accordion |
| Footer | `Footer.jsx` | Brand, tagline, hotlines, campus address, nav links, copyright |
| Offline | `OfflineIndicator.jsx` | Banner when offline |
| Install | `InstallPrompt.jsx` | PWA install CTA |
| Toasts | App-level | `react-toastify` bottom-center / dark on admin |
| Auth wrap | `AuthContext.jsx` | Session, roles, approval flag |
| Role switch | `RoleSwitcher.jsx` | Multi-role staff view switcher on `/dashboard` |

**Routes shell:** `App.jsx` — `Navbar` + `<main>` + `Footer` on all routes.

---

## 4. Public marketing pages (light UI)

| Route | Page | Sections / features to redesign |
|-------|------|----------------------------------|
| `/` | `Home.jsx` | Logo hero, admissions open pill, title/subtitle/description, CTAs (Apply, Library), portal gateway cards (Student / Parent / Tutor / Librarian), featured programs (Hifz, Nahw, Hadith), additional college content blocks |
| `/about` | `About.jsx` | College story / mission / values |
| `/courses` | `Courses.jsx` | Course listing cards (CMS-backed) |
| `/curriculum` | `Curriculum.jsx` | Curriculum stages / subjects |
| `/faculty` | `Faculty.jsx` | Faculty grid / profiles |
| `/gallery` | `Gallery.jsx` | Image gallery |
| `/news` | `News.jsx` | News list |
| `/news/:id` | `NewsDetail.jsx` | Article detail |
| `/admissions` | `Admissions.jsx` | Public admission application form |
| `/contact` | `Contact.jsx` | Contact form + campus info |
| `*` | `NotFound.jsx` | 404 |

### Auth pages (light forms)

| Route | Page | UI |
|-------|------|-----|
| `/login` | `Login.jsx` | Email/password, error/info alerts, link to register / forgot |
| `/register` | `Register.jsx` | Account creation (student/tutor/parent flows as implemented) |
| `/forgot-password` | `ForgotPassword.jsx` | Reset request |
| `/reset-password` | `ResetPassword.jsx` | New password |
| `/payment/success` | `PaymentSuccess.jsx` | PayHere success state |
| `/payment/cancel` | `PaymentCancel.jsx` | PayHere cancel state |

---

## 5. Digital library UI

| Route | Page / component | Features |
|-------|------------------|----------|
| `/library` | `Library.jsx` | Emerald hero banner, AdvancedSearch, category chips, infinite scroll book grid |
| `/library/:id` | `BookReaderPage.jsx` + `BookReader.jsx` | Title chrome, Drive iframe → PDF fallback → download/open |
| — | `BookCard.jsx` | Cover/title/author/category card → reader |
| — | `AdvancedSearch.jsx` | Query, language, category, author filters |

**Librarian admin** also lives at `/library-admin` (and via dashboard view) — see §6.6.

---

## 6. Dashboards & role portals (dark glass today)

Entry: `/dashboard` → `UserDashboard.jsx`  
- Redirects unauthenticated → `/login`  
- Admin → `/admin`  
- Unapproved → **Pending Approval** full-screen state  
- Else renders role dashboard (+ optional `RoleSwitcher`)

### 6.1 Student Portal — `StudentDashboard.jsx`

| Block | Features |
|-------|----------|
| Header | Welcome, Digital Library CTA, logout |
| Attendance alert | Warning when absences high |
| Attendance status | Rate, present/absent counts, recent log |
| Exam results | Table: exam, subject, marks, grade, remarks |
| Tuition fees | Month, due/paid/balance, partial payments, PayHere button, print receipt |
| Contact teacher | Query form to class tutor |
| LMS panel | `StudentLmsPanel` — assignments / course materials |

### 6.2 Parent Portal — `ParentDashboard.jsx`

| Block | Features |
|-------|----------|
| Header | Welcome |
| Activation alerts | Student activation notifications |
| Link child | By index number |
| Claim invite | Parent invite token |
| Per-child cards | Attendance alert, attendance log stats, class teacher contact |
| Fees | Bill month, total/paid/arrears, partials, print receipt, pay |
| Assignments | Child progress / homework summary |
| Leave request | Start/end/reason submit |
| Leave history | Status + tutor reply |
| Grades report | Child exam results |

### 6.3 Tutor Portal — `TutorDashboard.jsx`

| Block | Features |
|-------|----------|
| Header | Welcome; link to Treasurer panel if role; Library |
| Academic job | Assigned responsibilities |
| Salary statement | Monthly salary history |
| Attendance config | Select class |
| Attendance logger | Mark students present/absent; save day |
| Leave queue | Pending leave requests; approve/reject + reply |
| LMS panel | `TutorLmsPanel` — create/manage assignments |

### 6.4 Treasurer Portal — `TreasurerDashboard.jsx`

| Block | Features |
|-------|----------|
| Header | Financial ledger title; back to tutor view |
| KPI cards | Total collected, expected billings, arrears |
| Auto-generate fees | Trigger monthly fee generation (edge function) |
| Student search | Select student |
| Tuition logger | Month, total due, deposit amount, remarks, log payment, print receipt |
| Tutor search | Select staff |
| Salary payout logger | Month, amount, log payout, recent history |

### 6.5 Principal / VP — `PrincipalDashboard.jsx`

Tabs (VP mode uses blue accent; Principal emerald):

| Tab | Features |
|-----|----------|
| Overview | Stats: students, tutors, pending leaves, pending approvals, fees collected, more KPIs |
| Announcements | Create + list published announcements |
| Leaves | Leave review queue + decision panel |
| Approvals | Signup approvals (principal only, not VP) |
| Timetable | Add schedule entry + weekly grid |
| Results | Exam results overview |

### 6.6 Librarian — `LibrarianDashboard.jsx` (`/library-admin`)

| Block | Features |
|-------|----------|
| Header | Library admin title |
| Add / update book | Form: titles EN/AR, authors, category, language, Drive IDs/URLs, publish |
| Latest books | List/edit/delete recent catalog entries |

### 6.7 Admin Console — `AdminDashboard.jsx` (`/admin`)

**Chrome:** dark shell, glass KPI cards, horizontal tab strip, large glass content panel.

| Tab ID | Label | Features / nested UI |
|--------|-------|----------------------|
| `admissions` | Admissions | Pending admission applications table; approve/reject actions |
| `crm` | CRM Pipeline | `AdmissionsCrmBoard` — stages: Lead → Submitted → Interview → Accepted → Enrolled / Rejected; notes; enroll with index + class |
| `hrm` | Staff HRM | `StaffHrmPanel` — staff records (dept, title, start, emergency), salary month list, print salary slip, document upload hooks |
| `imports` | Shamela Import | `ImportJobsPanel` — import job status / trigger UI |
| `org` | Organization | `OrgAdminPanel` — primary color, taglines EN/AR, support email/phone |
| `approvals` | Signups | Pending student/tutor profile approvals |
| `tutors` | Tutors & Roles | Assign special roles (treasurer/principal/VP/etc.); add tutor job title/description |
| `broadcast` | Broadcast | Title, message, target audience; send campus-wide notification |
| `content` | Content CMS | `AdminContentCMS` sections: News, Faculty, Curriculum, Gallery, Courses |
| `indexes` | Index Pre-seed | Pre-create valid student index numbers + names/classes |
| `analytics` | Analytics | `AnalyticsDashboard` — charts (admissions, users, etc.) |

**Top of admin:** summary cards + small bar chart before tabs.

---

## 7. Shared feature components (must keep in new UI)

| Component | Purpose |
|-----------|---------|
| `NotificationBell` | In-app notifications + prefs |
| `PayFeeButton` | Launch PayHere checkout for a fee row |
| `AdmissionsCrmBoard` | Kanban/list CRM for admissions |
| `StaffHrmPanel` | HR records + salaries |
| `ImportJobsPanel` | Shamela / catalog import jobs |
| `OrgAdminPanel` | Org branding |
| `AdminContentCMS` | Public site content CRUD |
| `StudentLmsPanel` / `TutorLmsPanel` | LMS assignments |
| Library trio | Search, BookCard, BookReader |
| `RoleSwitcher` | Switch dashboard view for multi-role users |

---

## 8. Feature → UI inventory (complete checklist)

Use this as the enhancement acceptance checklist. Every item needs a designed screen/state.

### Identity & access

- [ ] Login / Register / Forgot / Reset  
- [ ] Pending approval waiting screen  
- [ ] Role-based redirects (admin vs dashboard)  
- [ ] Logout  
- [ ] EN ↔ AR + RTL layout  

### Public college

- [ ] Home (hero, portals, programs)  
- [ ] About, Courses, Curriculum, Faculty, Gallery  
- [ ] News list + detail  
- [ ] Admissions application  
- [ ] Contact  
- [ ] 404  

### Library

- [ ] Browse + filters + infinite load  
- [ ] Book detail/reader (iframe / PDF / fallback)  
- [ ] Librarian CRUD catalog  

### Academic

- [ ] Student attendance + grades  
- [ ] Student ↔ tutor queries  
- [ ] Tutor attendance marking by class  
- [ ] Tutor leave approve/reject  
- [ ] Parent leave request + history  
- [ ] Principal timetable CRUD + grid  
- [ ] Principal announcements  
- [ ] Principal/VP leave + (principal) approvals  
- [ ] Exam results overview (principal)  
- [ ] LMS assignments (student view / tutor manage)  

### Finance

- [ ] Monthly fee statements (student/parent)  
- [ ] Partial payments log  
- [ ] PayHere pay button + success/cancel pages  
- [ ] Print fee receipt  
- [ ] Treasurer generate monthly fees  
- [ ] Treasurer log tuition deposits  
- [ ] Treasurer tutor salary payouts  
- [ ] Tutor salary statement view  
- [ ] HRM salary slip print  

### Admissions & CRM

- [ ] Public admissions form  
- [ ] Admin pending admissions table  
- [ ] CRM stage pipeline + notes  
- [ ] Enroll → index number + class  

### People & ops

- [ ] Signup approvals (admin / principal)  
- [ ] Tutor role assignment  
- [ ] Tutor job responsibilities  
- [ ] Staff HRM profiles  
- [ ] Index number pre-seed  
- [ ] Parent link by index  
- [ ] Parent invite token claim  
- [ ] Broadcast notifications  
- [ ] Notification bell  

### Content & org

- [ ] CMS: news, faculty, curriculum, gallery, courses  
- [ ] Org branding (colors, taglines, support)  
- [ ] Analytics charts  
- [ ] Shamela import jobs UI  

### Platform chrome

- [ ] Sticky nav + mobile menu  
- [ ] Footer  
- [ ] Offline banner  
- [ ] PWA install prompt  
- [ ] Toasts / empty / loading / error states  

---

## 9. Information architecture (sitemap)

```
/ (Home)
├── /about
├── /courses · /curriculum · /faculty
├── /library · /library/:id
├── /gallery · /news · /news/:id
├── /admissions · /contact
├── /login · /register · /forgot-password · /reset-password
├── /payment/success · /payment/cancel
├── /dashboard
│     ├── StudentDashboard
│     ├── ParentDashboard
│     ├── TutorDashboard
│     ├── TreasurerDashboard   (?view=treasurer)
│     ├── PrincipalDashboard   (?view=principal|vp)
│     └── LibrarianDashboard
├── /admin                 (AdminDashboard + tabs)
└── /library-admin         (LibrarianDashboard)
```

---

## 10. Wireframe briefs (new UI)

### A. Marketing layout

1. **Nav** — compact, brand left, primary CTA “Apply” or “Login”.  
2. **Hero** — full-bleed campus/brand visual; brand name dominant; one headline; one sentence; one CTA group.  
3. **Portals** — 4 clear entries (not cluttered cards of stats).  
4. **Programs / news / CTA** — one purpose per section.  
5. **Footer** — contact + legal + language.

### B. App layout (all dashboards)

1. **App shell** — left sidebar (desktop) or bottom/top tabs (mobile); role label; language; notifications; logout.  
2. **Page header** — title + 1 primary action.  
3. **Content** — stats row (optional) → main work surface (table / form / board).  
4. **Empty / loading / error** — shared components.  
5. **No emoji-as-icon** — use icon set; keep Arabic headings readable.

### C. Admin

- Sidebar groups: **Admissions** (list + CRM), **People** (signups, tutors, HRM, indexes), **Finance insights**, **Content**, **Library import**, **Organization**, **Broadcast**, **Analytics**.  
- CRM: board or table with stage filters + detail drawer (notes + enroll).  
- CMS: section switcher + form + list.

### D. Library

- Search-first toolbar; filter chips; dense grid; reader with clean reading chrome (max text comfort for Arabic).

---

## 11. Component kit to build for enhancement

| Component | Variants |
|-----------|----------|
| Button | Primary, secondary, ghost, danger, icon |
| Input / Textarea / Select / Date | Label, error, hint; RTL |
| Badge / Chip | Success, warn, danger, info, stage |
| Card / Panel | Marketing vs app density |
| Stat | Icon + label + value |
| Tabs | Horizontal scroll / sidebar sections |
| DataTable | Sort, empty, row actions |
| Modal / Drawer | Confirm, form, detail |
| EmptyState | Illustration + CTA |
| Skeleton | List / card / table |
| Alert / Banner | Attendance alert, offline, pending |
| FileUpload | HRM docs |
| KanbanColumn | CRM stages |
| ReaderChrome | Library reader |

---

## 12. Roles & accent hints

| Role | Accent suggestion | Primary jobs |
|------|-------------------|--------------|
| Student | Emerald | Attendance, grades, fees, LMS, library |
| Parent | Amber | Children, fees, leave, grades |
| Tutor | Amber/teal | Attendance, leaves, LMS, salary |
| Treasurer | Gold/amber | Fees generate/log, salaries |
| Principal | Emerald | Campus ops, timetable, announcements |
| VP | Blue | Subset of principal (no some approvals) |
| Librarian | Emerald | Catalog CRUD |
| Admin | Teal/emerald | Full console |

---

## 13. i18n & a11y requirements (non-negotiable)

- All user-facing strings EN + AR.  
- `dir="rtl"` when Arabic; mirrored nav/sidebar.  
- Focus states, contrast AA+, skip-to-content.  
- Forms: labels, errors, disabled loading.  
- Tables usable on mobile (cards or horizontal scroll with sticky first column).

---

## 14. File map (implementation reference)

```
src/
  App.jsx
  index.css · tailwind.config.js
  pages/
    Home, About, Courses, Curriculum, Faculty, Gallery,
    News, NewsDetail, Admissions, Contact,
    Login, Register, ForgotPassword, ResetPassword,
    Library, BookReaderPage, LibraryPage,
    PaymentSuccess, PaymentCancel, NotFound,
    UserDashboard, StudentDashboard, ParentDashboard,
    TutorDashboard, TreasurerDashboard, PrincipalDashboard,
    LibrarianDashboard, AdminDashboard, AnalyticsDashboard
  components/
    Navbar, Footer, OfflineIndicator, InstallPrompt,
    NotificationBell, RoleSwitcher, PayFeeButton,
    AdmissionsCrmBoard, StaffHrmPanel, ImportJobsPanel,
    OrgAdminPanel, AdminContentCMS,
    StudentLmsPanel, TutorLmsPanel,
    library/{AdvancedSearch, BookCard, BookReader}
```

---

## 15. Mobile app UI (Expo) — full enhancement brief

> Folder: `mobile/` · Expo Router file-based screens · shares Supabase Auth + RLS with web.  
> Current UI is a **minimal light prototype** (slate background, emerald `#047857` buttons, white cards). Enhancement should match the **same brand tokens** as the new web app shell, with native patterns (tab bar, safe areas, pull-to-refresh).

### 15.1 Product role of mobile vs web

| Surface | Audience | Primary jobs |
|---------|----------|--------------|
| **Mobile app** | Parent, Student, Tutor (daily use) | Fees glance, results, children, leave queue, push-ready notifications, PayHere return deep links |
| **Web SPA / PWA** | Everyone + Admin / Treasurer / Principal / Librarian | Full ERP, CRM, HRM, CMS, library reader, analytics |
| **Web on phone** | Fallback | Heavy admin work; PayHere until native SDK |

**Do not build full Admin CRM/CMS inside native in v1** — deep-link or “Open in browser” for admin-only tools.

### 15.2 Current mobile design tokens

| Token | Value | Use |
|-------|-------|-----|
| Brand green | `#047857` / `#064e3b` | Headers, primary buttons, links |
| Canvas | `#f8fafc` | Screen backgrounds |
| Card | `#fff` + `#e2e8f0` border | Lists / fee rows |
| Muted text | `#64748b` | Subtitles, empty states |
| Sign-out button | `#334155` | Secondary destructive-ish |
| Radius | `12` | Inputs, cards, buttons |
| Header tint | `#047857` (`_layout.jsx` Stack) | Native nav bar |

**Enhancement:** introduce shared design tokens file (`mobile/theme/tokens.js`) mirroring web CSS variables; add Amiri/Noto for Arabic; support RTL (`I18nManager` + mirrored layouts); replace ad-hoc `StyleSheet` with a small UI kit.

### 15.3 Current screens (as implemented)

| Route file | Title | UI blocks / features today |
|------------|-------|----------------------------|
| `app/index.jsx` | Kashiful Hudha | Brand title, “Mobile portal”, config warning, Sign in; auto-route by `account_type` → parent/student/tutor (admin stays) |
| `app/login.jsx` | Sign in | Email + password fields, Sign in, Alert on error |
| `app/student.jsx` | Student | Latest fee card (month, paid/due, status); up to 5 recent results; Sign out |
| `app/parent.jsx` | Parent | Linked children list (name, index, class); recent fees (first child, 3 rows); Sign out; “Pay fees on web portal” link |
| `app/tutor.jsx` | Tutor | Pending leave requests list (name, dates, reason) — **view only**; Sign out |
| `app/payment-success.jsx` | Payment success | Success copy; back to portal; open web receipt |
| `app/payment-cancel.jsx` | Payment cancelled | Cancel copy + navigation (pair of success) |
| `app/_layout.jsx` | Root Stack | StatusBar dark; emerald header tint; all screens registered |

**Deep links:** scheme `kashifulhudha://` · Android intent `/payment*` · iOS associated domain `applinks:kashifulhudha.lk`.

**Env:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

### 15.4 Mobile information architecture (target enhanced UI)

```
App launch
├── Splash / brand
├── Auth
│     ├── Login
│     ├── Forgot password (link or screen)
│     └── (Register → prefer web or minimal native)
├── Role home (Bottom tabs — target)
│     ├── Student tabs: Home · Fees · Results · More
│     ├── Parent tabs: Children · Fees · Leaves · More
│     └── Tutor tabs: Leaves · Attendance · More
├── Payment success / cancel (deep link)
└── “Open full portal” → in-app browser to Vercel URL
```

### 15.5 Target mobile screens & feature checklist

#### Shell & auth

- [ ] Splash with logo + brand name  
- [ ] Login (email/password) + loading + inline errors  
- [ ] Forgot password  
- [ ] Session restore; Secure Store session  
- [ ] EN ↔ AR + RTL  
- [ ] Sign out  
- [ ] Pending-approval screen (parity with web)  
- [ ] Config-missing empty state (no Supabase env)  

#### Student (native parity with web essentials)

- [ ] Home: welcome, attendance rate summary, alert if high absences  
- [ ] Fees: current month + history; status badges; remaining balance  
- [ ] Pay fee → PayHere (WebBrowser / native SDK later)  
- [ ] Print/share receipt (share sheet)  
- [ ] Results list (exam, subject, marks, grade)  
- [ ] Recent attendance log  
- [ ] Ask tutor (query)  
- [ ] LMS assignments list (read)  
- [ ] Shortcut: open Digital Library (webview or external)  

#### Parent

- [ ] Children list + switch active child  
- [ ] Link child by index number  
- [ ] Claim parent invite token  
- [ ] Per-child attendance stats + alert  
- [ ] Class teacher contact (call/WhatsApp links)  
- [ ] Fees + arrears + pay CTA  
- [ ] Leave request form + history/status  
- [ ] Grades report  
- [ ] Assignments / progress snapshot  
- [ ] Activation / notification alerts  

#### Tutor

- [ ] Pending leave queue **with Approve / Reject + reply** (today view-only)  
- [ ] Class picker + mark attendance + save  
- [ ] Assigned job / role card  
- [ ] Salary statement (read-only)  
- [ ] LMS create/list assignments (lite)  
- [ ] Link to Treasurer **web** if role has treasurer  

#### Staff / admin (lite)

- [ ] Treasurer / Principal / Librarian / Admin: “Open web dashboard” card (not full native rebuild in v1)  
- [ ] Optional later: treasurer fee log, principal announcements  

#### Payments & notifications

- [ ] `payment-success` / `payment-cancel` polished states  
- [ ] Deep link handling from PayHere  
- [ ] Notification center (list + mark read) — mirror `NotificationBell`  
- [ ] Push prefs (when Expo notifications wired)  

#### Platform chrome

- [ ] Bottom tab bar per role  
- [ ] Safe area + keyboard avoiding  
- [ ] Pull-to-refresh on lists  
- [ ] Empty / skeleton / offline banner  
- [ ] Haptics on primary actions (optional)  

### 15.6 Mobile wireframe briefs (new UI)

**Home (index / role router)**  
- Full-bleed soft brand gradient or campus image; logo; college name; one CTA “Sign in”. No feature clutter.

**Login**  
- Centered form; logo above; primary emerald button; secondary text links. Keyboard-safe.

**Student Home tab**  
- Header greeting · 3 stat chips (attendance %, fees due, latest grade) · alert banner · shortcuts.

**Student Fees tab**  
- Large balance card · status badge · Pay button · history list.

**Parent Children tab**  
- Horizontal child switcher chips · selected child summary · link/invite actions in More.

**Tutor Leaves tab**  
- Card per request · expand for reason · Approve (emerald) / Reject (danger) · reply field.

**More tab (all roles)**  
- Language, notifications, open web portal, sign out, version.

### 15.7 Mobile component kit

| Component | Notes |
|-----------|--------|
| `AppButton` | Primary / secondary / danger / ghost |
| `AppInput` | Label, error, secure toggle |
| `AppCard` | Standard list surface |
| `StatChip` | Compact KPI |
| `Badge` | Fee/leave status |
| `EmptyState` | Icon + message + CTA |
| `ListSkeleton` | Loading |
| `ChildSwitcher` | Parent multi-child |
| `Screen` | SafeArea + scroll + refresh |
| `TabIcon` | Role tab icons (SVG, not emoji) |

### 15.8 File map (mobile)

```
mobile/
  app.json                 # name, scheme kashifulhudha, iOS/Android links
  package.json
  README.md
  lib/supabase.js          # client + isConfigured
  app/
    _layout.jsx            # Stack navigator
    index.jsx              # Brand + auth redirect
    login.jsx
    student.jsx
    parent.jsx
    tutor.jsx
    payment-success.jsx
    payment-cancel.jsx
  # Target additions for enhancement:
  # theme/tokens.js
  # components/{Button,Input,Card,Empty,Screen}.jsx
  # app/(student)/_layout.jsx  … tabs
  # app/(parent)/_layout.jsx
  # app/(tutor)/_layout.jsx
```

### 15.9 Web ↔ mobile feature parity matrix

| Feature | Web | Mobile today | Mobile target |
|---------|-----|--------------|---------------|
| Login | ✓ | ✓ | ✓ enhanced |
| Student fees + results | ✓ | ✓ lite | ✓ + pay + history |
| Student attendance / LMS / query | ✓ | ✗ | ✓ |
| Parent children + fees | ✓ | ✓ lite | ✓ full + invite/link |
| Parent leave / grades | ✓ | ✗ | ✓ |
| Tutor leave list | ✓ | ✓ read-only | ✓ approve/reject |
| Tutor attendance / LMS | ✓ | ✗ | ✓ |
| Treasurer / Principal / Admin | ✓ | ✗ | Web deep-link |
| Library reader | ✓ | ✗ | Webview / external |
| PayHere | ✓ | Deep link return only | Checkout + return |
| EN/AR RTL | ✓ | ✗ | ✓ |
| Notifications | ✓ bell | ✗ | ✓ list + push later |
| PWA install | ✓ | n/a | Native store apps |

### 15.10 Mobile enhancement delivery plan

1. **Theme + kit** — tokens, Button/Input/Card/Screen, Arabic fonts, RTL.  
2. **Auth polish** — splash, login, pending approval, secure session.  
3. **Tab shells** — student / parent / tutor bottom tabs.  
4. **Student + Parent** feature fill to web essentials.  
5. **Tutor** leave actions + attendance.  
6. **Payments** — WebBrowser PayHere + success/cancel polish.  
7. **Notifications** — in-app list; push optional.  
8. **Store prep** — icons, splash, EAS project id, screenshots.

---

## 16. Enhancement delivery plan (web + mobile)

### Web

1. **Tokens + kit** — colors, type, Button/Input/Table/Tabs/Empty.  
2. **Shell** — new Nav/Footer + app sidebar shell.  
3. **Marketing** — Home first, then About→Contact.  
4. **Auth** — Login/Register family.  
5. **Library** — browse + reader.  
6. **Role dashboards** — Student → Parent → Tutor → Treasurer → Principal → Librarian.  
7. **Admin** — re-group tabs into sidebar; redesign CRM/HRM/CMS.  
8. **Polish** — motion (2–3 intentional), empty states, mobile web QA, RTL QA.

### Mobile

Follow **§15.10** in parallel after shared tokens are defined (same brand greens/ambers).

---

## 17. Out of scope for UI-only pass (backend already exists)

Do not drop these integrations while restyling:

- Supabase Auth + RLS-backed data (web + mobile)  
- PayHere create-payment / notify + mobile deep links  
- Monthly fee generation edge function  
- Outbound SMS/email/WhatsApp outbox (when secrets set)  
- Shamela import pipeline  
- Org branding fields  
- Parent invite tokens  
- Expo Secure Store session  

---

*Document generated for UI enhancement planning (web + mobile). Update this file when features or routes change.*
