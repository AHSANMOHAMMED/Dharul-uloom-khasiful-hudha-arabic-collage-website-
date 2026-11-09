# Privacy & PDPA readiness

**Status:** Partial (template + product rules). **Legal review:** Needs institutional policy.  
**Reference:** Sri Lanka DPA notices / Gazette 2498/16 — confirm duties with counsel before **1 January 2027** commencement provisions.  
**Companion:** [GAP_STATUS_REGISTER.md](./GAP_STATUS_REGISTER.md)

This document is **not legal advice**. It is an operational register for engineers and college administrators.

---

## 1. Data category register (template)

| Category | Examples | Purpose | Access | Retention (default draft) | Sensitive / child |
|----------|----------|---------|--------|---------------------------|-------------------|
| Identity | name, index, DOB, ID docs | Enrolment, certificates | Staff scoped; student self | Active + 7 years after exit* | Child possible |
| Guardian | phone, link evidence | Safeguarding, fees | Active guardians; staff | Active link + audit forever | Family |
| Academic | attendance, results | Teaching, reports | Tutors assigned; published to student/parent | Permanent academic record | Academic |
| Financial | fees, receipts, payroll | Billing, statutory | Finance/HR roles | 7+ years* | Financial |
| Welfare / discipline | cases, notes | Care, discipline | Assigned welfare staff only | Per safeguarding policy* | Sensitive |
| Hostel | bed, leave passes | Residential safety | Warden / principal | Tenure + 3 years* | Residential |
| Comms | outbox, chat | Ops notices | Parties + admins | 2 years messaging* | Prefer generic alerts |
| Auth / devices | MFA, push tokens | Security | Self + admin | Session / revoke on exit | Security |

\*Replace starred retention with counsel-approved periods before production PDPA claims.

---

## 2. Product rules (enforced in engineering)

1. **No sensitive payloads in push/SMS/WhatsApp previews** — send “You have a new notice” and require sign-in for grades, balances, welfare, ID docs.  
2. **Feature flags never grant data access** — RLS/RPC decide.  
3. **Guardian access** only via `parent_children.status = 'active'` and permission categories.  
4. **Confidential welfare** rows are not visible to general tutors/parents.  
5. **Storage:** private buckets; signed URLs short-lived; cross-family/object path denied.  
6. **Processors (vendors):** Supabase, Vercel, PayHere, SMS/email/WhatsApp providers, Expo push — keep DPAs / contracts on file.

---

## 3. Notices and subject requests

- Publish a privacy notice on the public site and at admission.  
- Correction / access requests: verify identity, log disclosure, fulfil per counsel timelines.  
- Legal hold: suspend deletion when counsel instructs.

---

## 4. Breach playbook (skeleton)

1. **Contain** — revoke keys/sessions, disable leaking Edge path, rotate secrets.  
2. **Preserve evidence** — logs, outbox, audit_logs; do not wipe.  
3. **Assess** — categories, volume, children/sensitive data, likely harm.  
4. **Escalate** — principal + designated privacy contact + counsel.  
5. **Notify** — per legal advice (DPA / affected persons when required).  
6. **Remediate** — patch, post-incident review, register update.

---

## 5. Open decisions (college + counsel)

- Exact retention periods and archival media.  
- Lawful basis per processing purpose.  
- Whether AI `translate-word` / analytics processors are approved.  
- Safeguarding escalation map (who must not be auto-notified).  
- Tenant offboarding export vs delete when a SaaS college leaves.
