/**
 * Offline attendance draft queue stub (attendance only).
 * See docs/OFFLINE_ATTENDANCE_SYNC.md
 */
import { Platform } from 'react-native';
import { storage } from './storage';
import { supabase } from './supabase';

const KEY = 'offline_attendance_drafts_v1';

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

export async function flushAttendanceDrafts() {
  const q = await readQueue();
  if (!q.length) return { flushed: 0 };
  const remaining = [];
  let flushed = 0;
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
    if (data?.status === 'rejected') remaining.push(item);
    else flushed += 1;
  }
  await writeQueue(remaining);
  return { flushed, remaining: remaining.length };
}
