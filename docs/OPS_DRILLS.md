# Operations drills (staging → production verification)

**Purpose:** Turn “Partial” backup/PayHere/ops items in [GAP_STATUS_REGISTER.md](./GAP_STATUS_REGISTER.md) into signed **Prod verified** evidence.  
**Owner:** Deployment operator + college principal (or delegate).  
**Companion:** [GO_LIVE.md](./GO_LIVE.md) · [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

This file is the checklist. It does **not** replace running the drill on a real staging project. Leave signature lines blank until the drill is executed.

---

## Agreed recovery objectives (fill with college)

| Objective | Target (draft) | Agreed value | Signed |
|-----------|----------------|--------------|--------|
| **RPO** (max acceptable data loss) | ≤ 24 h (Supabase daily backup tier) or PITR window if enabled | ________ | ________ |
| **RTO** (max time to restore service) | ≤ 4 h for database + Edge Functions + Vercel rollback | ________ | ________ |
| Backup retention | Per Supabase plan + off-site export cadence | ________ | ________ |
| Drill frequency | At least once before first production launch; quarterly after | ________ | ________ |

---

## §1 Backup / restore / job monitoring

### Preconditions

- [ ] Staging Supabase project linked; migrations applied through latest (`0073`+)
- [ ] Dashboard → Database → Backups: latest backup visible (or PITR enabled)
- [ ] `npm run test:db` passed against local/staging as documented in CI
- [ ] Super Admin → Job runs panel loads (`0059_job_runs.sql`)

### Drill steps

1. **Record baseline** — Note staging project ref, migration head, and a sample student fee balance + attendance row IDs.
2. **Take backup** — Trigger or confirm a fresh backup / snapshot before destructive steps.
3. **Simulate failure** — In staging only: delete or alter a non-critical demo row (document what you changed).
4. **Restore** — Restore from backup/PITR to a restore target (or in-place if staging policy allows). Confirm sample rows match baseline.
5. **Job monitoring** — Confirm scheduled/edge job rows appear in `platform_job_runs` (or Super Admin Job runs). Force a known job if one exists; confirm success/failure is visible.
6. **Rollback path** — Document Vercel previous-deployment promote for frontend; document Edge Function redeploy command from [GO_LIVE.md](./GO_LIVE.md).

### Sign-off

| Field | Value |
|-------|-------|
| Environment | Staging project ref: ________ |
| Drill date | ________ |
| RPO observed | ________ |
| RTO observed | ________ |
| Operator | ________ |
| College witness | ________ |
| Result | Pass / Fail / Partial |
| Notes | ________ |

When **Pass**, mark **Backup / restore / job monitoring** → Prod verified in [GAP_STATUS_REGISTER.md](./GAP_STATUS_REGISTER.md).

---

## §2 PayHere sandbox checkout + notify

### Preconditions

- [ ] PayHere **sandbox** merchant ID + secret configured as Edge Function secrets (never in `VITE_*`)
- [ ] `create-payment` and `payhere-notify` deployed
- [ ] Staging frontend points at staging Supabase
- [ ] Test student/parent with an unpaid fee invoice

### Drill matrix

| Case | Steps | Expected | Pass |
|------|-------|----------|------|
| Success | Checkout → sandbox pay → notify | Invoice balance reduced once; receipt/audit present | [ ] |
| Duplicate notify | Replay same notify payload | Idempotent; no double credit (`apply_gateway_payment`) | [ ] |
| Failure / cancel | Abort or fail payment | Fee remains unpaid; no false receipt | [ ] |
| Amount mismatch | Tampered amount (staging only) | Notify rejected; balance unchanged | [ ] |
| Unauthorized checkout | Wrong user JWT / other student fee | `create-payment` AuthZ denies | [ ] |

### Sign-off

| Field | Value |
|-------|-------|
| Sandbox merchant | ________ |
| Drill date | ________ |
| Operator | ________ |
| Finance witness | ________ |
| Result | Pass / Fail / Partial |
| Evidence links (logs/screenshots) | ________ |

When **Pass**, mark **PayHere checkout AuthZ + UX** → Prod verified in the gap register. Idempotency remains “Already implemented” in code; this drill proves the hosted path.

---

## §3 Hostel emergency roll-call (operational)

| Field | Value |
|-------|-------|
| Drill date | ________ |
| Warden | ________ |
| Residents accounted | ________ / ________ |
| Missing escalation followed policy | Yes / No |
| Result | Pass / Fail |

Mark hostel row Prod verified only after a timed roll-call using HostelPanel Emergency on staging or supervised production.

---

## How to update the gap register

After a signed Pass:

1. Open [GAP_STATUS_REGISTER.md](./GAP_STATUS_REGISTER.md).
2. Put the drill date (and optional initials) in the **Prod verified** column for that row.
3. Keep **Status** as `Already implemented` / `Partial` for engineering depth; Prod verified is the ops gate.
