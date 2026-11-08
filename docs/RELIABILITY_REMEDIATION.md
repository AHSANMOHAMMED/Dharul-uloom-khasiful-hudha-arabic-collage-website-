# Reliability and business-logic remediation

This note records code changes made during the reliability pass. It does not
claim that production has been load-tested or that a college-specific policy
has been confirmed.

## Enforced in code

- Migration `0028_workflow_integrity_scale.sql` fixes attendance updates, validates
  exam/student/subject/marks alignment, blocks tutor changes after publication,
  serializes hostel room capacity checks, and rejects duplicate active beds.
- Payroll now classifies eligible earnings separately for EPF and ETF. EPF
  minimums are protected at 8% employee / 12% employer and ETF at 3% employer;
  the bases include configured eligible components and exclude the seeded
  overtime/bonus EPF components. Draft payrolls are recalculated by the migration.
  Separate day-shift, lecture, and Ramadan/special-offer earning components are
  seeded for monthly approved adjustments, with component-level EPF/ETF flags.
- Admissions default to the broad 3–80 age range when the organization has not
  configured a narrower policy. The age remains calculated from date of birth
  in the institution timezone.
- Browser and mobile Supabase requests, including calls with their own abort
  signal and response-body parsing, are cancelled at 9 seconds. Direct payment,
  notification, and contact edge-function calls use the same bound.
- Student, employee, admissions, enrolment, and invoice directories use bounded
  PostgREST pages so the platform's row cap cannot silently hide records.
- The optional Express API no longer trusts a public registration role, protects
  content writes and contact reads, paginates public news/contact results, waits
  for MongoDB before listening, and applies bounded Mongo query/connection times.
  Configure `MONGO_URI` in `backend/.env`; the service intentionally refuses to
  start without a database connection.

## Payroll basis

EPF eligibility is controlled per salary component. The seeded overtime and
bonus components are excluded from EPF; other earnings default to eligible.
ETF eligibility is a separate component flag. Finance/HR must confirm component
classification and any lawful employee exemption before approving the first
production payroll. The official EPF FAQ lists salary/wages/fees and allowances
as earnings and excludes overtime and incentive/bonus payments; ETF maintains
its own earnings definition. [EPF employer FAQ](https://epf.lk/?page_id=811),
[ETF employer details](https://etfb.lk/employer-details/).

The current payroll model records day-shift, lecture, and Ramadan/special-offer
payments as HR-approved monthly amounts with a note/reference. It does not yet
derive the amounts from approved shift hours or lecture counts because the
application has no work-unit register or college rates. APIT/income-tax
deductions also require verified local payroll rules before they can be
calculated safely. Component EPF/ETF flags default to eligible for new pay
components and must be reviewed by HR/finance before payroll approval.

## Scale and response-time boundary

The 9-second client deadline prevents the UI from waiting indefinitely; it does
not prove that a backend operation itself completed within 9 seconds. Supabase
provides the managed API/database service, while the repository's self-hosted
Nginx configuration balances only the static frontend replicas. Database
compute, pooling, and read replicas remain deployment settings. Production must
pass the repository load scenario against the actual staging Supabase project
before a sub-10-second service objective can be claimed.

No production credentials or deployment state are available in this repository.
Migration `0028` must be applied to staging and validated before production.
