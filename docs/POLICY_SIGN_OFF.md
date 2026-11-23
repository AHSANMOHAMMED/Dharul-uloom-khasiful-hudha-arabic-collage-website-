# Institutional policy sign-off pack

**Status:** Templates for college + counsel. Engineering has shipped product hooks; **Needs institutional policy** rows in [GAP_STATUS_REGISTER.md](./GAP_STATUS_REGISTER.md) stay Partial until these are signed.  
**Not legal advice.** Confirm duties under Sri Lanka PDPA / Gazette 2498/16 with counsel before **1 January 2027** commencement provisions.  
**Companion:** [PRIVACY_PDPA.md](./PRIVACY_PDPA.md)

Print or copy each section, fill blanks, obtain signatures, and store with college records. Then tick `policy_signed_off` (where the product exposes it) and note the date in the gap register **Prod verified** / owner notes.

---

## §1 PDPA / privacy retention defaults

**Product hook:** `0058_privacy_retention.sql` · Org admin privacy panel · [PRIVACY_PDPA.md](./PRIVACY_PDPA.md)

| Category | Agreed retention | Lawful basis (draft) | Owner |
|----------|------------------|----------------------|-------|
| Identity / admission | ________ | ________ | ________ |
| Guardian / family | ________ | ________ | ________ |
| Academic records | ________ | ________ | ________ |
| Financial / receipts | ________ | ________ | ________ |
| Welfare / discipline (sensitive) | ________ | ________ | ________ |
| Hostel | ________ | ________ | ________ |
| Messaging / outbox | ________ | ________ | ________ |
| Auth / devices | ________ | ________ | ________ |

| Decision | Yes / No / N/A | Notes |
|----------|----------------|-------|
| Public privacy notice published | | |
| Admission-time notice used | | |
| Processor list reviewed (Supabase, Vercel, PayHere, SMS, Expo) | | |
| Breach playbook contacts named | | |
| AI / analytics processors approved | | |

**Sign-off**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Principal / head | | | |
| Privacy contact | | | |
| Counsel (if engaged) | | | |

---

## §2 Break-glass emergency access playbook

**Product hook:** `0057_break_glass.sql` · `0067_break_glass_elevation.sql` · Super Admin panel  
**Scopes in product:** `read_student_records` · `read_finance` · `read_welfare` · `read_all`

| Rule | Agreed value |
|------|--------------|
| Who may **request** | ________ (e.g. approved employees only — already coded) |
| Who may **approve** | ________ (admins; MFA required in product) |
| Max duration | ________ hours (product caps at 24) |
| Default duration | ________ hours |
| When `read_all` is allowed | ________ |
| Post-use review within | ________ hours/days |
| Alert / notify on approve | ________ (who) |
| Forbidden uses | ________ |

**Procedure (human)**

1. Requester states reason and scope in-app; no elevated access until approved.
2. Approver verifies necessity, sets hours, records notes.
3. After expiry or incident: admin reviews audit / break-glass rows; escalate if misuse.
4. Never share break-glass sessions or leave an approved grant idle.

**Sign-off**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Principal | | | |
| IT / platform admin | | | |

---

## §3 Guardian verification & custody playbook

**Product hook:** `0041` · `0069_guardian_permission_gates.sql` (`guardian_may`) · ParentDashboard / StudentDetail

| Scenario | Who verifies | Evidence required | Permission defaults (fees/results/attendance/leave) |
|----------|--------------|-------------------|-----------------------------------------------------|
| New parent invite / auto-link | ________ | ________ | ________ |
| Contested custody / unlink | ________ | ________ | N/A — revoke link |
| Permission narrowing (e.g. fees off) | ________ | ________ | ________ |
| Emergency contact ≠ guardian | ________ | ________ | No portal access |

**Rules**

- Portal access requires `parent_children.status = 'active'` and permission JSON — not phone-number match alone for contested cases.
- Unlink records reason; do not delete historical fees/results.
- Staff must not re-link without verification evidence.

**Sign-off**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Principal | | | |
| Admissions / registrar | | | |

---

## §4 Welfare / safeguarding escalation

**Product hook:** Welfare confidential RLS (`0020`) · WelfarePanel · break-glass `read_welfare`

| Topic | Agreed value |
|-------|--------------|
| Case types / confidentiality levels | ________ |
| Who may open / be assigned | ________ |
| Escalation contacts (ordered) | 1. ________ 2. ________ 3. ________ |
| Do **not** auto-notify | ________ (e.g. implicated guardian) |
| Response deadline | ________ |
| Attachment / storage rules | ________ |
| Closure reasons | ________ |

**Rules**

- Confidential cases stay off general tutor/parent feeds.
- SMS/push must be generic (“new notice”); details only after sign-in.
- Platform supports process; humans own safeguarding decisions.

**Sign-off**

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Principal | | | |
| Designated safeguarding lead | | | |
| Counsel / advisor (optional) | | | |

---

## After signatures

1. File signed copies with college administration.
2. Enter retention days in Org privacy settings; set `policy_signed_off` only when counsel/college agree the defaults are intentional.
3. Update [GAP_STATUS_REGISTER.md](./GAP_STATUS_REGISTER.md) owner notes with sign-off dates for break-glass, PDPA, guardian, and welfare rows.
4. Keep engineering Status as Partial until both **policy** and (where applicable) **ops drills** are done.
