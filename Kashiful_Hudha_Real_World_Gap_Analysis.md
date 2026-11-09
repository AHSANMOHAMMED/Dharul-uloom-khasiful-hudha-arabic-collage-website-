# Real-World Product & Logic Gap Analysis

## Dhārul Ulūm Kashiful Hudāhā Arabic College — Web, Mobile & College ERP

**Review date:** 9 November 2026  
**Source reviewed:** `Feature Logic Analysis (single source)` supplied by the user  
**Purpose:** Identify operational, business-rule, security, compliance, and reliability gaps that should be specified and tested before treating the platform as production-ready.

---

## 1. Executive assessment

The supplied feature document describes a substantial platform: public bilingual/multilingual website and CMS, student and parent portals, staff portals, ERP, finance, HR/payroll, academics, exams, LMS, library, hostel, welfare, discipline, certificates, messaging, documents, and an Expo mobile app. The architectural direction is coherent: React/Vite and Expo clients, Supabase Auth/Postgres/RLS/Storage/Edge Functions, shared backend rules, organisation-scoped records, and role-shaped portals.

**The main gap is not the number of screens or modules. It is the depth of the operational rules.** Real institutions need the system to handle exceptions and disputes without silently corrupting records or exposing information. A fee invoice must survive a duplicate gateway callback. A student must be transferable without losing their history. A parent must not gain access to a child merely because a phone number matches. A result must not change after publication without an authorised, recorded correction. A warden must be able to account for residents during an emergency. A departed employee must lose access promptly. A backup must be restorable, not merely present.

The document is therefore best treated as a **strong product/architecture map, not yet a production acceptance specification**.

### What can and cannot be concluded

- **Confirmed from the supplied document:** the feature areas it lists, the stated architecture, the described identity and parent-link flows, the stated PayHere sequence, the role/portal model, and the gaps it openly acknowledges.
- **Not confirmed from the document:** whether every listed feature is actually deployed, whether database policies cover every table/storage object/RPC, whether workflow edge cases work, whether the mobile app works offline, whether backups have been restored successfully, or whether production integrations have passed end-to-end tests.
- **How to read this report:** “Not specified” means that the supplied document does not define the rule. It does **not** prove that the code is missing it. Every high-risk item should be verified against migrations, RLS policies, functions, UI flows, automated tests, and production configuration.

## 2. Highest-priority gaps

| Priority | Gap | Why it matters | Required outcome |
|---|---|---|---|
| P0 | Authorisation proof across every data path | A portal can hide a menu while an API, RPC, file URL, or mobile client still exposes the data | Tested tenant, role, relationship, storage, and RPC boundaries |
| P0 | Privacy and student-data governance | The system holds identity, family, academic, financial, staff, and potentially sensitive welfare data | Data inventory, purpose/consent records, retention, access, incident, and processor controls |
| P0 | Student lifecycle and guardian relationship rules | Admissions, transfers, family changes, duplicate identities, and withdrawals are normal operations | Auditable student state machine and verified, scoped guardian links |
| P0 | Financial correction and reconciliation | Money cannot be treated as an editable status field | Immutable payment/receipt history, idempotent gateway application, reconciliation, refunds, reversals, and period close |
| P0 | Exam/result governance | Uncontrolled mark edits can invalidate official academic records | Moderation, locking, approvals, appeals, resits, controlled corrections, and publication history |
| P0 | Safeguarding and confidential welfare workflows | Discipline, counselling, hostel, and student safety records need stricter handling than ordinary student data | Confidential case access, escalation, documented response, and emergency procedures |
| P0 | Backup, restore, and operational monitoring | Data loss or a silent failed scheduled job can stop the institution | Tested restore plan, alerts, job monitoring, recovery objectives, and off-site backup |
| P1 | Local payroll compliance configuration | EPF, ETF, and APIT have different calculation and remittance rules | Effective-dated statutory tables and payroll audit/export controls |
| P1 | Attendance, timetable, and academic exception handling | Late, excused, corrected, substitute, and offline records occur frequently | Session-level attendance, controlled corrections, conflict checks, and sync rules |
| P1 | Outbox delivery, consent, and language/cost handling | A “sent” record is not proof that a student or parent received a message | Per-recipient delivery states, retry policy, opt-outs, approved templates, and message-cost handling |
| P1 | Mobile offline and conflict behaviour | Residential campuses and weak connections make temporary disconnection realistic | Safe offline capture, sync queue, conflict resolution, and visible sync status |
| P1 | Arabic/Tamil/English usability and calendar rules | Language support must work in real data, not only navigation labels | RTL, mixed-script testing, local formats, reviewed translations, and date/calendar rules |
| P2 | Campus operations and asset lifecycle | Procurement, equipment, maintenance, and residential operations can remain outside a basic ERP | Decide whether to include procurement, assets, maintenance, catering, transport, and visitors |
| P2 | SaaS customer lifecycle | A multi-tenant product needs onboarding, subscription, suspension, export, and offboarding rules | Documented tenant provisioning, support access, billing, and deletion/export lifecycle |

**Recommendation:** do not expand into many new screens until the P0 rules are specified and tested. A smaller set of reliable workflows is more valuable than a larger set of screens that can create incorrect records.

---

## 3. Identity, roles, and access control

The document already defines several useful concepts: Auth → profile → staff hats → approval gate → MFA gate → feature flags, plus a rule that the database/RPC layer—not menu visibility—must enforce access. It also describes multi-hat staff and an acting-organisation view for Super Admin.

The missing specification is the **actual permission decision for a particular record and action**.

### 3.1 Define permissions at four levels

Do not stop at `role = accountant` or `role = tutor`. Access should be checked across:

1. **Tenant:** does the user belong to this `org_id`?
2. **Role/capability:** can this user perform this type of action?
3. **Relationship/scope:** is this student, class, hostel, finance account, case, or document within the user's assigned responsibility?
4. **Record state:** is the record still editable, in an approval state, published, locked, archived, or under investigation?

Example: a tutor may view attendance and marks only for assigned classes; a counselor may read a confidential welfare case only when assigned or explicitly authorised; a parent may see only the children linked to that verified guardian account and only the permitted categories of information.

### 3.2 Required access rules

- Derive tenant membership from trusted authenticated membership/claims or database lookups. Never trust a client-supplied `org_id` as proof of tenant access.
- Apply tenant and relationship checks to `SELECT`, `INSERT`, `UPDATE`, and `DELETE` separately. A policy that allows reading a row does not imply permission to edit or delete it.
- Audit `SECURITY DEFINER` RPCs: verify the caller, role, tenant, target record, and record state inside the function. Set a safe `search_path`; do not accept a caller-provided role or tenant as authority.
- Apply the same access model to Supabase Storage objects. A private student document must not become public because the database row is protected.
- Review Edge Functions that use a service/secret key. That key bypasses RLS, so each privileged function must perform explicit authorisation before it reads or changes data.
- Ensure removal, suspension, or termination of a user's membership takes effect in database and storage access, not only in the UI.
- Add time-limited, reason-required emergency access (“break glass”) for exceptional cases. Log who used it, what they accessed, why, when it expires, and alert an appropriate administrator.

### 3.3 Multi-hat and approval controls

A user with several staff hats should not automatically receive every capability from all hats without a clear active context. The portal's current role-switcher is useful for navigation, but it must not be the security boundary.

Specify **maker-checker** controls for sensitive actions:

- The person who creates a payment adjustment should not approve their own adjustment.
- The person preparing a payroll run should not be the only person approving and posting it.
- A result correction after publication should require a separate authorised approver.
- A donation refund or expense above a configured threshold should require additional approval.
- A Super Admin acting inside a tenant should have an explicit reason, a visible acting-organisation banner, an audit record, and a clear exit action.

Create an authority matrix with action, allowed roles, data scope, approval threshold, required second approver, MFA level, and audit requirement.

### 3.4 Security tests that should exist

For every sensitive table and storage path, test at least:

- anonymous user denied;
- Student A cannot read/update/delete Student B's records;
- Parent A cannot access a child who is not linked to Parent A;
- Tutor A cannot access a class not assigned to Tutor A;
- Accountant cannot read confidential counselling details unless specifically authorised;
- Org A cannot access Org B records by changing URL, query, RPC arguments, or object path;
- revoked staff membership loses access;
- user cannot assign themselves a role or approval status;
- a direct RPC call cannot bypass a portal permission;
- public certificate verification exposes only the minimum fields required.

Supabase's current guidance recommends testing policies through actual `anon`/`authenticated` roles, testing cross-user access, and ensuring a deliberately weakened policy makes the test suite fail. A test that merely inspects policy definitions is not sufficient.

---

## 4. Privacy, student protection, and governance

This platform handles more than ordinary account information. It may hold children’s details, parent/guardian relationships, attendance, academic results, fee arrears, salary data, welfare/counselling records, discipline cases, identity documents, and hostel records.

### 4.1 Sri Lanka PDPA readiness — time-sensitive

The Data Protection Authority's current public notice says Gazette Extraordinary No. 2498/16, dated **22 July 2026**, sets **1 January 2027** as the commencement date for Section 2, Section 3, Part I (Processing of Personal Data), and Part III (Controllers and Processors) of the Personal Data Protection Act. The DPA notice also says Part II (data-subject rights) and Part VII (penalties) are not yet active as of that notice. This is a change from older online summaries that still repeat the previous March 2025 date. Treat the DPA notice and Gazette as the current reference, and obtain Sri Lankan legal advice on the college's precise duties and status.

The platform should be ready before the commencement date, not retrofitted afterwards.

### 4.2 Build a privacy governance layer

Add an organisation-level privacy register containing:

- personal-data category;
- purpose of collection and use;
- source of the data;
- who can access it;
- whether it is shared with a parent/guardian or third party;
- processor/service receiving it;
- retention period and deletion/archiving rule;
- whether consent or another lawful basis is relied on;
- whether the data is sensitive or relates to a child;
- contact/person responsible for privacy requests and incidents.

Also define:

- a public privacy notice and a clear notice at admission/application time;
- collection-minimisation rules (do not collect a field merely because it may be useful someday);
- correction requests and identity verification;
- access and disclosure logging for sensitive records;
- retention, archival, deletion, and legal-hold rules;
- a breach-response playbook with internal escalation, evidence preservation, containment, and legal review;
- processor and vendor review for Supabase, Vercel, PayHere, SMS, email, WhatsApp, Expo push, analytics, and AI services;
- a process for reviewing data transfers and vendor contract terms.

Do not put sensitive case details, grades, fee balances, or identity-document links into push notifications or SMS previews. Send a generic alert and require the user to sign in to view the details.

### 4.3 Separate welfare and safeguarding records

A welfare/counselling case is not an ordinary student note. Define separate case types, confidential classifications, assignment rules, referral/escalation steps, response deadlines, restricted attachments, and closure reasons. Do not expose these cases to every teacher or parent by default.

When a student may be at risk, the platform should support a documented human safeguarding process. It should not automatically notify a person who may be implicated in the reported incident. Policies and escalation routes must be approved by the institution and checked against applicable Sri Lankan requirements.

### 4.4 Institution registration and qualification records

The Department of Muslim Religious and Cultural Affairs provides Arabic College registration documents and publishes a page titled “Registered Arabic Colleges 2023”. The institution should maintain its current registration/recognition information in the system: registering/affiliating authority, registration number, approved programme/curriculum, validity or renewal information, and evidence documents. Do not assume a qualification is recognised by a particular university or regulator unless that status is verified with the competent authority.

---

## 5. Student lifecycle and guardian relationships

The supplied document describes registration, student approval, parent invitations, `request_child_link`, auto-linking when admission contact details match, and staff approval for other cases. That is a useful foundation, but it needs a full lifecycle and exception model.

### 5.1 Define the student state machine

At minimum, define transitions such as:

`Applicant → Under Review → Offered → Accepted → Enrolled → Active → On Leave / Suspended → Transferred / Withdrawn / Completed`

A student may also be `Rejected`, `Deferred`, or `Archived`, depending on institutional policy.

For each transition specify:

- who can initiate it;
- who must approve it;
- required documents or checks;
- whether fees are created, stopped, adjusted, or refunded;
- whether class/subject/hostel assignments change;
- what happens to portal access;
- what appears in academic and financial reports;
- whether the transition can be reversed and how.

Never delete a student record to represent a withdrawal or transfer. Preserve historical enrolments, attendance, examination attempts, receipts, and certificates.

### 5.2 Student identity must be separate from login identity

A student record should exist even if the student does not yet have an email address or app account. One student may later have a login, and a parent/guardian may have a separate login. Do not make the student row and Auth user row the same identity concept.

Support:

- stable, non-reused student admission number;
- duplicate detection using multiple signals (not name alone);
- name aliases/transliteration and corrected legal name history;
- birth date and identity-document corrections with audit history;
- previous institution and transfer records;
- multiple guardians with different legal/operational permissions;
- emergency contacts distinct from guardians;
- a student who has no digital account;
- account merge and duplicate-record resolution by authorised staff.

### 5.3 Guardian linking edge cases

A phone number or admission contact matching is not always conclusive. Families share phones, numbers get reassigned, and custody/contact arrangements can change.

Required rules:

- invitation token expires and can be used only once;
- verify the intended guardian identity before revealing whether a student exists;
- ambiguous or conflicting matches go to staff review;
- a guardian can be linked to more than one child, and a child can have more than one guardian;
- guardian access is scoped by relationship and information category;
- unlinking a guardian revokes future access and invalidates active sessions/tokens where appropriate;
- changes to custody or permitted contacts require documented review;
- log who linked/unlinked the relationship, the evidence, approval, and date;
- never allow a user to attach themselves to an arbitrary student by guessing an admission number.

### 5.4 Admissions workflow

For public applications, define application reference number, duplicate detection, document upload limits, file-type validation, malware scanning, staff assignment, review checklist, interview/assessment scheduling, offer expiry, waitlist, acceptance, deposit/payment, and conversion into a student record. Provide an auditable reason for rejection or deferral and avoid exposing internal comments to applicants.

---

## 6. Academic operations, attendance, examinations, and results

A list of years, terms, subjects, enrolments, timetables, attendance, exams, marks, and report cards is not yet a complete academic rulebook.

### 6.1 Academic calendar and curriculum versioning

Specify:

- academic year and term dates, including date changes and exceptional closures;
- class/cohort/intake and subject offerings;
- curriculum/syllabus version and the effective cohort;
- subject allocation, teacher assignment, classroom capacity, and timetable clash prevention;
- subject add/drop and mid-term transfer rules;
- prerequisite, repeat, resit, and progression rules where applicable;
- teacher substitution and lesson cancellation;
- how public holidays, institution holidays, and special religious dates affect schedules.

Do not overwrite an old curriculum when the syllabus changes. Preserve the syllabus version under which each student was assessed.

### 6.2 Attendance must be session-aware

A single daily present/absent value is often too simple. Decide whether attendance is taken per lesson, session, half-day, or day and support the relevant combination.

Rules to specify:

- present, absent, late, excused, medical, official duty, approved leave, and not-yet-marked;
- time thresholds for late arrival and early departure;
- who can mark attendance and who can correct it;
- correction request, reason, evidence, approval, and audit history;
- lock/finalisation after an approved period;
- substitute-teacher access;
- parent/student notification thresholds;
- how attendance is handled when the device is offline;
- how duplicate or delayed mobile sync is reconciled.

Keep “not marked” different from “absent”. A missed attendance-taking event must not silently become a student absence.

### 6.3 Examination and result workflow

The existing secure exam-paper chain is a useful start. Extend it to the full assessment lifecycle:

1. Create assessment/exam with programme, cohort, subject, date, venue, duration, marks, and grading rules.
2. Approve candidate list and handle late admissions, withdrawals, and eligibility.
3. Prepare paper, moderation, approval, version freeze, print/release, and confidential access log.
4. Record attendance, absence reason, misconduct, special arrangements, and incident reports.
5. Mark scripts and record examiner identity, marking scheme/rubric, and completion state.
6. Moderate marks and handle missing/abnormal marks.
7. Approve and lock results.
8. Publish results to permitted users.
9. Process appeals, rechecks, supplementary exams, and resits.
10. Issue corrected results with original value, new value, reason, requester, approver, and timestamp retained.

Published results must never be silently overwritten. Every result should be traceable to a particular assessment version and grading rule.

### 6.4 Configure assessment types

An Arabic college may use written, oral, recitation, memorisation, practical, coursework, or other assessments. Make assessment type and rubric configurable rather than forcing every subject into a single numeric exam. For oral assessments, record rubric criteria and examiner feedback without exposing private examiner notes to the wrong audience.

---

## 7. Fees, payments, accounting, donations, and expenses

The document describes fee structures, monthly invoices, cash/bank/PayHere payments, partial payments, receipts, arrears, cheques, donations, expenses, accounting journals, and a Finance Hub. The major missing part is how the system preserves financial truth after errors and exceptions.

### 7.1 Invoice lifecycle

Define invoice states, for example:

`Draft → Approved → Issued → Partially Paid → Paid`

with separate states for `Overdue`, `Cancelled`, `Credited`, or `Written Off` as policy allows.

Each invoice should preserve:

- student and fee-plan snapshot at issue time;
- fee period and due date;
- fee-plan version and line-item breakdown;
- discounts, scholarships, waivers, and approvals;
- late fee rule, if used;
- amount and currency;
- changes after issue through credit/debit adjustments rather than rewriting the original invoice.

Specify what happens when a student joins late, leaves mid-period, transfers, repeats a term, receives a scholarship, or has a fee plan changed after invoices already exist.

### 7.2 Payment application and gateway reconciliation

The supplied document says the payment application is idempotent. Make the invariant explicit:

- one external successful payment must be applied no more than once;
- one gateway callback may be received multiple times;
- callbacks may arrive late or out of order;
- amount, currency, merchant, order, payment ID, and student/invoice mapping must match the pending payment;
- a successful payment must not be inferred from a browser redirect;
- manual reconciliation must be audited and cannot silently fabricate a gateway confirmation.

**PayHere-specific check:** PayHere's published Checkout API guidance says its server notification is sent to `notify_url` as URL-encoded POST parameters; the merchant should verify the `md5sig` signature before taking action. It also says status parameters are not supplied to `return_url`, so the return page should read the status already stored by the server notification. Verify that the actual Edge Function uses the current PayHere contract, checks the success status, validates order/amount/currency/merchant, and applies the payment transactionally. Do not assume a different HMAC flow is a replacement for PayHere's documented notification signature unless the exact integration contract requires it.

Store provider transaction IDs and a unique idempotency key. Preserve the raw verified notification or a safe, redacted record for audit. Record failed/invalid notifications without posting money.

### 7.3 Cash and bank operations

Add:

- cash counter/till opening balance;
- receipt-number series and cash collector;
- end-of-day cash close;
- expected versus counted cash;
- discrepancy reason and approval;
- bank deposit batch and deposit slip;
- bank statement import and transaction matching;
- one-to-many and many-to-one reconciliation;
- unmatched items and a follow-up queue;
- cheque received, deposited, cleared, bounced, cancelled, and reissued states;
- bank transfer and gateway settlement fees;
- period-end reconciliation and sign-off.

A daily cash report should reconcile: opening cash + receipts − refunds/approved payouts = expected closing cash. The counted close must be independently recorded.

### 7.4 Accounting controls

If the product claims to provide accounting, define:

- chart of accounts and account-code rules;
- balanced double-entry journals;
- accrual/cash accounting choice and reporting basis;
- journal source and source-document reference;
- posting, approval, reversal, and period-lock rules;
- no hard deletion of posted journals;
- restricted donation/fund accounting where donors specify purpose;
- expense claims, supporting evidence, budget line, approval, and payment;
- opening balances and migration audit;
- financial statements and trial-balance reconciliation.

A posted transaction should be corrected by reversal/adjustment, not by editing history. Lock closed periods except through a separately authorised reopening process.

### 7.5 Donations and funds

Distinguish general donations, restricted donations, recurring pledges, in-kind donations, refunds, and fund disbursements. Capture donor restrictions and acknowledgements. Do not let a donation receipt be treated as fee income automatically.

---

## 8. HR, payroll, leave, and employment lifecycle

The document says HR/payroll is live and mentions EPF/ETF, advances, payslips, leave, attendance, and self-service. The system needs effective-dated payroll rules rather than hard-coded rates.

### 8.1 Sri Lankan payroll support

For ordinary private-sector payroll, official Sri Lankan sources describe EPF as a minimum 8% employee contribution and 12% employer contribution, while ETF is a 3% employer contribution and must not be deducted from the employee's earnings. The Inland Revenue Department states that employers must deduct APIT using the applicable APIT tables and remit it by the 15th of the following month. Exact applicability and calculation basis should be confirmed by the institution's accountant for each employee category.

Therefore:

- store statutory rate/table versions with effective dates and tax years;
- never hard-code the current rate into old payroll periods;
- calculate employer and employee contributions separately;
- prevent ETF from appearing as an employee deduction;
- support APIT tables and annual tax-year changes;
- preserve the calculation breakdown on each payroll run;
- produce remittance/export reports and payment evidence;
- allow an accountant to configure approved statutory changes without rewriting historical payslips.

### 8.2 Payroll lifecycle

`Draft → Calculated → Reviewed → Approved → Posted/Paid → Closed`

After posting, corrections should use an adjustment run. Prevent duplicate payroll for the same staff member and period. Specify how new hires, terminations, unpaid leave, salary revisions, advances, overtime, allowances, loans, reimbursements, and final settlements are handled.

### 8.3 Staff lifecycle and access removal

Include recruitment/application (if in scope), offer, employment contract, probation, confirmation, role assignment, temporary duty, leave, transfer, suspension, resignation, termination, exit checklist, and rehire. On a staff exit, revoke access, active sessions, MFA recovery methods, device registrations, tokens, and delegated approvals as appropriate. Keep historical payroll and audit records.

---

## 9. Hostel, welfare, discipline, and campus safety

The document lists hostel allocation, welfare cases, discipline, and counselor/warden portals. For a residential institution, these need operational detail.

### 9.1 Hostel occupancy

Use bed-level and date-effective allocation, not just room assignment. Enforce room capacity and prevent overlapping assignments. Track check-in/check-out, room changes, leave/overnight permissions, return confirmation, visitors, room inspections, maintenance, damage/loss, and deposits if applicable.

### 9.2 Roll call and emergency response

Define roll-call schedules and who confirms each resident. Provide an emergency mode that shows the approved current resident list, last known check-in/leave status, emergency contacts, and incident lead. Record drills, missing-student escalation, emergency contact attempts, and closure. Do not rely on the ordinary dashboard as the only emergency process.

### 9.3 Confidentiality separation

Separate discipline records, welfare/counselling records, medical/emergency information, and ordinary academic notes. A warden may need occupancy and permission information but should not automatically receive full counselling history. A counselor may need to document a confidential case without making all notes visible to parents or teaching staff.

### 9.4 Other campus operations to decide

Depending on actual operations, decide whether the system needs:

- procurement requests, supplier quotes, purchase orders, goods received, and invoice matching;
- asset register, barcode/QR tagging, assignment, depreciation, repair, disposal, and stocktake;
- building/classroom maintenance requests and work orders;
- transport routes, vehicle/driver records, permissions, and attendance;
- kitchen/catering/meal counts, dietary notes, and food stock if meals are provided;
- visitor/contractor registration and campus access log.

These should be conditional modules, not automatic scope expansion. Prioritise only the activities the institution actually operates.

---

## 10. Library and LMS operational depth

### 10.1 Library circulation

A catalogue entry is not the same as a physical copy. Support separate bibliographic title and individual accessioned copies. Define:

- accession number/barcode per copy;
- copy status: available, on loan, reserved, repair, lost, withdrawn;
- member borrowing limits and loan periods;
- renewals, holds/reservations, overdue rules, fines/waivers, lost/damaged replacement;
- inter-library transfer if applicable;
- stocktake and discrepancy resolution;
- digital file licence/permission and access expiry;
- import validation and duplicate ISBN/title handling.

For Arabic books, support Arabic author/title metadata, RTL search/display, diacritics where useful, and variant spellings/transliteration.

### 10.2 LMS assignment and quiz rules

For assignments specify publish/unpublish, due time zone, accepted file types/size, late policy, resubmission, submission receipt/time, teacher feedback, rubric, appeal/reopen, and version history. A submission should not be silently replaced after the deadline.

For quizzes specify attempts, randomisation, question-bank access, duration, autosave, interruption/reconnect, result release, regrade, question challenge, and accommodation rules. Keep answer keys inaccessible to learners and unauthorised staff.

---

## 11. Messaging, notifications, language, and calendars

The existing outbox and broadcast concept is useful, but the operational delivery contract is not described.

### 11.1 Outbox state model

Track each recipient/channel separately:

`Queued → Processing → Accepted by Provider → Delivered / Failed / Expired`

Also support `Retry Scheduled`, `Suppressed`, and `Opted Out` where appropriate. Store provider message IDs, attempt count, last error, next retry time, template/version, recipient snapshot, and cost estimate/actual cost where available.

Do not mark a campaign “delivered” merely because an Edge Function returned HTTP 200. Distinguish accepted by provider from delivered to handset/mailbox.

### 11.2 Consent and message rules

- store contact preferences for SMS, email, WhatsApp, push, and in-app;
- retain the source/time of consent or preference change;
- respect opt-outs for non-essential communications;
- separate emergency/operational notices from promotional messages;
- enforce quiet hours and rate limits;
- prevent bulk messaging from exposing recipients to one another;
- use approved templates and allow preview/approval before a large broadcast;
- snapshot the audience when a campaign is approved so the send cannot silently change during execution.

### 11.3 Sri Lankan language realities

Test Tamil and Arabic messages for Unicode segmentation and provider cost. A Tamil or Arabic SMS may consume multiple SMS segments; calculate/preview the likely segment count and estimated cost before sending a campaign. Include an approved fallback route for provider failures.

### 11.4 Arabic and multilingual UI

The document lists EN/AR/TA, but language support must include:

- proper right-to-left layout for Arabic, including forms, tables, numbers, punctuation, and mixed-script values;
- tests for Arabic names mixed with Latin student numbers;
- suitable fonts and correct diacritic rendering;
- translation review workflow and translation version history;
- locale-aware date, number, and currency display;
- consistent timezone handling (`Asia/Colombo` for institutional timestamps unless a particular event has another explicit zone);
- Gregorian dates stored consistently, with Hijri dates as an optional display/academic reference where the institution needs them;
- language fallback when a translation is missing.

Do not assume browser auto-translation is an acceptable substitute for reviewed institutional translations.

---

## 12. Web/mobile parity and low-connectivity operation

The document correctly says web and mobile must share RPCs/tables and must not create separate permission models. It does not define offline behaviour.

### 12.1 Define offline-capable workflows

Potentially safe offline candidates include attendance capture, timetable viewing, downloaded learning materials, and draft notes. Money posting, final result publication, role changes, and sensitive case closure should require a live authoritative server confirmation unless there is a formally designed offline approval process.

### 12.2 Sync contract

For each offline-capable action define:

- local temporary ID and server ID;
- device/user/org identity;
- creation timestamp and server receipt timestamp;
- idempotency key;
- payload version/schema version;
- sync status and last error;
- retry/backoff rules;
- conflict strategy (reject, merge, or require human review);
- audit event showing offline capture and eventual server sync.

Never use “last write wins” for marks, fees, safeguarding notes, or other high-impact data. Show staff unsynced records clearly and warn before sign-out or app data removal.

### 12.3 Device management

Support lost/stolen device revocation, app session expiry, device registration management, secure local cache policy, and remote sign-out. Push notifications should not contain sensitive information. Deep links must validate that the signed-in user is authorised to open the requested record.

---

## 13. SaaS / multi-tenant product lifecycle

The document describes `/platform`, organisations, ACL, acting organisation, and one Supabase project. The SaaS control plane needs its own lifecycle rules.

Specify:

- tenant creation, identity verification, initial admin invitation, and provisioning checklist;
- organisation profile, campuses, academic calendar, timezone, currency, languages, numbering series, and statutory settings;
- trial, subscription, plan change, renewal, failed payment, grace period, suspension, reactivation, cancellation, and export;
- per-tenant feature entitlements and limits;
- support access request and approval, time-limited acting-org access, and support audit log;
- tenant backup/export and offboarding;
- custom-domain validation and removal;
- data retention/deletion when a tenant closes;
- migration strategy when a tenant needs to move to another project or region.

Do not suspend access to a tenant's historical financial or academic records in a way that violates institutional record obligations merely because a SaaS subscription payment failed. Define read-only grace access and an export route with the product owner and legal adviser.

---

## 14. Reliability, backups, deployment, and observability

The feature document mentions cron jobs, Edge Functions, notification outbox, and deployment, but does not define operational targets.

### 14.1 Backups and restore

- Identify the current Supabase plan and what backup/PITR features it actually provides.
- If on the Free plan, Supabase currently recommends regular `supabase db dump` exports and off-site backups; paid Pro/Team/Enterprise projects have daily backups with plan-specific retention.
- Back up database and required Storage objects; a database dump alone does not guarantee that uploaded student documents can be restored.
- Store backups separately from the production project and restrict access/encrypt them.
- Run scheduled restore drills in a separate environment.
- Record restore date, duration, data loss window, validation results, and owner.
- Define RPO (maximum acceptable data loss) and RTO (maximum acceptable recovery time) with college management.

A backup that has never been restored is an unproven recovery plan.

### 14.2 Scheduled jobs and outbox workers

For each cron/Edge job record owner, schedule, timezone, expected duration, idempotency, success criteria, alert condition, retry policy, and dead-letter/manual-recovery procedure. A job must not generate duplicate invoices or send duplicate messages when retried.

### 14.3 Monitoring and incident response

Monitor at least:

- authentication failures and unusual login patterns;
- repeated RLS/permission denials;
- Edge Function failures and latency;
- payment callbacks received, rejected, duplicated, and applied;
- stuck messages and scheduled jobs;
- database capacity, connection exhaustion, and slow queries;
- storage growth and upload failures;
- mobile sync backlog;
- backup and restore verification;
- deployment/migration status.

Create an incident runbook for exposed data, payment outage, lost admin account, accidental deletion, failed migration, and provider outage. Keep secrets out of logs and user-facing error messages.

### 14.4 Environments and migrations

Use separate development, staging, and production environments. Test migrations and data transformations against realistic anonymised data. Have a release checklist, migration owner, rollback/forward-fix plan, and post-deploy smoke tests. Do not use production student/parent data as a casual development dataset.

---

## 15. Data model invariants to add to the specification

These are examples of rules that should be enforced by database constraints, transactions, or server-side business logic—not only frontend validation.

1. An admission number is unique within the institution and is never reused.
2. A student may have multiple historical class/subject enrolments, but only permitted active enrolments for a given effective period.
3. A guardian-student relationship has a status, verification evidence, permissions, effective dates, and audit history.
4. A hostel bed cannot have two overlapping active occupants.
5. Attendance for the same student/session cannot be posted twice; corrections preserve the original event.
6. An assessment result cannot be published until the required moderation/approval state is complete.
7. A published result correction preserves both the original and corrected values.
8. Invoice numbers and receipt numbers are unique within their organisation/financial series.
9. One PayHere payment ID can be applied only once.
10. A payment application cannot exceed the verified payment amount or be allocated to another tenant's invoice.
11. A posted journal must balance; posted journals are reversed/adjusted, not deleted.
12. A payroll run cannot be posted twice for the same run/version.
13. A staff user's elevated access is removed or expires when their employment/assignment ends.
14. Every sensitive file is stored in a private bucket unless it is intentionally public and approved as such.
15. Every tenant-owned business row has a validated organisation association.
16. Feature flags never grant data access by themselves.
17. Every privileged operation records actor, tenant, target, action, timestamp, reason, and approval where required.
18. Every background job is safe to retry without duplicating its business effect.

---

## 16. Real-world scenario tests

Use scenarios rather than only testing that a screen opens. Each scenario should be an automated test where practical, otherwise a documented UAT script with expected outcome and sign-off.

| Scenario | Expected behaviour |
|---|---|
| A parent enters a phone number that matches two student records | Do not auto-link; route to safe verification/review without revealing student data |
| A guardian is removed from a student | Future access is revoked; prior access and relationship change remain auditable |
| A student transfers mid-term | Historical attendance/results/fees remain; effective enrolment and future billing are adjusted under policy |
| A fee payment callback is delivered three times | One receipt/application only; duplicate callbacks are recorded safely |
| PayHere redirects the browser before the notification arrives | UI shows pending, then reads server-verified state; it does not mark paid from the redirect |
| A callback has a valid signature but wrong order amount/currency | Do not apply it; flag for reconciliation |
| A parent tries to open a private document URL copied from another family | Access is denied or the signed URL has safely expired |
| A teacher edits marks after result publication | Block direct edit; require controlled correction and approval history |
| An exam candidate is absent with an approved reason | Record the outcome according to assessment rules; do not silently calculate as zero unless policy requires it |
| A tutor leaves the institution | Access, sessions, and assignments are revoked/reassigned; historical academic records remain |
| A hostel student is approved for overnight leave but does not return | Dashboard/escalation shows expected return and outstanding check-in |
| A welfare case is opened | Only assigned/authorised personnel can view it; general teacher/parent views do not expose private notes |
| Mobile attendance is captured offline and uploaded twice | One authoritative attendance event; sync status is visible and traceable |
| A scheduled invoice job retries after a timeout | No duplicate invoice or duplicate notification |
| A tenant admin changes the URL or RPC `org_id` | Other tenant data remains inaccessible |
| A production backup is restored to a test project | Core records, relationships, and required files are validated against the agreed recovery target |
| A Tamil/Arabic bulk message is prepared | Correct rendering, segment count, estimated cost, recipient count, and consent status are visible before approval |

---

## 17. Suggested implementation roadmap

### Phase 0 — prove what is already real (first)

1. Inventory every production table, view, RPC, trigger, Edge Function, Storage bucket, cron, and public endpoint.
2. Map each item to tenant, role, relationship, state, and sensitivity rules.
3. Run Supabase Security Advisor and review all secret/service-role usage.
4. Build pgTAP RLS tests for each sensitive table and storage policy; include cross-user and cross-tenant negative tests.
5. Trace one end-to-end student admission, parent linking, attendance, exam/result, fee payment, payroll, and certificate flow in staging.
6. Verify production integrations and backup plan; run one restore drill.

**Deliverable:** an evidence-based status register with `Not Started`, `Implemented`, `Tested in Staging`, `Verified in Production`, and `Monitored`—not a single broad “Live” label.

### Phase 1 — close P0 operational risks

- Complete tenant/role/relationship/record-state access rules and negative tests.
- Complete guardian verification and student lifecycle transitions.
- Complete fee/payment idempotency, reconciliation, immutable corrections, and accounting controls.
- Complete examination moderation, result lock, appeal, and correction flows.
- Complete confidential welfare/safeguarding access and response process.
- Complete privacy data inventory, notice, retention, vendor register, and incident playbook ahead of 1 January 2027 PDPA commencement provisions.
- Complete tested backup/restore, job alerting, and production incident runbooks.

### Phase 2 — close operational depth

- Attendance exceptions and correction workflow.
- Hostel roll-call, leave, visitors, and emergency process.
- Payroll statutory rate/version management and exports.
- Outbox per-recipient delivery state, retries, consent, and Unicode cost preview.
- Library copy-level circulation and LMS submission/quiz lifecycle.
- Arabic/Tamil/English RTL and date/locale regression tests.

### Phase 3 — extend only where the institution needs it

- Procurement, inventory, fixed assets, and maintenance.
- Catering/meal management, transport, visitor access, alumni, and event management.
- More extensive analytics, accreditation reporting, and SaaS subscription automation.

---

## 18. What to add to the main feature document

The existing `Feature Logic Analysis` should gain these sections so future developers do not have to infer critical rules:

1. **Student lifecycle state machine** — transitions, permissions, required evidence, fee/access side effects.
2. **Guardian relationship model** — verification, permissions, multiple guardians, unlinking, custody/contact changes.
3. **Permission matrix** — tenant + role + record scope + state + action + approval + MFA.
4. **Financial invariants** — invoice, receipt, payment, refund, journal, close, and reconciliation states.
5. **Assessment/result lifecycle** — moderation, lock, publish, appeal, resit, correction.
6. **Safeguarding/confidentiality model** — case classes, restricted access, escalation, audit, emergency handling.
7. **Privacy register and retention policy** — data categories, purposes, vendors, access, retention, incidents.
8. **Offline/mobile synchronisation contract** — permitted offline actions, idempotency, conflicts, device revocation.
9. **Outbox delivery contract** — channel consent, per-recipient delivery state, retry, cost, quiet hours.
10. **Operational readiness** — monitoring, alerting, RPO/RTO, backup/restore test, incident runbooks.
11. **Tenant SaaS lifecycle** — provisioning, acting-org access, subscription, suspension, export, closure.
12. **Acceptance test catalogue** — scenario, expected result, test owner, evidence, release gate.

Also replace unexplained `live` labels with a verifiable status and evidence link/test ID. A feature should be called production-verified only after its real workflow, permissions, failure paths, and monitoring have been checked.

---

## 19. Final recommendation

**Do not start by adding another large module.** First make the existing core trustworthy:

1. identity and guardian relationships;
2. tenant/role/data-level authorisation;
3. fee/payment/accounting integrity;
4. academic/exam/result integrity;
5. student welfare and hostel safety;
6. privacy, backups, and operational monitoring.

Once these are proven, the platform will be much closer to a dependable real-world college system. The strongest next development task is a **code-and-database audit against this gap list**, producing a table of `Already implemented`, `Partially implemented`, `Missing`, `Unsafe`, and `Needs institutional policy decision` with file paths, SQL objects, and test evidence.

---

## 20. External references checked

The following official or primary technical sources were checked for this review. They are references for verification, not a substitute for institution-specific legal/accounting advice.

### Sri Lanka — privacy, payroll, and institution context

- Data Protection Authority — Guidelines and Important Information, including PDPA Act, Amendment Act No. 22 of 2025, and Gazette No. 2498/16: https://www.dpa.gov.lk/guidelines.php
- Data Protection Authority — current Data Protection Statement and commencement status: https://dpa.gov.lk/notice.php
- Gazette Extraordinary No. 2498/16 (22 July 2026), official English PDF: https://www.dpa.gov.lk/Gazet/2498-16_E.pdf
- Department of Muslim Religious and Cultural Affairs — Arabic Colleges page and registration documents: https://muslimaffairs.gov.lk/arabic-collage/
- Department of Labour — EPF rates and employer/employee contribution information: https://labourdept.gov.lk/epf-division-new/
- Employees' Trust Fund Board — employer FAQ, 3% employer contribution and no employee deduction: https://etfb.lk/employers-faq/
- Inland Revenue Department — APIT requirements and remittance information: https://www.ird.gov.lk/en/Type%20of%20Taxes/SitePages/Advance%20Personal%20Income%20Tax%20%28APIT%29.aspx

### Payment integration

- PayHere — JavaScript Checkout API, server notification, `md5sig` validation, and return URL behaviour: https://support.payhere.lk/api-%26-mobile-sdk/javascript-sdk

### Supabase security and operations

- Supabase — Production security checklist: https://supabase.com/docs/guides/security/production-checklist
- Supabase — Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase — pgTAP testing of RLS policies: https://supabase.com/docs/guides/database/postgres/testing-row-level-security
- Supabase — MFA and Authenticator Assurance Levels: https://supabase.com/docs/guides/auth/auth-mfa
- Supabase — Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase — secret keys and API key handling: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase — database backups and plan-specific backup guidance: https://supabase.com/docs/guides/platform/backups

---

**Review limitation:** This is a specification-level review of the supplied Markdown document. It does not certify the deployed system, provide legal advice, or prove that a listed requirement is absent from the codebase.
