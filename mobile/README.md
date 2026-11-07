# Kashiful Hudha mobile (Expo)

Multi-role mobile portal for Dharul Uloom Kashiful Hudha. Built with Expo SDK 52, Expo Router v4 and React Native 0.76. It uses the same Supabase Auth, RLS and RPCs as the web SPA, so the database decides what each user can see or change. The app never sends `org_id`; the database fills it in.

## Setup

```bash
cd mobile
npm install
cat > .env <<'EOF'
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
# optional: web portal base used for "Open web portal", /erp, register, forgot password
EXPO_PUBLIC_WEB_URL=https://kashifulhudha.lk
EOF
npx expo start            # Expo Go / dev client
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | yes | Supabase project URL. Also used for the `create-payment` edge function. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon key. |
| `EXPO_PUBLIC_WEB_URL` | no | Web portal origin. Defaults to `https://kashifulhudha.lk`. |

The session is stored in `expo-secure-store`. The language choice is stored there too.

## Build with EAS

```bash
npm i -g eas-cli
eas login
eas init                      # writes the real projectId into app.json (extra.eas.projectId)
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://<project>.supabase.co
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key>
eas build -p android --profile preview      # installable APK
eas build -p android --profile production   # AAB for Play Store
eas build -p ios --profile production
```

Profiles are in `eas.json`. App ids: Android `lk.kashifulhudha.portal`, iOS `lk.kashifulhudha.portal`.

To check that every route compiles without a device:

```bash
npx expo export --platform android --output-dir /tmp/kh-export
npx expo-doctor
```

## Structure

```
app/
  _layout.jsx            providers (i18n, auth), root Stack, auth guard
  index.jsx              role router → /student | /parent | /staff | /admin | /pending
  login.jsx  pending.jsx
  payment-success.jsx    deep link kashifulhudha://payment-success?order_id=…
  payment-cancel.jsx     deep link kashifulhudha://payment-cancel?order_id=…
  student/   (tabs) index, fees, results, learn, more
  parent/    (tabs) index (children), alerts, settings
  staff/     (tabs) index, attendance*, leaves*, hr, dashboard*, more   (* depends on role)
  admin/     (tabs) index (dashboard), finance*, alerts, settings
  shared stack screens: notifications, settings, announcements, fees, results,
  report-card, attendance-history, timetable, certificates, hostel, leave-requests,
  discipline, link-child, child/[id], assignment/[id], payslips, payslip/[id],
  my-attendance, staff-leave, receipt/[id], receive-payment, dictionary,
  tasks, task/[id], duties, petty-cash-spend, mashoora
components/              UI kit (Screen, Card, Button, ListItem, Badge/StatusBadge,
                         EmptyState, Loading, ErrorBanner, Money, SectionHeader, Field,
                         Chips, StatTile, Row/KeyValue, RoleTabs, LiveIndicator, LiveToast)
                         + views/ (shared screens)
lib/                     supabase, auth context, roles (caps), i18n, payments, useAsync, format,
                         live (Realtime hooks + LiveProvider), push (registration + deep links),
                         receipts (PDF url, payment methods),
                         governance (task statuses / move rules, duty & account names)
```

## Role routing

| Profile | Portal |
| --- | --- |
| `role` admin / super_admin | `/admin` |
| `account_type` student / parent / tutor / staff and `is_approved` | `/student`, `/parent`, `/staff` |
| not approved, or guest | `/pending` (with "check again" and sign out) |

Inside the staff portal, the tabs depend on the user's roles (`lib/roles.js` mirrors the SQL helpers):

- Class attendance and student leave review are shown to teachers (`account_type = tutor`) and admins. These are the roles the RLS policies allow.
- The Dashboard tab is shown to principal, vice principal, treasurer, accountant, HR manager and exam officer. Finance roles also get the outstanding-fees list.

## Features

**Student**
- Home: greeting, attendance rate (`attendance_summary`), outstanding fees, unread notifications, next classes, latest announcements.
- Attendance history, timetable (`class_schedules` for the student's class).
- Results: list of published exams, then the report card (`student_report_card`).
- Fees: arrears (`student_arrears`: total, overdue, open months with overdue ones highlighted), receipts list (`fee_receipts`, newest first → receipt screen), and the statement from `student_fee_statement` with lines and a Pay button (PayHere).
- Learning:
  - Assignments for the student's class, with submitted / graded status.
  - Text answers are saved with an `lms_submissions` upsert on `(assignment_id, student_id)`. The student sees the grade and feedback, and the answer is locked once it is graded.
  - Materials with links and files.
- Certificates, plus document requests (`document_requests`).
- Hostel allocation, leave requests, notifications, settings.

**Parent**
- Children list (`parent_children` joined to `profiles`) and pending link requests.
- Link a child in one of two ways:
  - By index number with `request_child_link`. The app shows a "linked", "already linked" or "pending verification" message.
  - By invite code with `claim_parent_invite`.
- Per child: overview, attendance, published results and report cards, fees with arrears, receipts and Pay, leave requests (create and history), discipline notices, certificates, hostel, timetable.

**Teacher / staff**
- Check-in / check-out card (`staff_check_in` / `staff_check_out`) and my attendance (`staff_attendance`).
- Mark class attendance:
  1. Pick a class and a date.
  2. The app loads `class_attendance_sheet`.
  3. Set each student to present, absent, late or excused, or use "all present".
  4. Save. Rows are upserted into `attendance` on `(student_id, date)`.
- Review student leave requests: approve or reject with a response note (pending / approved / rejected filter).
- My timetable, leave balance (`staff_leave_balance`), and leave requests (create and cancel while pending).
- Payslips, as a list and a detail view (earnings, deductions, net).
- Announcements and notifications.

- My tasks, My duties (with petty cash) and Mashoora. See "Duties, petty cash, mashoora and tasks" below.

**Admin / principal / finance (lite)**
- `org_dashboard_stats` tiles:
  - Counts: students, staff, parents.
  - Pending approvals and parent link requests.
  - Attendance today.
  - Fees: this month, outstanding, 30-day collections.
  - Expenses, leave queues, discipline, document requests, hostel, last payroll.
- Finance roles: `fee_outstanding` list with a class filter.
- Finance staff (treasurer, accountant, admin — `caps.isFinanceStaff`): the **Receive payment** counter (see below), reachable from the outstanding list (tap a student), staff Home quick links, staff More and admin Settings.
- Link to the full ERP on the web (`/erp`).

**All roles**: notifications (tap to mark read, or mark all read; receipt notifications open the receipt), settings (my info, roles, language, sign out, open web portal). Students and staff also get **Word meaning** (Arabic → Tamil dictionary) in More.

## Receipts

`/receipt/[id]` loads `fee_receipt_details(p_receipt)` and shows the full slip: college, receipt no., date, student (index, class, parents, payer), month allocations (paid now, balance after), total, method, reference, total arrears after the payment, months still outstanding, received by, and a red **REVERSED** banner when `status = 'reversed'`.

- **Open PDF** opens `{EXPO_PUBLIC_SUPABASE_URL}/functions/v1/receipt-pdf?t=<public_token>` with `WebBrowser.openBrowserAsync` (no auth; the 128-bit token is the credential).
- **Share** uses the React Native `Share` API with a text summary and the PDF link.
- The screen listens to `fee_receipts` (`id=eq.<id>`), so a reversal appears immediately.

## Accountant / treasurer counter

`/receive-payment` (finance staff only; RLS + `is_finance_staff()` in the RPC are the real gate):

1. Search students (`profiles`, `account_type = student`, `full_name` or `index_number` `ilike`).
2. The student's arrears load from `student_arrears` (live on `student_fees`). Tap a month to pay it first (`p_fee`); otherwise the server allocates oldest month first.
3. Amount with quick **Oldest month** / **All arrears**, method chips (cash, bank transfer, cheque, online, other), reference (required unless cash), payer name, note.
4. Confirm → `receive_student_payment(...)` → the app replaces the screen with the new receipt. The server notifies the student and every linked parent (in-app, push, SMS / e-mail).

## Duties, petty cash, mashoora and tasks

These screens use migration `0022_governance_duties_mashoora.sql`. They are open to employees (`caps.isEmployee`). RLS and the `tg_tasks_guard` trigger are the real gate. Entry points:

- Staff Home: quick links (My tasks, My duties, Mashoora) and a **My open tasks** tile. The count is my tasks with `status <> 'done'`, kept fresh by Realtime on `tasks`.
- Staff More: the same three links.
- Admin Settings: My tasks and Mashoora.

**`/tasks`: My tasks board**
- Four columns: To do, In progress, Review, Done. Use the segment bar (with counts) or swipe between pages. The pages are a horizontal paging `ScrollView`; no extra dependency.
- Filter: **Mine** (default, `assignee_id = me`) or **All tasks** of the institution.
- Each card shows:
  - title and priority;
  - due date, in red when overdue;
  - duty name in the chosen language (`name_ta` / `name_ar` / `name_en`);
  - the mashoora it came from, and the assignee in the All view.
- Cards have back and forward buttons. The board follows the DB rules (`lib/governance.js#canMoveTask`):
  - an assignee who did not create a task can move it up to **Review**, but not to Done ("waiting for the person who assigned it");
  - the creator and governance (admin, principal, vice principal: `caps.isGovernance`) can mark it Done.
- DB errors, and updates that RLS silently blocks (0 rows), are shown in an Alert.
- **Add my own task** opens a modal: title, description, priority, optional due date, and optionally one of my active duties. It inserts with `assignee_id = me`.
- Live: `useLiveReload(['tasks'], 'assignee_id=eq.<me>' | none)`.

**`/task/[id]`: task detail**
- Status, priority, due date, assignee, assigned by, duty, mashoora, completion time and description.
- "Move to" buttons, with the same rules as the board.
- Comments thread. New comments are inserted into `task_comments` with `author_id = me`.
- History from `task_events`: created, moved and reassigned events.
- Live on `tasks` (`id=eq.`) and `task_comments` (`task_id=eq.`).

**`/duties`: My duties**
- Active duties: since date, the mashoora where it was decided, academic year and category.
- **Holders over the years** (`duty_history(p_duty)`).
- For a duty with a `petty_cash_funds` row:
  - balance from `petty_cash_balance(p_fund)`: available, awaiting approval, posted, and fund limit;
  - the last 5 entries (top-up, spend, return) with their status;
  - **Record a spend**.
- Past duties: period, mashoora and end reason.
- Live on `duty_assignments` and `petty_cash_entries`.

**`/petty-cash-spend?fund=<id>&duty=<name>`**
- Fields: amount, expense account picker (`accounts` with `type = 'expense'`; employees can read these; with a search box when there are more than 8), description, vendor and date.
- It calls `petty_cash_spend(...)`. The entry is `submitted` until accounts approve it with `review_petty_cash`.
- DB errors (not the holder, over the available balance, wrong account) are shown in an Alert.

**`/mashoora`**
- A read-only list of the last 30 meetings, filtered by type (weekly, annual, special): type, status, date and decisions (expandable).
- Under each meeting, the duties (`duty_assignments.meeting_id`) and tasks (`tasks.meeting_id`) decided there. Tasks open the task detail.

## Live updates (Supabase Realtime)

`lib/live.js`:

- `useLiveTable({ table, filter, event, onChange, enabled })` subscribes with `supabase.channel(...).on('postgres_changes', …)` and removes the channel on unmount. Returns `{ status, live }` (`live` = SUBSCRIBED).
- `useLiveReload(tables, filter, reload, enabled)` debounces a re-fetch when any table changes.
- `LiveProvider` (root layout) subscribes to the signed-in user's `notifications` (`user_id=eq.<uid>`). New rows show an in-app banner (`LiveToast`: title, message, tap to open, auto-hide after 6 s). The unread count is exposed through `useLive()` and shown as a badge on the header bell in every portal.

Screens that re-fetch on change for the relevant student (`student_id=eq.<id>`):

| Screen | Tables |
| --- | --- |
| Fees (student, parent per child) | `student_fees`, `fee_receipts` |
| Child overview | `student_fees`, `attendance` |
| Attendance history | `attendance` |
| Leave requests | `leave_requests` |
| Receive payment | `student_fees` |
| Notifications | `notifications` (`user_id`) |
| My tasks, staff Home badge | `tasks` (`assignee_id`, or all in the All view) |
| Task detail | `tasks` (`id`), `task_comments` (`task_id`) |
| My duties | `duty_assignments`, `petty_cash_entries` |
| Mashoora | `tasks`, `duty_assignments` |

A small green **Live** pill shows while the channel is SUBSCRIBED. RLS applies to Realtime, so clients only receive rows they could read anyway. Pull-to-refresh and refresh-on-focus still work if the socket is down.

## Push notifications and deep links

`lib/push.js` registers the Expo push token (`register_push_token`) and routes taps:

- `data.type = 'fee_receipt'` → `/receipt/<data.receipt_id>`
- `data.type = 'task'` → `/task/<data.task_id>`
- `data.type = 'duty'` → `/duties`
- otherwise `data.link` if it is an app route (e.g. `/receipt/<id>`, `/announcements`)
- otherwise web ERP links with a mobile screen: `/erp?module=tasks` → `/tasks`, `module=duties` → `/duties`, `module=mashoora` → `/mashoora`
- otherwise `/notifications`

Taps are handled while running (`addNotificationResponseReceivedListener`) and on cold start (`getLastNotificationResponseAsync`, after the session is restored). Each response is handled once, and the related notification row (`data.notification_id`) is marked read. In-app notification rows use the same routing (`notificationRoute({ data, link })`).

## Word meaning (Arabic → Tamil)

`/dictionary`: type one Arabic word (RTL input) and an optional sentence for context. The app calls

```
POST {EXPO_PUBLIC_SUPABASE_URL}/functions/v1/translate-word
Authorization: Bearer <access_token>   apikey: <anon>
{ "word": "…", "context": "…" }
```

If the edge function cannot be reached it falls back to `rpc('lookup_arabic_word', { p_word, p_limit: 8 })`. Each result shows the Tamil meaning prominently, then root, part of speech, English and an example, with a **Verified** or **AI · unverified** badge.

## Languages: EN / AR / TA

- `lib/i18n.js` holds the English, Arabic and (Sri Lankan) Tamil dictionaries. Every key must exist in all three. Every UI string goes through `t()`.
- The language toggle is on the login screen and in Settings. The choice is saved in SecureStore.
- RTL is handled with manual helpers (`row`, `textAlign`, `chevron`), and the tab order is mirrored. `I18nManager` is never forced, so no app restart is needed.

## Payments (PayHere)

1. On an unpaid or partial invoice, Pay sends:
   ```
   POST {EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment
   Authorization: Bearer <access_token>   apikey: <anon>   Content-Type: application/json
   { "fee_id": "<student_fees.id>", "client": "mobile" }
   ```
2. The response contains `hosted_checkout_url`. The app opens it with `WebBrowser.openAuthSessionAsync(url, 'kashifulhudha://')`.
3. After checkout, PayHere returns to the web site. The site redirects to `kashifulhudha://payment-success?order_id=…` or `kashifulhudha://payment-cancel?order_id=…`.
4. `/payment-success` polls `payment_transactions` (by `gateway_order_id`) every 2.5 seconds for up to about 30 seconds:
   - When the status is `paid`, it shows the amount and the receipt number from `fee_payments.gateway_txn_id`.
   - Otherwise it shows "processing", because the webhook settles asynchronously. The user can check again.
5. Fee screens reload whenever they get focus again.

## Deep links

The scheme is `kashifulhudha`. Expo registers it on Android and iOS automatically. Expo Router maps paths directly:

- `kashifulhudha://payment-success?order_id=KH-…`
- `kashifulhudha://payment-cancel?order_id=KH-…`
- Any other route also works, for example `kashifulhudha://notifications` or `kashifulhudha://receipt/<id>`.

To test locally:

```bash
npx uri-scheme open "kashifulhudha://payment-success?order_id=TEST" --android
```
