import { supabase } from './supabase';
import { toISODate } from './format';

/**
 * Duties, petty cash, mashoora and the task board (0022_governance_duties_mashoora.sql).
 * These helpers only decide what UI to show. The tg_tasks_guard trigger and RLS
 * decide what may actually change.
 */

export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done'];
export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
export const PRIORITY_TONE = { low: 'neutral', normal: 'info', high: 'warning', urgent: 'danger' };
export const TASK_STATUS_TONE = { todo: 'neutral', in_progress: 'info', review: 'warning', done: 'success' };

// Embeds used by task lists and the task detail screen. tasks has two FKs to
// profiles (assignee_id, created_by), so the profile embed names its FK.
export const TASK_COLUMNS =
  'id, title, description, status, priority, due_date, assignee_id, created_by, meeting_id, duty_role_id, completed_at, created_at, updated_at, ' +
  'duty:duty_roles(id, code, name_en, name_ar, name_ta), ' +
  'meeting:mashoora_meetings(id, title, meeting_date, meeting_type), ' +
  'assignee:profiles!tasks_assignee_id_fkey(full_name), ' +
  'creator:profiles!tasks_created_by_fkey(full_name)';

/** Duty name in the selected language (name_ta / name_ar / name_en). */
export function dutyName(duty, lang) {
  if (!duty) return '';
  if (lang === 'ta') return duty.name_ta || duty.name_en || duty.code || '';
  if (lang === 'ar') return duty.name_ar || duty.name_en || duty.code || '';
  return duty.name_en || duty.code || '';
}

/** Account name in the selected language (accounts has name / name_ar). */
export function accountName(account, lang) {
  if (!account) return '';
  return (lang === 'ar' && account.name_ar) || account.name || account.code || '';
}

export function isOverdue(task) {
  return !!task?.due_date && task.status !== 'done' && String(task.due_date).slice(0, 10) < toISODate();
}

export function nextStatus(status) {
  const i = TASK_STATUSES.indexOf(status);
  return i >= 0 && i < TASK_STATUSES.length - 1 ? TASK_STATUSES[i + 1] : null;
}

export function prevStatus(status) {
  const i = TASK_STATUSES.indexOf(status);
  return i > 0 ? TASK_STATUSES[i - 1] : null;
}

/**
 * Mirrors the tasks update policy + tg_tasks_guard:
 *  - governance (admin / principal / vice principal), the creator or the assignee may move a card;
 *  - an assignee who did not create the task cannot move it to Done (send to Review instead).
 */
export function canMoveTask(task, to, userId, caps) {
  if (!task || !to || !userId) return false;
  const manager = !!caps?.isGovernance;
  const creator = task.created_by === userId;
  const assignee = task.assignee_id === userId;
  if (!manager && !creator && !assignee) return false;
  if (to === 'done' && task.status !== 'done' && !manager && !creator) return false;
  return true;
}

/**
 * Update a task's status. Throws the DB error, or a 'not_allowed' error when
 * RLS silently matched no row.
 */
export async function moveTask(taskId, to) {
  const { data, error } = await supabase.from('tasks').update({ status: to }).eq('id', taskId).select('id, status');
  if (error) throw error;
  if (!data || !data.length) {
    const e = new Error('not_allowed');
    e.code = 'not_allowed';
    throw e;
  }
  return data[0];
}
