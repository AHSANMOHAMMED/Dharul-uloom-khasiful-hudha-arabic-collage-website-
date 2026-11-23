# Offline attendance sync contract

**Scope:** Attendance drafts only. Money, results, and welfare must never be authoritative offline.

## Client responsibilities

1. Queue drafts locally with a stable `device_id` and `idempotency_key` (UUID per mark attempt).
2. Payload shape: `{ "student_id": "<uuid>", "date": "YYYY-MM-DD", "status": "present|absent|late|excused", "excuse_note": "..." }`.
3. On reconnect, call `apply_offline_attendance_draft(p_device_id, p_idempotency_key, p_payload)`.
4. Treat `duplicate` as success (already applied).
5. Treat `conflict` as **not** applied: keep a local conflict record; do **not** last-write-wins. Staff resolve via `correct_attendance` / `save_class_attendance_session` with a reason.
6. Do not invent server state from the local queue alone.

## Server

- Table `offline_sync_queue` (migrations `0064`, hardened in `0074`).
- RPC behaviour:
  - **No server row** → insert client mark → `applied`
  - **Identical server row** → `applied` (no overwrite)
  - **Different server row** → `conflict` with `{ server, client }` in `result` (no overwrite)
  - Repeat key → `duplicate`
  - AuthZ / validation failure → `rejected`

## Mobile stub

[`mobile/lib/offlineAttendance.js`](../mobile/lib/offlineAttendance.js) persists drafts and conflict list in secure storage; flush on reconnect. Web tutors mark attendance online via the audited session RPC.
