# Offline attendance sync contract

**Scope:** Attendance drafts only. Money, results, and welfare must never be authoritative offline.

## Client responsibilities

1. Queue drafts locally with a stable `device_id` and `idempotency_key` (UUID per mark attempt).
2. Payload shape: `{ "student_id": "<uuid>", "date": "YYYY-MM-DD", "status": "present|absent|late|excused", "excuse_note": "..." }`.
3. On reconnect, call `apply_offline_attendance_draft(p_device_id, p_idempotency_key, p_payload)`.
4. Treat `duplicate` as success (already applied).
5. Do not invent server state from the local queue alone.

## Server

- Table `offline_sync_queue` (migration `0064_offline_sync_queue.sql`).
- RPC upserts `attendance` and records applied/rejected/duplicate.

## Mobile stub

Expo apps may persist drafts via existing secure storage helpers and flush on focus/network restore. Until wired, web tutors mark attendance online.
