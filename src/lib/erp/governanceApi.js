import { supabase } from '../supabaseClient';
import { query, rpc, insertRow, updateRow } from './rpc';

/**
 * Governance data helpers: duties (responsibilities) per academic year,
 * petty cash per duty, mashoora meetings and the task board.
 * Authorization lives in the database (see 0022_governance_duties_mashoora.sql).
 */

// [English, Arabic] pairs — rendered through t(en, ar) so Tamil comes from the dictionary.
export const DUTY_CATEGORIES = {
  academic: ['Academic', 'أكاديمي'],
  welfare: ['Welfare', 'الرعاية'],
  facilities: ['Facilities', 'المرافق'],
  finance: ['Finance', 'المالية'],
  administration: ['Administration', 'الإدارة'],
  religious: ['Religious', 'ديني'],
  other: ['Other', 'أخرى'],
};

export const MEETING_TYPES = {
  weekly: ['Weekly', 'أسبوعي'],
  annual: ['Annual', 'سنوي'],
  special: ['Special', 'استثنائي'],
};

export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done'];
export const TASK_STATUS_LABELS = {
  todo: ['To do', 'للتنفيذ'],
  in_progress: ['In progress', 'قيد التنفيذ'],
  review: ['Review', 'للمراجعة'],
  done: ['Done', 'منجز'],
};

export const TASK_PRIORITIES = {
  low: ['Low', 'منخفضة'],
  normal: ['Normal', 'عادية'],
  high: ['High', 'عالية'],
  urgent: ['Urgent', 'عاجلة'],
};

export const PETTY_ENTRY_TYPES = {
  topup: ['Top-up', 'تعبئة'],
  expense: ['Spend', 'صرف'],
  return: ['Return', 'إرجاع'],
};

/** Options for a Select from an { value: [en, ar] } map. */
export function pairOptions(map, t) {
  return Object.entries(map).map(([value, [en, arText]]) => ({ value, label: t(en, arText) }));
}

export function pairLabel(map, key, t) {
  const p = map[key];
  return p ? t(p[0], p[1]) : key || '—';
}

/** Duty name in the UI language (name_ta / name_ar fall back to English). */
export function dutyName(d, lang) {
  if (!d) return '—';
  if (lang === 'ta' && d.name_ta) return d.name_ta;
  if (lang === 'ar' && d.name_ar) return d.name_ar;
  return d.name_en || d.code || '—';
}

/** The DB's own message (rpc.js replaces 42501 messages with a generic one). */
export function dbMessage(e) {
  return e?.cause?.message || e?.message || String(e);
}

/** Monday of the week containing an ISO date (local). */
export function weekStartOf(iso) {
  const d = iso ? new Date(`${iso}T00:00:00`) : new Date();
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

const DUTY_COLS = 'id, code, name_en, name_ar, name_ta, category, description, default_petty_cash, grants_leave_review, is_active';

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------
export function listDutyRoles({ activeOnly = false } = {}) {
  return query('duty_roles', (q) => {
    let b = q.select(DUTY_COLS).order('category').order('name_en');
    if (activeOnly) b = b.eq('is_active', true);
    return b;
  });
}

export function saveDutyRole(row) {
  const { id, ...patch } = row;
  return id ? updateRow('duty_roles', id, patch) : insertRow('duty_roles', patch);
}

export function listAcademicYears() {
  return query('academic_years', (q) => q.select('id, name, is_current, start_date').order('start_date', { ascending: false })).catch(() => []);
}

export function listMeetings({ limit = 200 } = {}) {
  return query('mashoora_meetings', (q) => q.select('*').order('meeting_date', { ascending: false }).limit(limit));
}

export function saveMeeting(row) {
  const { id, ...patch } = row;
  return id ? updateRow('mashoora_meetings', id, patch) : insertRow('mashoora_meetings', patch);
}

const ASSIGNMENT_SELECT =
  '*, duty:duty_roles(' + DUTY_COLS + '), meeting:mashoora_meetings(id, title, meeting_date), year:academic_years(id, name)';

/** Duty assignments (active by default) with their duty / meeting / year. */
export function listAssignments({ status = 'active', assigneeId, meetingId } = {}) {
  return query('duty_assignments', (q) => {
    let b = q.select(ASSIGNMENT_SELECT).order('start_date', { ascending: false }).limit(1000);
    if (status) b = b.eq('status', status);
    if (assigneeId) b = b.eq('assignee_id', assigneeId);
    if (meetingId) b = b.eq('meeting_id', meetingId);
    return b;
  });
}

export function assignDuty({ duty, assignee, start, meeting, academicYear, notes, keepExisting = false }) {
  return rpc('assign_duty', {
    p_duty: duty,
    p_assignee: assignee,
    p_start: start || null,
    p_meeting: meeting || null,
    p_academic_year: academicYear || null,
    p_notes: notes?.trim() || null,
    p_keep_existing: Boolean(keepExisting),
  });
}

/**
 * Map duty_role_id → preferred active holder (lead first).
 * Used so Mashoora / Kanban task forms can auto-assign to the staff who currently holds that duty.
 */
export async function activeHoldersByDuty() {
  const rows = (await listAssignments({ status: 'active' })) || [];
  const map = {};
  for (const a of rows) {
    if (!a.duty_role_id || !a.assignee_id) continue;
    const prev = map[a.duty_role_id];
    if (!prev || (a.is_lead && !prev.is_lead)) {
      map[a.duty_role_id] = { assignee_id: a.assignee_id, is_lead: Boolean(a.is_lead), assignment_id: a.id };
    }
  }
  return map;
}

export function holderIdForDuty(holdersMap, dutyRoleId) {
  if (!dutyRoleId || !holdersMap) return null;
  return holdersMap[dutyRoleId]?.assignee_id || null;
}

export function endDuty(assignment, end, reason) {
  return rpc('end_duty', { p_assignment: assignment, p_end: end || null, p_reason: reason?.trim() || null });
}

export function closeDutyYear(end, reason) {
  return rpc('close_duty_year', { p_end: end || null, p_reason: reason?.trim() || 'End of academic year' });
}

export async function dutyHistory(duty) {
  const r = await rpc('duty_history', { p_duty: duty });
  return { duty: r?.duty || null, assignments: r?.assignments || [] };
}

// ---------------------------------------------------------------------------
// Petty cash
// ---------------------------------------------------------------------------
export async function fundBalance(fundId) {
  const r = await rpc('petty_cash_balance', { p_fund: fundId });
  return {
    posted_balance: Number(r?.posted_balance || 0),
    pending_spend: Number(r?.pending_spend || 0),
    available: Number(r?.available || 0),
  };
}

/** Funds with duty, current holder(s) and balances. */
export async function listFunds() {
  const funds = (await query('petty_cash_funds', (q) => q.select('*, duty:duty_roles(' + DUTY_COLS + ')').order('created_at'))) || [];
  const active = funds.length
    ? (await query('duty_assignments', (q) =>
        q.select('id, duty_role_id, assignee_id, is_lead, start_date').eq('status', 'active').in('duty_role_id', funds.map((f) => f.duty_role_id)),
      )) || []
    : [];
  const balances = await Promise.all(funds.map((f) => fundBalance(f.id).catch(() => ({ posted_balance: 0, pending_spend: 0, available: 0 }))));
  return funds.map((f, i) => {
    const holders = active
      .filter((a) => a.duty_role_id === f.duty_role_id)
      .sort((a, b) => Number(b.is_lead) - Number(a.is_lead) || String(b.start_date).localeCompare(String(a.start_date)));
    return { ...f, holders, holder_id: holders[0]?.assignee_id || null, balance: balances[i] };
  });
}

export function updateFund(id, patch) {
  return updateRow('petty_cash_funds', id, patch);
}

export function createFund(dutyRoleId, floatLimit) {
  return insertRow('petty_cash_funds', { duty_role_id: dutyRoleId, float_limit: Number(floatLimit) || 0 });
}

export function listPettyEntries({ fundId, holderId, status, limit = 500 } = {}) {
  return query('petty_cash_entries', (q) => {
    let b = q
      .select('*, account:accounts!petty_cash_entries_account_id_fkey(code, name, name_ar)')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (fundId) b = b.eq('fund_id', fundId);
    if (holderId) b = b.eq('holder_id', holderId);
    if (status) b = b.eq('status', status);
    return b;
  });
}

export const pettyTopup = (fund, amount, fromCode, note) =>
  rpc('petty_cash_topup', { p_fund: fund, p_amount: amount, p_from_code: fromCode || '1000', p_note: note?.trim() || null });

export const pettyReturn = (fund, amount, toCode, note) =>
  rpc('petty_cash_return', { p_fund: fund, p_amount: amount, p_to_code: toCode || '1000', p_note: note?.trim() || null });

export const pettySpend = ({ fund, amount, account, description, vendor, receiptUrl, date }) =>
  rpc('petty_cash_spend', {
    p_fund: fund,
    p_amount: amount,
    p_expense_account: account,
    p_description: description.trim(),
    p_vendor: vendor?.trim() || null,
    p_receipt_url: receiptUrl?.trim() || null,
    p_date: date || null,
  });

export const reviewPetty = (entry, approve, reason) =>
  rpc('review_petty_cash', { p_entry: entry, p_approve: approve, p_reason: reason?.trim() || null });

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
const TASK_SELECT = '*, duty:duty_roles(' + DUTY_COLS + '), meeting:mashoora_meetings(id, title, meeting_date)';

export function listTasks({ assigneeId, dutyId, weekStart, meetingId, priority, limit = 1000 } = {}) {
  return query('tasks', (q) => {
    let b = q.select(TASK_SELECT).order('position').order('created_at', { ascending: false }).limit(limit);
    if (assigneeId) b = b.eq('assignee_id', assigneeId);
    if (dutyId) b = b.eq('duty_role_id', dutyId);
    if (weekStart) b = b.eq('week_start', weekStart);
    if (meetingId) b = b.eq('meeting_id', meetingId);
    if (priority) b = b.eq('priority', priority);
    return b;
  });
}

export function createTask(row) {
  return insertRow('tasks', row, TASK_SELECT);
}

export function updateTask(id, patch) {
  return query('tasks', (q) => q.update(patch).eq('id', id).select(TASK_SELECT).single());
}

/** Persist Kanban column order after a drop (status + position). */
export function reorderTask(id, { status, position }) {
  const patch = {};
  if (status) patch.status = status;
  if (position != null) patch.position = position;
  return updateTask(id, patch);
}

export function deleteTask(id) {
  return query('tasks', (q) => q.delete().eq('id', id));
}

export function listTaskComments(taskId) {
  return query('task_comments', (q) => q.select('*').eq('task_id', taskId).order('created_at'));
}

export function addTaskComment(taskId, body) {
  return insertRow('task_comments', { task_id: taskId, body: body.trim() });
}

export function listTaskEvents(taskId) {
  return query('task_events', (q) => q.select('*').eq('task_id', taskId).order('created_at'));
}

/** tasks: [{ title, description, assignee_id, due_date, priority, duty_role_id }] */
export function createMeetingTasks(meetingId, tasks) {
  return rpc('create_meeting_tasks', { p_meeting: meetingId, p_tasks: tasks });
}

// ---------------------------------------------------------------------------
// Realtime + acting institution
// ---------------------------------------------------------------------------
/** Subscribe to postgres_changes on a table (RLS applies); returns an unsubscribe fn. */
export function subscribeTable(table, onChange, name = `gov-${table}`) {
  if (!supabase?.channel) return () => {};
  const channel = supabase
    .channel(`${name}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => onChange(payload))
    .subscribe();
  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {
      /* already closed */
    }
  };
}

export const setActingOrg = (orgId) => rpc('set_acting_org', { p_org: orgId || null });

/** The super admin's acting institution (null when not acting). */
export async function fetchActingOrg(userId) {
  if (!userId) return null;
  const p = await query('profiles', (q) => q.select('acting_org_id').eq('id', userId).maybeSingle());
  if (!p?.acting_org_id) return null;
  const org = await query('organizations', (q) => q.select('id, name_en, name_ar, slug').eq('id', p.acting_org_id).maybeSingle());
  return org || { id: p.acting_org_id, name_en: p.acting_org_id };
}
