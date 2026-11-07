# DHĀRUL ULŪM KASHIFUL HUDĀHĀ
# COMPLETE UNIVERSITY & ARABIC COLLEGE MANAGEMENT PLATFORM
## Master Product Requirements, Features, Architecture, Database, Workflows and AI Build Instructions

**Institution:** Dhārul Ulūm Kashiful Hudāhā Arabic College  
**Location:** Kalpitiya, Sri Lanka  
**Platform:** Unified College ERP + LMS + Finance + HRM + Digital Islamic Library  
**Languages:** English, Arabic and Tamil (planned multilingual support)  
**Primary stack:** React + Vite + Supabase + PostgreSQL + Vercel  
**Mobile:** Expo React Native  
**Document version:** 1.0  
**Related live docs:** [PLATFORM_GUIDE.md](./PLATFORM_GUIDE.md) · [UI_ENHANCEMENT_SPEC.md](./UI_ENHANCEMENT_SPEC.md) · [GO_LIVE.md](./GO_LIVE.md) · [ROLE_RLS_MATRIX.md](./ROLE_RLS_MATRIX.md)

---

# 1. PROJECT VISION

Build one complete digital platform to manage every important operation of Dhārul Ulūm Kashiful Hudāhā Arabic College.

The platform must serve students, parents, lecturers, tutors, administrative staff, accountants, principals, librarians and management.

The system must replace disconnected manual processes with a centralized, secure and easy-to-use system.

The platform must include:

1. Public college website.
2. Student account management.
3. Parent account management.
4. Lecturer and tutor account management.
5. Admissions and registration.
6. Academic management.
7. Attendance management.
8. Examination and results management.
9. Monthly student fee collection.
10. Lecturer salary and payroll management.
11. Complete accounting and financial reporting.
12. Library and Shamela integration.
13. Learning management system.
14. Hostel and accommodation management.
15. Student welfare and discipline.
16. Staff HR management.
17. Notifications and communication.
18. Mobile application.
19. Admin dashboard and analytics.
20. Document and certificate management.

**Main objective:** One login, one database, one centralized platform, and role-specific dashboards for the entire institution.

---

# 2. IMPORTANT DEVELOPMENT RULES

The existing project already contains a React frontend, Supabase integration, authentication, academic features, library features, finance-related components and mobile application foundations.

Do not rebuild everything blindly.

Before implementation:

- Inspect the existing Git repository.
- Inspect every frontend page and component.
- Inspect all Supabase migrations.
- Inspect existing tables, triggers, functions and RLS policies.
- Inspect existing authentication and role logic.
- Inspect existing payment integration.
- Inspect the existing mobile app.
- Identify completed, partially completed, broken and missing features.
- Preserve existing working functionality.
- Avoid creating duplicate database tables.
- Avoid creating duplicate API functions.
- Keep existing user data safe.
- Write database changes as incremental migrations.
- Test every module before marking it complete.

Every feature must have a working frontend, database integration, validation, authorization and error handling.

A screen with static or sample data must never be marked as completed.

---

# 3. COMPLETE USER AND ACCOUNT MANAGEMENT

## 3.1 User categories

The platform must support these account types:

| Account type | Purpose |
|---|---|
| Public visitor | Access public website and public library |
| Applicant | Apply for college admission |
| Student | Academic and financial portal |
| Parent / Guardian | Monitor linked students |
| Lecturer | Manage teaching activities |
| Tutor | Manage assigned classes and students |
| Principal | Academic and institutional leadership |
| Vice Principal | Assigned leadership responsibilities |
| Treasurer | Fees, accounting and financial operations |
| Accountant | Accounting and financial reporting |
| HR Manager | Staff and payroll management |
| Librarian | Library operations |
| Admission Officer | Application processing |
| Academic Coordinator | Academic administration |
| Hostel Warden | Hostel management |
| Office Staff | Assigned administrative work |
| System Administrator | Platform configuration and security |
| Super Administrator | Full system ownership |

A user may have multiple staff responsibilities. For example, a lecturer may also be a tutor.

Use a flexible role and permission system rather than relying only on one role column.

## 3.2 Account registration

Required functionality:

- Student registration.
- Parent registration.
- Lecturer registration.
- Staff registration.
- Public account registration.
- Email verification.
- Password creation.
- Password reset.
- Account activation.
- Account suspension.
- Account deactivation.
- Profile updates.
- Profile photograph.
- Contact details.
- Emergency contact.
- Address.
- Language preference.
- Login history.
- Session management.
- Two-factor authentication where supported.

## 3.3 Student account registration

Student registration must be controlled.

Recommended process:

1. Admission office creates or approves an admission.
2. System generates a unique student index number.
3. Student receives a registration invitation.
4. Student registers using the verified index number.
5. System verifies the index number.
6. Student creates login credentials.
7. Profile is linked to the existing student record.
8. Principal or authorized staff approves the account.
9. Student dashboard becomes available.

Never allow a public user to claim an existing student index number without verification.

## 3.4 Student profile

Student profile should include:

- Student ID / Index number.
- Full name.
- Arabic name.
- Date of birth.
- Gender where institutionally required.
- Nationality.
- Address.
- Phone number.
- Email.
- Admission date.
- Academic year.
- Programme.
- Class.
- Batch.
- Assigned tutor.
- Parent or guardian.
- Emergency contact.
- Previous education.
- Student photograph.
- Student status.
- Documents.
- Fee plan.
- Scholarship or discount.
- Medical/emergency information with restricted access.

## 3.5 Parent account

Parents must be able to:

- Register or accept an invitation.
- Link one or multiple children.
- View each child's attendance.
- View examination results.
- View monthly fee balances.
- Pay student fees.
- Download receipts.
- Submit leave requests.
- View timetables.
- Receive announcements.
- Receive academic notifications.
- Contact authorized staff.
- View important student documents.

A parent must only access children linked and verified through the institution.

## 3.6 Account approval and status

Support these account statuses:

- Pending verification.
- Pending approval.
- Active.
- Suspended.
- Rejected.
- Graduated.
- Withdrawn.
- Archived.

Keep account status separate from academic enrolment status.

---

# 4. STUDENT MANAGEMENT SYSTEM

The student management module must provide a complete record of each student.

Features:

- Student registration.
- Student profile.
- Student ID generation.
- Student photograph.
- Academic history.
- Class allocation.
- Programme allocation.
- Batch allocation.
- Academic year management.
- Student promotion.
- Student transfer.
- Student withdrawal.
- Student graduation.
- Student document uploads.
- Parent linking.
- Student search and filters.
- Bulk import from Excel.
- Bulk export.
- Student reports.
- Student status history.

## Student dashboard

Display:

- Student information.
- Current academic year.
- Current class.
- Attendance percentage.
- Upcoming examinations.
- Latest results.
- Monthly fees.
- Outstanding balance.
- Recent payments.
- Learning materials.
- Assignments.
- Announcements.
- Library activity.
- Timetable.
- Notifications.

---

# 5. ADMISSIONS AND ENROLMENT CRM

Create a complete admission management system.

## Applicant workflow

New enquiry → Application → Document verification → Interview → Review → Acceptance → Enrolment → Student account activation.

Features:

- Online admission application.
- Offline application entry.
- Applicant records.
- Application number generation.
- Document uploads.
- Interview scheduling.
- Application fee tracking.
- Admission status.
- Staff notes.
- Application history.
- Admission approval.
- Rejection reasons.
- Waiting list.
- Programme allocation.
- Class allocation.
- Student index generation.
- Parent invitation.
- Admission reporting.

CRM stages:

- New enquiry.
- Contacted.
- Application received.
- Documents pending.
- Interview scheduled.
- Under review.
- Accepted.
- Rejected.
- Waiting list.
- Enrolled.

All status changes must be recorded with user, date and reason.

---

# 6. ACADEMIC MANAGEMENT SYSTEM

## 6.1 Academic structure

Support:

- Academic years.
- Terms or semesters.
- Programmes.
- Courses.
- Subjects.
- Departments.
- Classes.
- Batches.
- Sections.
- Academic levels.
- Curriculum.
- Teaching assignments.
- Class schedules.

## 6.2 Course and subject management

Administrators can:

- Create programmes.
- Create courses.
- Add subjects.
- Assign subjects to classes.
- Assign lecturers.
- Set learning outcomes.
- Set course duration.
- Upload course documents.
- Manage curriculum versions.

## 6.3 Timetable

Features:

- Weekly timetable.
- Lecturer timetable.
- Student timetable.
- Classroom allocation.
- Subject allocation.
- Period management.
- Conflict detection.
- Timetable publication.
- Timetable changes.
- Holiday calendar.

Prevent double-booking of lecturers and classrooms.

## 6.4 Attendance

Attendance statuses:

- Present.
- Absent.
- Late.
- Excused.
- On leave.

Features:

- Daily attendance.
- Period-wise attendance.
- Class-wise attendance.
- Lecturer attendance.
- Attendance correction requests.
- Approval workflow.
- Monthly reports.
- Attendance percentage.
- Parent notifications.
- Low-attendance alerts.
- Export to Excel and PDF.

Maintain an audit trail for corrections.

## 6.5 Examination and results

Features:

- Examination creation.
- Examination schedules.
- Subject allocation.
- Marks entry.
- Marks verification.
- Grade calculation.
- GPA or institutional grading rules.
- Result publication.
- Student result history.
- Class performance.
- Rank lists where permitted.
- Transcript generation.
- Report cards.
- Re-examination management.
- Result correction approval.

All grading rules must be configurable by authorized academic administrators.

---

# 7. STUDENT MONTHLY FEES AND PAYMENT MANAGEMENT

**This is a mandatory core financial module.**

The system must manage monthly student fees from generation through payment, reconciliation and reporting.

## 7.1 Fee configuration

Support different fee structures:

- Monthly tuition fee.
- Admission fee.
- Registration fee.
- Examination fee.
- Hostel fee.
- Library fee.
- Transport fee.
- Activity fee.
- Other approved charges.

Allow fee plans to vary by:

- Programme.
- Class.
- Academic year.
- Student category.
- Scholarship.
- Approved discount.
- Individual student agreement.

## 7.2 Monthly fee generation

Authorized finance staff must be able to:

- Generate monthly fees manually.
- Generate fees automatically on a scheduled date.
- Generate fees for all active students.
- Generate fees for selected classes.
- Exclude approved fee exemptions.
- Apply discounts.
- Apply scholarships.
- Set due dates.
- Preview the fee batch before confirmation.
- Prevent duplicate monthly invoices.

Every fee invoice must contain:

- Unique invoice number.
- Student ID.
- Student name.
- Academic year.
- Fee month.
- Fee items.
- Total amount.
- Discount.
- Previous balance.
- Amount paid.
- Outstanding amount.
- Due date.
- Invoice status.

## 7.3 Payment methods

Support:

- Cash.
- Bank deposit.
- Bank transfer.
- Online payment.
- PayHere.
- Approved cheque payments.
- Other configured methods.

## 7.4 Partial payment

Example:

Monthly fee: LKR 10,000.

- First payment: LKR 4,000.
- Second payment: LKR 3,000.
- Third payment: LKR 3,000.

The system must calculate:

- Total invoiced.
- Total received.
- Remaining balance.
- Payment history.

Do not mark the invoice fully paid until the outstanding balance is zero.

## 7.5 Payment receipts

Generate a professional receipt containing:

- College logo.
- Receipt number.
- Payment date.
- Student name.
- Student index number.
- Fee month.
- Payment method.
- Payment amount.
- Outstanding amount.
- Received-by staff member.
- Payment reference.

Allow:

- PDF download.
- Printing.
- Email delivery.
- SMS notification where enabled.

## 7.6 Overdue fees

Features:

- Overdue invoice detection.
- Outstanding balance list.
- Parent notifications.
- Student fee statements.
- Payment reminders.
- Overdue reports.
- Approved late-fee rules.
- Payment-plan management.

Never automatically suspend a student's academic access solely because an invoice is overdue. Any restrictions must follow institutional policy and authorized approval.

## 7.7 Financial controls

- No deleting confirmed payments.
- Corrections through reversals or adjustment entries.
- Refund approval.
- Receipt number uniqueness.
- Payment reference uniqueness.
- Daily cash closing.
- Payment reconciliation.
- Audit history.
- Staff-level transaction permissions.

## 7.8 Finance dashboards

Display:

- Today's collection.
- This month's collection.
- Total outstanding fees.
- Overdue fees.
- Cash collections.
- Bank collections.
- Online collections.
- Class-wise collections.
- Student-wise outstanding balances.
- Monthly collection trends.

---

# 8. LECTURER AND STAFF SALARY MANAGEMENT

**This is another mandatory core module.**

The platform must calculate, approve, pay and record lecturer and staff salaries.

## 8.1 Staff records

Store:

- Staff ID.
- Full name.
- Contact information.
- Address.
- Photograph.
- Employment type.
- Job title.
- Department.
- Joining date.
- Employment status.
- Salary type.
- Bank account details with restricted access.
- Contract information.
- Qualifications.
- Documents.
- Assigned classes.
- Assigned subjects.

## 8.2 Salary structures

Support:

1. Fixed monthly salary.
2. Hourly salary.
3. Per-lecture payment.
4. Per-class payment.
5. Contract-based salary.
6. Allowances and bonuses.

Example:

Lecturer A:

- Monthly basic salary: LKR 45,000.
- Transport allowance: LKR 5,000.
- Other allowance: LKR 2,000.
- Approved deduction: LKR 1,000.

Net salary = LKR 51,000.

Example for a part-time lecturer:

- Lectures conducted: 24.
- Rate per lecture: LKR 1,500.
- Additional approved allowance: LKR 2,000.

Net salary before any deductions = LKR 38,000.

## 8.3 Salary processing

Monthly workflow:

1. HR confirms active staff.
2. Attendance and teaching records are collected.
3. Salary calculation runs.
4. Accountant checks salary.
5. Treasurer verifies financial availability.
6. Principal or authorized approver approves payroll.
7. Payment is recorded.
8. Payslip is generated.
9. Staff receives notification.

## 8.4 Payroll features

- Salary structures.
- Monthly payroll.
- Hourly calculations.
- Lecture-count calculations.
- Overtime.
- Allowances.
- Deductions.
- Advances.
- Approved loans.
- Leave adjustments.
- Salary arrears.
- Payroll approval.
- Bank transfer records.
- Cash payment records.
- Payslip PDF.
- Salary history.
- Payroll reports.

## 8.5 Payroll security

- Lecturers can see their own payslips.
- HR can manage staff information.
- Accountant can prepare payroll.
- Authorized approvers can approve payroll.
- Treasurer can record salary disbursements.
- Only specifically authorized roles can access bank details.
- Staff cannot edit their own salary.

## 8.6 Payroll accounting

When payroll is approved, create accounting entries according to the institution's configured accounting policy.

Example:

Debit: Lecturer salary expense — LKR 51,000.

Credit: Salary payable — LKR 51,000.

When paid:

Debit: Salary payable — LKR 51,000.

Credit: Bank or cash — LKR 51,000.

Prevent the same payroll from being paid twice.

---

# 9. COMPLETE ACCOUNTING AND FINANCIAL MANAGEMENT

Do not build only a fee collection screen. Build a complete financial accounting system.

## 9.1 Chart of accounts

Support:

- Assets.
- Liabilities.
- Equity or institutional funds.
- Income.
- Expenses.

Example accounts:

| Account | Type |
|---|---|
| Cash in hand | Asset |
| Bank account | Asset |
| Student fee receivable | Asset |
| Student fee income | Income |
| Admission income | Income |
| Donation income | Income |
| Lecturer salary expense | Expense |
| Electricity expense | Expense |
| Food expense | Expense |
| Hostel expense | Expense |
| Library expense | Expense |

Account structure must be configurable.

## 9.2 Accounting modules

- General ledger.
- Journal entries.
- Income management.
- Expense management.
- Cash book.
- Bank book.
- Accounts receivable.
- Accounts payable.
- Student fee ledger.
- Salary ledger.
- Donation ledger.
- Refund management.
- Bank reconciliation.
- Financial year management.
- Budget management.
- Cost centres.
- Financial reports.

## 9.3 Expense management

Record:

- Expense category.
- Description.
- Amount.
- Date.
- Vendor.
- Invoice number.
- Payment method.
- Supporting document.
- Requested by.
- Approved by.
- Paid by.

Expense workflow:

Request → Review → Approval → Payment → Accounting entry.

## 9.4 Donations and sponsorships

Features:

- Donor records.
- Donation campaigns.
- Donation receipts.
- Anonymous donations.
- Restricted donations.
- Donation categories.
- Donation reports.
- Fund allocation.
- Donor history.

## 9.5 Financial reports

Must generate:

- Income statement.
- Balance sheet.
- Cash flow statement.
- Trial balance.
- General ledger.
- Fee collection report.
- Outstanding fee report.
- Expense report.
- Salary report.
- Donation report.
- Bank reconciliation report.
- Monthly and annual financial summaries.

Use double-entry accounting. Every posted journal must balance.

---

# 10. HUMAN RESOURCE MANAGEMENT

Features:

- Staff registration.
- Staff profiles.
- Employment contracts.
- Department allocation.
- Attendance.
- Leave management.
- Staff schedules.
- Lecturer teaching workload.
- Staff performance records.
- Training records.
- Payroll integration.
- Salary advances.
- Staff documents.
- Resignation.
- Termination.
- Employment history.

Leave categories:

- Annual leave.
- Medical leave.
- Casual leave.
- Emergency leave.
- Other institutional leave.

Support leave balances and approval workflows.

---

# 11. LEARNING MANAGEMENT SYSTEM

The LMS must support digital learning.

Features:

- Courses.
- Lessons.
- Learning modules.
- Lecture notes.
- PDF materials.
- Audio lessons.
- Video lessons.
- External learning links.
- Homework.
- Assignments.
- Submission uploads.
- Submission deadlines.
- Lecturer feedback.
- Marks.
- Quizzes.
- Question banks.
- Online tests.
- Discussion boards.
- Learning progress.
- Course completion.

Students must see only enrolled courses unless a course is public.

Lecturers must manage only assigned courses or courses they have permission to manage.

---

# 12. DIGITAL ISLAMIC LIBRARY

The library must be a central part of the platform.

Features:

- Arabic books.
- English books.
- Tamil books.
- Authors.
- Scholars.
- Categories.
- Subjects.
- Publishers.
- Book descriptions.
- Volumes.
- Digital text.
- Original PDFs where permitted.
- In-app reader.
- Arabic RTL reader.
- Search.
- Bookmarks.
- Highlights.
- Personal notes.
- Reading history.
- Reading lists.
- Recently read.
- Librarian administration.

## Shamela integration

Support a dedicated Shamela connector.

Requirements:

- Verify official API access or authorized source data.
- Import book metadata.
- Import authorized book text.
- Import authors and categories.
- Preserve original source references.
- Preserve volume and page references.
- Track import jobs.
- Detect duplicate books.
- Record source attribution.
- Respect licensing and copyright.
- Do not publicly redistribute restricted PDF files.

Use a separate importer process for large imports rather than heavy database imports inside browser requests.

---

# 13. HOSTEL AND ACCOMMODATION MANAGEMENT

If the college provides accommodation, support:

- Hostel buildings.
- Rooms.
- Beds.
- Student allocation.
- Room capacity.
- Hostel fees.
- Check-in.
- Check-out.
- Room changes.
- Hostel attendance.
- Maintenance requests.
- Hostel inventory.
- Visitor records.
- Warden dashboard.
- Hostel incident records.

Access to sensitive student information must be restricted.

---

# 14. STUDENT WELFARE AND DISCIPLINE

Features:

- Student counselling appointments.
- Welfare cases.
- Discipline incidents.
- Behaviour records.
- Merit and achievement records.
- Student support requests.
- Complaint management.
- Follow-up notes.
- Authorized parent communication.

Use restricted access for sensitive records. Do not expose confidential counselling notes in ordinary student or parent dashboards.

---

# 15. COMMUNICATION AND NOTIFICATIONS

## Notification channels

- In-app notifications.
- Email.
- SMS.
- WhatsApp where authorized.
- Mobile push notifications.

## Events that can trigger notifications

- New admission.
- Admission approval.
- Student account activation.
- Fee invoice generated.
- Fee due reminder.
- Payment received.
- Receipt issued.
- Attendance marked absent.
- Leave approved or rejected.
- Examination results published.
- New assignment.
- Assignment deadline.
- Timetable change.
- Salary processed.
- Important announcement.

## Messaging architecture

Use a message outbox.

Every outbound message should have:

- Recipient.
- Channel.
- Message template.
- Related record.
- Delivery status.
- Retry count.
- Error information.
- Created timestamp.
- Sent timestamp.

Avoid sending duplicate notifications.

---

# 16. PUBLIC COLLEGE WEBSITE AND CONTENT MANAGEMENT

Public pages:

- Home.
- About the college.
- History.
- Vision and mission.
- Principal's message.
- Academic programmes.
- Curriculum.
- Faculty.
- Admissions.
- Library.
- News.
- Events.
- Gallery.
- Contact.
- Location.
- FAQs.
- Policies.

CMS features:

- Create pages.
- Edit pages.
- Publish and unpublish.
- Drafts.
- Image management.
- News management.
- Event management.
- Faculty profiles.
- SEO title and description.
- English content.
- Arabic content.
- Arabic RTL support.

Only authorized content editors may publish official institutional content.

---

# 17. DOCUMENT AND CERTIFICATE MANAGEMENT

Support:

- Admission documents.
- Student identity documents.
- Examination documents.
- Certificates.
- Transcripts.
- Staff contracts.
- Payslips.
- Fee receipts.
- Library documents.
- Institutional documents.

Certificate functionality:

- Certificate templates.
- Certificate number generation.
- Authorized approval.
- PDF generation.
- QR verification.
- Certificate verification page.
- Issued certificate history.
- Revocation records.

Do not allow unauthorized users to issue or modify official certificates.

---

# 18. MOBILE APPLICATION

Build an Expo React Native application using the same Supabase backend and authorization rules.

## Student app

- Login.
- Dashboard.
- Profile.
- Attendance.
- Results.
- Fees.
- Payment history.
- Receipt download.
- Timetable.
- Assignments.
- Learning materials.
- Library.
- Announcements.
- Notifications.

## Parent app

- Login.
- Multiple children.
- Child attendance.
- Child results.
- Fee balances.
- Online payments.
- Receipts.
- Leave requests.
- Announcements.
- Notifications.

## Lecturer app

- Login.
- Assigned classes.
- Timetable.
- Attendance marking.
- Assignments.
- Marks entry.
- Teaching schedule.
- Announcements.
- Own payslips where authorized.

## Staff app

- Staff dashboard.
- Leave requests.
- Attendance.
- Assigned tasks.
- Notifications.
- Profile.
- Payslips where authorized.

---

# 19. ADMINISTRATION AND SUPER ADMINISTRATION

The admin dashboard must include:

- Total students.
- Active students.
- New admissions.
- Active lecturers.
- Staff count.
- Today's attendance.
- Monthly fee collection.
- Outstanding fees.
- Monthly expenses.
- Salary payable.
- Donations.
- Academic performance.
- Library statistics.
- Hostel occupancy.
- Pending approvals.
- Recent activity.

Administrative modules:

- User management.
- Role management.
- Permission management.
- Admission management.
- Academic management.
- Finance.
- Payroll.
- HRM.
- Library.
- CMS.
- Notifications.
- Mobile configuration.
- Organization settings.
- Audit logs.
- Data import/export.
- Backup and restore procedures.

Use separate dashboards for principal, treasurer, accountant, HR, librarian and other authorized users.

---

# 20. DATABASE ARCHITECTURE

Use PostgreSQL through Supabase.

Organize tables by domain.

## Identity

- profiles
- roles
- permissions
- role_permissions
- user_roles
- account_approvals
- login_audit_logs
- parent_children
- parent_invites

## Admissions

- admissions
- admission_documents
- admission_notes
- admission_status_history
- valid_index_numbers

## Students

- students
- student_guardians
- student_documents
- student_enrolments
- student_status_history
- student_scholarships

## Academics

- academic_years
- terms
- departments
- programmes
- courses
- subjects
- classes
- batches
- class_enrolments
- lecturer_assignments
- class_schedules
- holidays

## Attendance

- attendance
- attendance_sessions
- attendance_corrections
- leave_requests
- leave_approvals

## Examinations

- examinations
- examination_subjects
- examination_schedules
- student_marks
- grade_scales
- student_results
- transcripts

## Student fees

- fee_categories
- fee_structures
- student_fee_plans
- student_fees
- fee_invoice_items
- payments
- payment_allocations
- payment_transactions
- refunds
- receipts
- fee_adjustments

## HR and payroll

- staff
- staff_contracts
- staff_documents
- staff_attendance
- staff_leave
- salary_structures
- salary_components
- lecturer_workloads
- lecture_sessions
- payroll_periods
- payroll_runs
- payroll_items
- salary_payments
- payslips
- salary_advances

## Accounting

- financial_years
- chart_of_accounts
- journals
- journal_lines
- expenses
- expense_categories
- vendors
- bank_accounts
- bank_transactions
- bank_reconciliations
- budgets
- cost_centres
- donations
- donation_receipts

## LMS

- lms_courses
- lms_lessons
- lms_materials
- lms_assignments
- lms_submissions
- lms_quizzes
- lms_questions
- lms_answers
- lms_enrolments

## Library

- book_sources
- books
- authors
- categories
- book_categories
- book_volumes
- book_pages
- book_assets
- book_rights
- bookmarks
- reading_history
- user_notes
- favorites
- import_jobs

## Hostel

- hostel_buildings
- hostel_rooms
- hostel_beds
- hostel_allocations
- hostel_payments
- hostel_maintenance

## Communication

- notifications
- notification_preferences
- message_outbox
- message_templates
- push_subscriptions
- communication_logs

## Platform

- audit_logs
- system_settings
- organization_settings
- uploaded_documents
- activity_logs
- data_import_jobs

These are proposed logical entities. Inspect the existing database and reuse or extend existing tables instead of creating duplicates.

---

# 21. DATABASE DESIGN AND FINANCIAL INTEGRITY RULES

Mandatory:

1. Every important record must have a unique primary key.
2. Use foreign keys for relationships.
3. Use created_at and updated_at timestamps.
4. Use created_by and approved_by where appropriate.
5. Store financial amounts using NUMERIC/DECIMAL, never floating-point types.
6. Store currency explicitly, defaulting to LKR.
7. Use transactions for multi-step financial operations.
8. Prevent duplicate fee invoices.
9. Prevent duplicate payment references.
10. Do not delete confirmed financial transactions.
11. Use reversal and adjustment records.
12. Keep audit logs for sensitive actions.
13. Ensure journal debits equal credits.
14. Use appropriate indexes for student ID, invoice number, payment reference and dates.
15. Use database constraints for critical financial rules.

Financial records must be immutable after posting except through authorized corrections.

---

# 22. ROLE-BASED ACCESS CONTROL

Use Supabase Row Level Security on every private table.

## Student

Can:

- View own profile.
- View own attendance.
- View own results.
- View own fees.
- View own receipts.
- Read enrolled course materials.
- Submit assignments.
- Manage own bookmarks and notes.

Cannot:

- Change official marks.
- Change attendance.
- Change fees.
- Change salary.
- View other students' private data.

## Parent

Can:

- View verified linked children.
- View children's academic information.
- View children's fee records.
- Pay authorized invoices.
- Submit leave requests.

Cannot:

- Access unrelated students.
- Change official results.
- Modify finance records.

## Lecturer / Tutor

Can:

- View assigned students.
- View assigned timetable.
- Mark attendance for authorized sessions.
- Manage assigned courses.
- Enter marks according to workflow.
- View their own employment information.
- View their own salary records if policy allows.

## Treasurer

Can:

- Generate fee invoices.
- Record payments.
- Manage receipts.
- View fee balances.
- Reconcile financial collections.
- Process authorized financial tasks.

Cannot:

- Change examination results.
- Access unrelated confidential HR records.

## Accountant

Can:

- Manage accounting entries.
- Review expenses.
- Prepare financial reports.
- Prepare payroll calculations.
- Review transactions.

Cannot automatically approve their own sensitive financial actions.

## HR Manager

Can:

- Manage staff records.
- Manage employment contracts.
- Manage leave.
- Prepare payroll information.

Cannot independently change posted accounting records.

## Principal

Can:

- Review academic operations.
- Approve academic workflows.
- Review admissions.
- Review authorized institutional reports.
- Publish official announcements.

## Librarian

Can:

- Manage library catalogue.
- Manage book records.
- Manage authorized digital assets.
- Review import jobs.

## Super Administrator

Can configure the platform and manage authorized system-wide operations.

High-risk financial operations must still have explicit approval controls and audit history.

---

# 23. API AND SERVER ARCHITECTURE

Use the existing Supabase architecture as the primary backend.

Recommended API modules:

- auth
- profiles
- students
- parents
- admissions
- academics
- attendance
- examinations
- fees
- payments
- payroll
- accounting
- hrm
- lms
- library
- hostel
- notifications
- cms
- documents
- analytics
- administration

Use Supabase Edge Functions for server-only operations such as:

- Payment session creation.
- Payment webhook verification.
- Monthly fee generation.
- Payroll processing.
- Notification delivery.
- Scheduled reminders.
- Certificate generation.
- Sensitive administrative workflows.

The browser must never contain the Supabase service role key, PayHere secret, SMS credentials or other private API keys.

---

# 24. PAYMENT INTEGRATION

PayHere integration must follow a secure server-side flow.

1. User selects an invoice.
2. Backend verifies ownership and outstanding amount.
3. Backend creates a payment session.
4. User is redirected to PayHere.
5. PayHere processes payment.
6. PayHere sends a server-to-server notification.
7. Backend validates the notification signature using the official documented procedure.
8. Backend verifies amount, currency, invoice and payment status.
9. Backend records the transaction idempotently.
10. Payment allocation updates the invoice balance.
11. Receipt is generated.
12. Parent/student is notified.

Never mark an invoice paid based only on the browser success page.

Support cash and bank payments independently of PayHere.

---

# 25. SECURITY AND PRIVACY

Requirements:

- Supabase RLS.
- Secure authentication.
- Server-only secrets.
- Strong password policy.
- Account verification.
- Role and permission checks.
- Audit logging.
- Rate limiting.
- Input validation.
- File type and size validation.
- Private storage buckets.
- Signed URLs for private documents.
- Webhook verification.
- Payment idempotency.
- Session expiry.
- Backup and recovery plan.
- Data retention policy.
- Restricted access to sensitive records.

Do not expose:

- Student personal documents.
- Parent contact information.
- Staff bank information.
- Salary information.
- Confidential disciplinary records.
- Private counselling records.
- Internal financial records.

---

# 26. UI / UX REQUIREMENTS

Create a professional, modern, responsive institutional design.

## Public website

- Light theme.
- Institutional branding.
- Emerald and gold visual direction.
- Clear navigation.
- Strong Arabic typography.
- English and Arabic support.
- Responsive layouts.

## Internal portals

- Consistent dashboard design.
- Role-specific navigation.
- Sidebar.
- Top navigation.
- Profile menu.
- Notification bell.
- Search.
- Data tables.
- Filters.
- Pagination.
- Form validation.
- Confirmation dialogs.
- Empty states.
- Loading states.
- Error states.

## Arabic support

- Proper RTL layouts.
- Correct Arabic font rendering.
- Logical reading order.
- Arabic search support.
- Arabic date and number formatting where appropriate.

## Mobile support

- Touch-friendly navigation.
- Simple dashboards.
- Accessible forms.
- Fast loading.
- Good performance on low-end devices.

---

# 27. REPORTING AND ANALYTICS

Build reports for each department.

## Academic reports

- Student attendance.
- Class performance.
- Examination results.
- Subject performance.
- Student progression.
- Lecturer workload.

## Financial reports

- Monthly collections.
- Outstanding fees.
- Payment history.
- Expense reports.
- Salary reports.
- Donation reports.
- Income statement.
- Balance sheet.
- Cash flow.
- Trial balance.

## Management reports

- Student population.
- Admissions.
- Graduations.
- Staff numbers.
- Hostel occupancy.
- Library usage.
- Academic and financial summaries.

Every report must support filters by academic year, date, class, department and relevant category.

Allow authorized PDF and Excel exports.

---

# 28. PROJECT FOLDER STRUCTURE

Preserve the existing repository structure where practical.

Recommended logical structure:

```text
project/
├── src/
│   ├── app/
│   ├── context/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   │   ├── public/
│   │   ├── auth/
│   │   ├── student/
│   │   ├── parent/
│   │   ├── lecturer/
│   │   ├── principal/
│   │   ├── finance/
│   │   ├── payroll/
│   │   ├── hr/
│   │   ├── library/
│   │   ├── hostel/
│   │   └── admin/
│   ├── features/
│   │   ├── admissions/
│   │   ├── students/
│   │   ├── academics/
│   │   ├── attendance/
│   │   ├── examinations/
│   │   ├── fees/
│   │   ├── payments/
│   │   ├── payroll/
│   │   ├── accounting/
│   │   ├── hrm/
│   │   ├── lms/
│   │   ├── library/
│   │   ├── hostel/
│   │   ├── notifications/
│   │   └── analytics/
│   ├── services/
│   ├── hooks/
│   ├── lib/
│   ├── types/
│   ├── utils/
│   ├── i18n/
│   └── styles/
├── mobile/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── services/
│   └── hooks/
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── seed.sql
├── scripts/
│   ├── imports/
│   ├── shamela/
│   ├── backups/
│   └── maintenance/
├── docs/
│   ├── PLATFORM_GUIDE.md
│   ├── DATABASE_SCHEMA.md
│   ├── API_REFERENCE.md
│   ├── ROLE_PERMISSION_MATRIX.md
│   ├── FINANCE_WORKFLOWS.md
│   ├── PAYROLL_WORKFLOWS.md
│   ├── SECURITY.md
│   ├── TESTING.md
│   └── DEPLOYMENT.md
├── public/
├── package.json
└── README.md
```

---

# 29. IMPLEMENTATION ROADMAP

Do not attempt to build everything in one untested change.

## Phase 1 — Repository audit and foundation

- Inspect project.
- Inspect database.
- Map existing features.
- Identify broken functions.
- Confirm role model.
- Review RLS.
- Create implementation plan.
- Preserve working modules.

## Phase 2 — Accounts and identity

- Registration.
- Login.
- Student verification.
- Parent invitations.
- Staff accounts.
- Role permissions.
- Account approval.
- Profile management.

## Phase 3 — Admissions and students

- Admissions CRM.
- Student registration.
- Index numbers.
- Student profiles.
- Parent linking.
- Enrolment.

## Phase 4 — Academics

- Programmes.
- Subjects.
- Classes.
- Timetables.
- Attendance.
- Examinations.
- Results.

## Phase 5 — Student finance

- Fee plans.
- Monthly invoices.
- Partial payments.
- Cash and bank payments.
- PayHere.
- Receipts.
- Overdue balances.
- Reconciliation.

## Phase 6 — HR and payroll

- Staff records.
- Salary structures.
- Lecture records.
- Attendance.
- Payroll calculations.
- Approval workflow.
- Salary payments.
- Payslips.

## Phase 7 — Accounting

- Chart of accounts.
- Journal entries.
- Income.
- Expenses.
- Donations.
- General ledger.
- Financial statements.

## Phase 8 — LMS and library

- Courses.
- Materials.
- Assignments.
- Quizzes.
- Library.
- Shamela connector.
- Arabic reader.

## Phase 9 — Additional services

- Hostel.
- Welfare.
- Discipline.
- Documents.
- Certificates.
- Messaging.

## Phase 10 — Mobile applications

- Student app.
- Parent app.
- Lecturer app.
- Notifications.
- Payment journeys.

## Phase 11 — Reporting and quality

- Analytics.
- PDF and Excel reports.
- Security tests.
- RLS tests.
- Payment tests.
- Backup restoration tests.
- Performance tests.

## Phase 12 — Production release

- Production configuration.
- Domain.
- SSL.
- Database backup.
- Monitoring.
- Error tracking.
- Staff training.
- User documentation.
- Go-live approval.

---

# 30. MANDATORY TEST CASES

Before declaring the platform complete, verify:

### Accounts

- A new student cannot claim an unverified index.
- A parent cannot access an unrelated student.
- A suspended user cannot access protected portals.
- A lecturer cannot access administrator-only features.
- A user with multiple roles sees only authorized functionality.

### Fees

- Monthly invoices are not duplicated.
- Partial payments calculate correctly.
- Payment receipt numbers are unique.
- Cash payments are recorded correctly.
- Online payment callbacks are verified.
- Duplicate webhook events do not duplicate payments.
- Outstanding balances remain correct.

### Payroll

- Monthly salary is calculated correctly.
- Per-lecture salary is calculated correctly.
- Approved deductions are applied correctly.
- Payroll requires approval.
- Salary payment cannot be duplicated.
- Lecturers cannot access other lecturers' payslips.

### Accounting

- Every posted journal balances.
- Reversed transactions remain traceable.
- Financial reports reconcile with source transactions.
- Unauthorized users cannot edit posted entries.

### Academic

- Students see only their own results.
- Parents see only linked children.
- Lecturers see only assigned classes.
- Attendance corrections require approval.
- Published results follow the approval workflow.

### Library

- Arabic content renders correctly.
- RTL reading works.
- Search preserves original text.
- Source and page references are preserved.
- Restricted files cannot be downloaded by unauthorized users.

### General

- Mobile and desktop layouts work.
- Forms validate inputs.
- Error messages are understandable.
- Exports contain correct records.
- Backup restoration works.
- No critical secrets appear in frontend bundles.

---

# 31. DEFINITION OF DONE

A feature is complete only when:

1. The frontend screen works.
2. The database structure exists.
3. The API or data service works.
4. Authentication is enforced.
5. RLS policies are tested.
6. Input validation works.
7. Loading states exist.
8. Error states exist.
9. Empty states exist.
10. Success feedback exists.
11. Reports and exports work where required.
12. Audit history exists for sensitive actions.
13. Automated tests pass.
14. The feature is documented.

Do not report a feature as complete merely because its page exists.

---

# 32. MASTER AI DEVELOPMENT PROMPT

Use the following prompt with your coding agent (Windsurf, Cursor, Claude Code or another repository-aware coding assistant).

## PROMPT START

You are a senior software architect, university ERP developer, financial systems engineer, Supabase/PostgreSQL specialist, React developer, security engineer and mobile application architect.

Your task is to complete the existing Dhārul Ulūm Kashiful Hudāhā Arabic College Management Platform.

The project is located in the currently opened repository.

The current stack is:

- React.
- Vite.
- Supabase Auth.
- PostgreSQL.
- Supabase Row Level Security.
- Supabase Storage.
- Supabase Edge Functions.
- Vercel.
- Expo React Native.

The platform must become a complete institutional ERP, LMS, financial accounting, HRM, digital library and mobile ecosystem.

### CRITICAL RULES

1. Do not delete or replace existing working functionality.
2. Audit the complete repository before making changes.
3. Inspect existing database migrations and tables.
4. Inspect all existing authentication and role logic.
5. Inspect all RLS policies.
6. Reuse existing modules when they are correct.
7. Fix incomplete modules.
8. Add missing modules using incremental migrations.
9. Never create duplicate tables without checking existing structures.
10. Never expose service-role credentials in frontend code.
11. Never bypass RLS.
12. Never use static sample data as production functionality.
13. Do not mark a feature complete without testing it.
14. Preserve existing student, parent, lecturer, payment and library data.
15. Document every important change.

### REQUIRED MODULES

Implement the following complete modules:

1. User and account management.
2. Student management.
3. Parent management.
4. Staff and lecturer management.
5. Admissions CRM.
6. Academic year and programme management.
7. Course and subject management.
8. Class and timetable management.
9. Attendance management.
10. Examination and result management.
11. Monthly student fee management.
12. Cash and bank payment management.
13. PayHere payment integration.
14. Receipt generation.
15. Outstanding fee management.
16. HR management.
17. Lecturer salary management.
18. Per-lecture payment calculations.
19. Monthly payroll.
20. Salary approvals and payments.
21. Payslip generation.
22. Double-entry accounting.
23. Income and expense management.
24. Donations and sponsorship management.
25. Financial reporting.
26. LMS and assignments.
27. Islamic digital library.
28. Shamela integration with verified source access.
29. Hostel management.
30. Student welfare and discipline.
31. Document management.
32. Certificate generation and verification.
33. Notifications.
34. Public website and CMS.
35. Admin dashboards.
36. Analytics.
37. Expo mobile application.
38. Audit and security management.

### FINANCE REQUIREMENTS

Implement monthly fee generation with duplicate prevention, invoice numbers, partial payments, outstanding balance calculation, cash payments, bank payments, online payments, receipts, refunds and reconciliation.

Implement salary processing for:

- Fixed monthly salaries.
- Hourly salaries.
- Per-lecture salaries.
- Contract salaries.
- Allowances.
- Deductions.
- Advances.

Implement payroll preparation, approval, payment recording and payslips.

Implement accounting using a proper double-entry ledger.

All monetary calculations must use decimal database types and transaction-safe processing.

Never modify a confirmed payment directly. Use reversal and adjustment records.

### ACCOUNT AND ROLE REQUIREMENTS

Use a flexible permission model.

Support:

- Student.
- Parent.
- Lecturer.
- Tutor.
- Principal.
- Vice Principal.
- Treasurer.
- Accountant.
- HR Manager.
- Librarian.
- Admission Officer.
- Academic Coordinator.
- Hostel Warden.
- Office Staff.
- Administrator.
- Super Administrator.

A person may have multiple roles.

Enforce permissions at the database level using RLS, not only through hidden frontend menu items.

### USER EXPERIENCE REQUIREMENTS

Build a professional institutional design.

Provide responsive desktop, tablet and mobile layouts.

Support English, Arabic and Tamil.

Arabic interfaces must support correct RTL layout.

Use reusable components, clear forms, searchable tables, filters, pagination, loading states, empty states, error states and confirmation dialogs.

### DEVELOPMENT PROCESS

Work in controlled phases:

PHASE 1: Audit the existing repository and prepare a feature status report.

PHASE 2: Audit database, authentication and security.

PHASE 3: Complete identity, student and parent management.

PHASE 4: Complete admissions and academic management.

PHASE 5: Complete monthly fees and payment management.

PHASE 6: Complete HR and lecturer payroll.

PHASE 7: Complete accounting and financial reporting.

PHASE 8: Complete LMS and digital library.

PHASE 9: Complete hostel, welfare, documents and certificates.

PHASE 10: Complete notifications and mobile applications.

PHASE 11: Complete reports, automated tests and security checks.

PHASE 12: Prepare production deployment documentation.

At the beginning of each phase:

- Explain the existing implementation.
- Identify missing requirements.
- Identify files that need changes.
- Identify database changes.
- Explain risks.
- Provide an implementation plan.

After implementation:

- Run the available build.
- Run automated tests.
- Check database migration consistency.
- Test authorization.
- Test critical financial calculations.
- Fix errors before proceeding.

Do not attempt to modify the entire project in one giant uncontrolled change.

### REQUIRED DELIVERABLES

Create and maintain:

- PLATFORM_GUIDE.md
- DATABASE_SCHEMA.md
- API_REFERENCE.md
- ROLE_PERMISSION_MATRIX.md
- FINANCE_WORKFLOWS.md
- PAYROLL_WORKFLOWS.md
- ACCOUNTING_GUIDE.md
- SECURITY.md
- TESTING.md
- DEPLOYMENT.md
- ADMIN_USER_GUIDE.md
- STUDENT_PARENT_GUIDE.md
- LECTURER_GUIDE.md
- CHANGELOG.md

At the end of each phase, provide:

1. Completed functionality.
2. Modified files.
3. New database migrations.
4. Tests executed.
5. Test results.
6. Known limitations.
7. Remaining tasks.

Begin with PHASE 1 only. Do not make destructive changes or implement all modules before the audit.

## PROMPT END

---

# 33. FINAL PROJECT PRIORITY

The most important modules to finish first are:

| Priority | Module | Importance |
|---|---|---|
| 1 | Authentication and accounts | Critical |
| 2 | Student and parent management | Critical |
| 3 | Admissions and enrolment | Critical |
| 4 | Monthly student fees | Critical |
| 5 | Lecturer salary and payroll | Critical |
| 6 | Accounting and financial reports | Critical |
| 7 | Academics and attendance | Critical |
| 8 | Examinations and results | High |
| 9 | LMS | High |
| 10 | Digital library | High |
| 11 | HRM | High |
| 12 | Notifications | High |
| 13 | Mobile application | High |
| 14 | Hostel and welfare | Medium |
| 15 | Advanced analytics | Medium |

**The final goal is not just a college website. It is a complete College ERP + Learning Management + Finance + HR + Library platform, with every user having one secure account and the correct dashboard and permissions.**
