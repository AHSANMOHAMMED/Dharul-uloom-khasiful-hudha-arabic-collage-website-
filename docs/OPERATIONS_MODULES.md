# Reports, bulk import, documents & exam papers, cheques, reminders

All of these live in the ERP workspace (`/erp`). The database enforces every
rule; the screens only show what each role may do.

| Module (ERP sidebar) | Who sees it | Migration |
|---|---|---|
| Reports | Approved staff (each report only shows rows the person may read) | `0027_import_reports.sql` |
| Bulk import | Admin, admissions, academic admins, HR; marks import for lecturers | `0027_import_reports.sql` |
| Documents & exam papers | Approved staff | `0031_documents_exam_papers.sql` |
| Cheques | Finance viewers (treasurer, accountant, principal, VP, admin) | `0032_reminders_cheques.sql` |

## Reports

Student roster, staff directory, attendance summary, fee collection & arrears,
and exam results. Each one can be exported as:

- **Excel (.xlsx)**: every row, with filters and frozen header. Exam results add a
  mark sheet with one column per subject, totals, averages and ranks.
- **PDF / Print**: an A4 page on the college letterhead. In the print dialog,
  choose "Save as PDF". This keeps Arabic and Tamil text correct.
- **CSV**.

Report functions are `SECURITY INVOKER`, so tenancy, role rules and two-step
verification apply to every row. Reports are fetched in pages of 1,000, so
large reports are never cut short.

## Bulk import (Excel or CSV)

1. Download the template (required columns are dark green; a Help sheet explains each).
2. Upload the file. Unknown columns are listed and ignored.
3. **Check rows**: the server validates every row and reports errors per row.
4. **Import**: nothing is saved if any row has an error (all-or-nothing).

How each type works, since only the person can create their own login:

- **Students**: matched by index number. Existing accounts are updated. New index
  numbers are pre-registered with their details, and when the student signs up with
  that index number, their profile is filled in automatically.
- **Lecturers & staff**: matched by email. Existing accounts have their HR record
  updated; **roles of existing accounts are never changed by an import** (use Tutors &
  Roles). New emails get an invitation: signing up with that email approves the
  account and fills the HR record.
- **Exam marks**: choose the exam, then one row per student × subject code. Normal
  marks-entry permissions and exam-paper rules apply; grades are calculated.

## Documents & letterheads

- **Letterheads** (admins, principal, VP, IT officer): upload the printed letterhead
  or paper design as an image of the full A4 page (PNG/JPG, at least 1240×1754 px).
  Then set the margins so text sits inside the blank area. For a PDF or Word
  letterhead, export the page as an image first.
- **Editor**: an A4 page on the chosen letterhead with headings, lists, tables,
  images, alignment, Arabic right-to-left paragraphs, version history (restore any
  earlier version), and Ctrl/Cmd+S to save.
- **Word**: "Open Word file" / "Import from Word" reads `.docx`; "Word (.docx)" writes
  one with the letterhead behind every page.
- **Sharing**: with all staff, staff roles, or by link (only people with access can
  open it). "Share file" opens the phone's share sheet (WhatsApp, email, Drive…).
- Every document gets a reference number (`DUKH/<year>/<n>`). Shared HTML is
  sanitised (no scripts, no hot-linked images, no CSS `url()`).

## Exam papers (secure workflow)

```
exam officer assigns → examiner drafts → submits → IT reviews/formats → exam office approves (locked)
                                   ↑──────── returned with notes ────────┘          → printed → released after the exam
```

- Before release, only the **examiner**, the **exam office** (exam officer,
  principal, VP, admin) and **IT officers** (from submission) can open a paper. Other
  staff can't see it at all, and it can't be shared.
- Approval locks the paper. Only the exam office can reopen it, and a reason is required.
- Every open, print, download and state change is logged (Activity log on the paper).
- Prints carry a "CONFIDENTIAL" / "DRAFT — CONFIDENTIAL" watermark until release.
- New staff role **`it_officer`** (IT / exam printing): assign it in Tutors & Roles.

## Cheque register

- Cheques **received** (fees, donations) and **issued** (suppliers, salaries), with
  cheque number, bank, branch, **date on the cheque** (post-dated supported), drawer/payee.
- Status: in hand → deposited/presented → cleared | bounced | cancelled. A bounced
  cheque can be re-presented. Every change is recorded with date, person and reason.
- A fee payment recorded with method **cheque** creates the register entry
  automatically (the treasurer then adds the bank and date). One cheque paying several
  invoices is one entry.
- When a fee cheque **bounces**, the linked receipts are reversed (accountant) or the
  accountants are notified to reverse them.
- A post-dated cheque cannot be marked deposited before its date.

## Daily reminders

`public.run_daily_reminders()` sends in-app/push notifications for:

- tasks due today or tomorrow (assignee, once a day);
- overdue tasks (assignee and creator, every 3 days);
- received cheques that reach their date (deposit now), and issued cheques maturing in 2 days.

**Setup:** in Supabase → Database → Extensions, enable **pg_cron**, then re-run
`0032_reminders_cheques.sql` (it schedules the job daily at 07:00 Sri Lanka time).
Admins can also press **Send due reminders now** on the Cheques screen.

## ERP theme

The shared ERP UI kit (`src/components/erp/ui.jsx`) uses the light Modern Manuscript
theme. Older modules still contain dark-theme utility classes. A CSS bridge scoped to
`.erp-theme` in `src/index.css` maps them to readable light colours. Use theme tokens
in new code; the bridge stops matching a module once its classes are migrated.
