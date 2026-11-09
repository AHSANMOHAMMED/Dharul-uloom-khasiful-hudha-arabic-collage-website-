# Role & RLS matrix

Enforced in the database (RLS policies + `SECURITY DEFINER` RPC checks), not only in the UI.
SQL helpers live in `0015_security_tenancy.sql`; every tenant table also carries a
**RESTRICTIVE `tenant isolation` policy** (`org_id = current_org_id()` or super admin),
so no role can read or write another institution's rows.

## Identity model

| Field | Values | Meaning |
|---|---|---|
| `profiles.role` | `user`, `librarian`, `admin`, `super_admin` | admin = institution administrator; super_admin = SaaS operator |
| `profiles.account_type` | `guest`, `student`, `parent`, `tutor`, `staff` | portal type (`staff` = non-teaching employee) |
| `profiles.assigned_tutor_role` + `extra_roles[]` | `principal`, `vice_principal`, `treasurer`, `accountant`, `hr_manager`, `librarian`, `admissions_officer`, `warden`, `counselor`, `exam_officer` | duties (one person may hold several) |
| `profiles.is_approved` | bool | staff/student duties only work once approved |
| `profiles.org_id` | uuid | tenant (set by sign-up trigger / invitation / index record) |

Only admins can change these fields (trigger `tg_profiles_guard`); admins cannot grant
`super_admin`, change their own role, or move users between organizations.

## Capabilities

| Capability | Student | Parent | Tutor | Treasurer | Accountant | HR | Principal/VP | Admissions | Warden/Counselor | Librarian | Admin |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Own profile (name/phone) | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ |
| Org directory (profiles) | — | linked children | read | read | read | read | read | read | read | read | full |
| Approve accounts | — | — | — | — | — | — | tutors/students/staff | — | — | — | all |
| Attendance / results entry | — | — | ✏️ | — | — | — | ✏️ (+ published edits) | — | — | — | ✏️ |
| Results visibility | own, **published only** | children, published | all | all | all | all | all | all | all | all | all |
| Academic structure, exams, promotion | read | read | read | read | read | read | ✏️ | read | read | read | ✏️ |
| Student records (`student_details`) | own | children | read | read | read | read | ✏️ | ✏️ | read | read | ✏️ |
| Admissions CRM, follow-ups, enrol, parent links | — | request link | — | — | — | — | ✏️ | ✏️ | — | — | ✏️ |
| Invoices (create/adjust) | own read | children read | — | ✏️ | ✏️ | — | read | — | — | — | ✏️ |
| Record receipt (`record_fee_payment`) | — | — | — | ✏️ | ✏️ | — | — | — | — | — | ✏️ |
| Reverse receipt / waive / concessions | — | — | — | — | ✏️ | — | waive, concessions | — | — | — | ✏️ |
| PayHere checkout | own | children | — | — | — | — | — | — | — | — | ✏️ |
| Chart of accounts, journals, period lock | — | — | — | read | ✏️ | — | read | — | — | — | ✏️ |
| Financial reports | — | — | — | ✏️ | ✏️ | — | ✏️ | — | — | — | ✏️ |
| Expense claim submit | — | — | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ | ✏️ |
| Expense approve (≠ submitter) / pay | — | — | — | pay | approve + pay | — | approve | — | — | — | both |
| Donations | — | — | — | ✏️ | ✏️ (+ reverse) | — | read | — | — | — | ✏️ |
| Salary profiles / payroll generate | own read | — | own read | read | ✏️ | ✏️ | read | — | — | — | ✏️ |
| Payroll approve (≠ preparer) / pay | — | — | — | pay | approve + pay | — | approve | — | — | — | both |
| Payslips | — | — | own (approved/paid) | all | all | all | all | — | — | — | all |
| Staff attendance / leave approval | — | — | own + request | own | own | ✏️ | ✏️ | own | own | own | ✏️ |
| Hostel | own allocation | child | read | read | read | read | ✏️ | read | ✏️ (warden) | read | ✏️ |
| Discipline incidents | own | children | report | report | report | report | ✏️ | report | ✏️ | report | ✏️ |
| Welfare cases (confidential) | — | — | assigned only | — | — | — | ✏️ | — | ✏️ | — | ✏️ |
| Certificates issue / revoke | own read | children read | read | read | read | read | ✏️ | read | read | read | ✏️ |
| Library catalog | read | read | read | read | read | read | read | read | read | ✏️ | ✏️ |
| Audit log | — | — | — | — | read | — | — | — | — | — | read |
| Organization branding | — | — | — | — | — | — | — | — | — | — | own org |
| Finance Hub (billing jobs, bills, quotations) | — | — | — | ✏️ | ✏️ | — | read/create | — | — | — | ✏️ |
| Hard-delete voided finance docs | — | — | — | — | — | — | — | — | — | — | super_admin only |
| Plans, tenants, suspension, communities, user ACL | — | — | — | — | — | — | — | — | — | — | super_admin only |

Public (anon): website content, `verify_student_index`, `verify_certificate(code)`, finance doc tokens (`/q/:token`, `/b/:token`), fee receipts (`/r/:token`).

See also [FINANCE_HUB.md](./FINANCE_HUB.md) and Super Admin `/platform` sidebar (identity, role/user feature ACL, communities, audit feed).

## Integrity rules (database-enforced)

- Money is `numeric`; invoices = sum of append-only `fee_invoice_lines`; `paid_amount` = sum of posted `fee_payments`.
- `fee_payments`, posted `journal_entries`/`journal_lines` are immutable; corrections are reversals.
- Every posted journal balances (debits = credits); posting into a locked period is rejected.
- Gateway settlement (`apply_gateway_payment`) is idempotent and rejects amount/currency tampering.
- Segregation of duties: expense approver ≠ submitter; payroll approver ≠ preparer (admins excepted).
- Sensitive tables are captured in `audit_logs` (profiles, fees, payments, payroll, journals, HR, certificates…).
- Direct messages are restricted to the two conversation participants; students/parents can contact approved staff, and staff can contact approved users in their own institution. WhatsApp alerts are independently controlled by each recipient's notification preference.

Tests: `npm run test:db` (135 assertions in `supabase/tests/rls_erp_test.sql`).
