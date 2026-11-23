/**
 * Offline attendance draft queue stub (attendance only).
 * See docs/OFFLINE_ATTENDANCE_SYNC.md
 *
 * Server may return status: applied | duplicate | conflict | rejected.
 * Conflicts are kept locally for staff resolution via correct_attendance.
 */
import { Platform } from 'react-native';
import { storage } from './storage';
import { supabase } from './supabase';

const KEY = 'offline_attendance_drafts_v1';
const CONFLICT_KEY = 'offline_attendance_conflicts_v1';

async function readQueue() {
  try {
    const raw = await storage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items) {
  await storage.setItem(KEY, JSON.stringify(items));
}

async function readConflicts() {
  try {
    const raw = await storage.getItem(CONFLICT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeConflicts(items) {
  await storage.setItem(CONFLICT_KEY, JSON.stringify(items));
}

export async function enqueueAttendanceDraft(draft) {
  const deviceId = Platform.OS + ':' + (draft.device_id || 'unknown');
  const item = {
    device_id: deviceId,
    idempotency_key: draft.idempotency_key || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    payload: {
      student_id: draft.student_id,
      date: draft.date,
      status: draft.status,
      excuse_note: draft.excuse_note || null,
    },
  };
  const q = await readQueue();
  q.push(item);
  await writeQueue(q);
  return item;
}

export async function listAttendanceConflicts() {
  return readConflicts();
}

export async function clearAttendanceConflict(idempotencyKey) {
  const items = await readConflicts();
  await writeConflicts(items.filter((c) => c.idempotency_key !== idempotencyKey));
}

export async function flushAttendanceDrafts() {
  const q = await readQueue();
  if (!q.length) return { flushed: 0, conflicts: 0, remaining: 0 };
  const remaining = [];
  const conflicts = await readConflicts();
  let flushed = 0;
  let conflictCount = 0;
  for (const item of q) {
    const { data, error } = await supabase.rpc('apply_offline_attendance_draft', {
      p_device_id: item.device_id,
      p_idempotency_key: item.idempotency_key,
      p_payload: item.payload,
    });
    if (error) {
      remaining.push(item);
      continue;
    }
    if (data?.status === 'rejected') {
      remaining.push(item);
      continue;
    }
    if (data?.status === 'conflict') {
      conflictCount += 1;
      conflicts.push({
        ...item,
        server_result: data.result,
        queued_at: new Date().toISOString(),
      });
      continue;
    }
    // applied | duplicate
    flushed += 1;
  }
  await writeQueue(remaining);
  await writeConflicts(conflicts);
  return { flushed, conflicts: conflictCount, remaining: remaining.length };
}
