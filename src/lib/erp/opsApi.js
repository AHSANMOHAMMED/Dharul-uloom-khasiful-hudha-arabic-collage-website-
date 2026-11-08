import { query, rpc, insertRow, updateRow } from './rpc';
import { profilesMap } from './financeApi';
import { subscribeTable } from './governanceApi';

/**
 * Operations helpers: activities with several responsible staff, today's
 * finance desk (reminders, receipts, message log) and analytics.
 * Authorization lives in the database (0025_finance_ops_activities_analytics.sql).
 */

// [English, Arabic] pairs — rendered through t(en, ar) so Tamil comes from the dictionary.
export const ACTIVITY_CATEGORIES = {
  event: ['Event', 'فعالية'],
  exam_duty: ['Exam duty', 'مراقبة امتحان'],
  trip: ['Trip', 'رحلة'],
  programme: ['Programme', 'برنامج'],
  meeting: ['Meeting', 'اجتماع'],
  maintenance: ['Maintenance', 'صيانة'],
  religious: ['Religious', 'ديني'],
  sports: ['Sports', 'رياضة'],
  other: ['Other', 'أخرى'],
};

export const ACTIVITY_STATUSES = {
  planned: ['Planned', 'مخطط'],
  ongoing: ['Ongoing', 'جارٍ'],
  completed: ['Completed', 'مكتمل'],
  cancelled: ['Cancelled', 'ملغى'],
};

export const ASSIGNEE_ROLES = {
  lead: ['Team lead', 'مسؤول رئيسي'],
  coordinator: ['Coordinator', 'منسق'],
  supervisor: ['Supervisor', 'مشرف'],
  member: ['Member', 'عضو'],
  helper: ['Helper', 'مساعد'],
};

export const ASSIGNEE_STATUSES = {
  assigned: ['Awaiting reply', 'بانتظار الرد'],
  accepted: ['Accepted', 'مقبول'],
  declined: ['Declined', 'معتذر'],
  done: ['Done', 'منجز'],
};

export const MESSAGE_STATUSES = {
  pending: ['Queued', 'في الانتظار'],
  sending: ['Sending', 'قيد الإرسال'],
  sent: ['Sent', 'أُرسلت'],
  failed: ['Failed', 'فشلت'],
  blocked: ['Blocked', 'محظورة'],
  skipped: ['Skipped', 'تم التخطي'],
};

export const CHANNELS = {
  sms: ['SMS', 'رسالة قصيرة'],
  email: ['E-mail', 'بريد إلكتروني'],
  push: ['Push', 'إشعار'],
  whatsapp: ['WhatsApp', 'واتساب'],
};

export const AGEING_BUCKETS = [
  { key: 'not_due', label: ['Not yet due', 'لم يحن موعده'] },
  { key: 'd0_30', label: ['0–30 days', '0–30 يومًا'] },
  { key: 'd31_60', label: ['31–60 days', '31–60 يومًا'] },
  { key: 'd61_90', label: ['61–90 days', '61–90 يومًا'] },
  { key: 'd90_plus', label: ['Over 90 days', 'أكثر من 90 يومًا'] },
];

export const STATUS_TONES = {
  planned: 'blue', ongoing: 'amber', completed: 'green', cancelled: 'red',
  assigned: 'amber', accepted: 'green', declined: 'red', done: 'green',
  pending: 'amber', sending: 'amber', sent: 'green', failed: 'red', blocked: 'red', skipped: 'gray',
};

// ---------------------------------------------------------------------------
// Pure helpers (unit-testable)
// ---------------------------------------------------------------------------
export const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** Split activities by time: ongoing (started, not ended), upcoming, past. */
export function splitByTime(list, now = new Date()) {
  const out = { upcoming: [], ongoing: [], past: [] };
  const t = now.getTime();
  for (const a of list || []) {
    const s = new Date(a.starts_at).getTime();
    const e = a.ends_at ? new Date(a.ends_at).getTime() : s;
    if (a.status === 'completed' || a.status === 'cancelled' || e < t) out.past.push(a);
    else if (a.status === 'ongoing' || s <= t) out.ongoing.push(a);
    else out.upcoming.push(a);
  }
  out.upcoming.sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
  out.ongoing.sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
  out.past.sort((a, b) => String(b.starts_at).localeCompare(String(a.starts_at)));
  return out;
}

/** ISO timestamp → value for <input type="datetime-local"> (local time). */
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromLocalInput(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** { method: amount } → sorted rows with a total. */
export function methodRows(byMethod) {
  const rows = Object.entries(byMethod || {})
    .map(([method, amount]) => ({ method, amount: n(amount) }))
    .sort((a, b) => b.amount - a.amount);
  return { rows, total: rows.reduce((s, r) => s + r.amount, 0) };
}

/** Ageing buckets with their sum and whether it matches the reported total (to the cent). */
export function ageingRows(aging) {
  const a = aging || {};
  const rows = AGEING_BUCKETS.map((b) => ({ ...b, amount: n(a[b.key]) }));
  const sum = rows.reduce((s, r) => s + r.amount, 0);
  const total = n(a.total);
  return { rows, sum, total, students: n(a.students), balanced: Math.round(sum * 100) === Math.round(total * 100) };
}

/** Finance months with outgoings (expenses + petty cash + payroll) and net. */
export function monthRows(months) {
  return (months || []).map((m) => {
    const outgoing = n(m.expenses) + n(m.petty_cash) + n(m.payroll);
    return {
      month: m.month,
      invoiced: n(m.invoiced),
      collected_for_month: n(m.collected_for_month),
      cash_received: n(m.cash_received),
      expenses: n(m.expenses),
      petty_cash: n(m.petty_cash),
      payroll: n(m.payroll),
      donations: n(m.donations),
      outgoing,
      net: n(m.cash_received) + n(m.donations) - outgoing,
    };
  });
}

export function sumBy(rows, key) {
  return (rows || []).reduce((s, r) => s + n(r[key]), 0);
}

/** 'YYYY-MM' → 'Mar 26'. */
export function shortMonth(ym) {
  if (!ym || !/^\d{4}-\d{2}/.test(ym)) return ym || '';
  const d = new Date(`${ym.slice(0, 7)}-01T00:00:00`);
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

export function pct(v) {
  return v === null || v === undefined || v === '' ? '—' : `${n(v).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------
const ACTIVITY_COLS = 'id, title, description, category, starts_at, ends_at, location, status, budget, duty_role_id, meeting_id, created_by, created_at';

export async function listActivities({ limit = 500 } = {}) {
  const [rows, team] = await Promise.all([
    query('activities', (q) => q.select(ACTIVITY_COLS).order('starts_at', { ascending: false }).limit(limit)),
    query('activity_assignees', (q) => q.select('activity_id, status').limit(5000)),
  ]);
  const counts = {};
  for (const x of team || []) {
    const c = (counts[x.activity_id] ||= { total: 0, accepted: 0, declined: 0, done: 0, assigned: 0 });
    c.total += 1;
    c[x.status] = (c[x.status] || 0) + 1;
  }
  return (rows || []).map((a) => ({ ...a, team: counts[a.id] || { total: 0, accepted: 0, declined: 0, done: 0, assigned: 0 } }));
}

export function saveActivity(row) {
  const { id, ...patch } = row;
  return id ? updateRow('activities', id, patch) : insertRow('activities', patch);
}

export async function listActivityTeam(activityId) {
  const rows = await query('activity_assignees', (q) =>
    q.select('id, profile_id, role, responsibilities, status, response_note, responded_at, created_at').eq('activity_id', activityId).order('created_at'),
  );
  const people = await profilesMap((rows || []).map((r) => r.profile_id));
  return (rows || []).map((r) => ({ ...r, person: people[r.profile_id] || null }));
}

/** Expense claims tagged to an activity (rows the caller may read under RLS). */
export function listActivityExpenses(activityId) {
  return query('expenses', (q) =>
    q.select('id, expense_no, expense_date, payee, description, amount, status').eq('activity_id', activityId).order('expense_date', { ascending: false }),
  );
}

export const assignActivityStaff = (activity, people) => rpc('assign_activity_staff', { p_activity: activity, p_people: people });
export const removeActivityStaff = (activity, profile) => rpc('remove_activity_staff', { p_activity: activity, p_profile: profile });
export const respondActivity = (activity, status, note) => rpc('respond_activity', { p_activity: activity, p_status: status, p_note: note || null });
export const myResponsibilities = async () => (await rpc('my_responsibilities')) || {};

// ---------------------------------------------------------------------------
// Finance desk
// ---------------------------------------------------------------------------
export const financeToday = async () => (await rpc('finance_today')) || {};
export const sendFeeReminder = (student, note) => rpc('send_fee_reminder', { p_student: student, p_note: note || null });
export const sendOverdueReminders = (minDays, limit = 200) => rpc('send_overdue_reminders', { p_min_days: minDays, p_limit: limit });
export const resendReceipt = (receipt) => rpc('resend_receipt', { p_receipt: receipt });
export const studentMessageLog = async (student, limit = 50) => (await rpc('student_message_log', { p_student: student, p_limit: limit })) || [];
export const studentArrears = (student) => rpc('student_arrears', { p_student: student });

/** Live updates when receipts are posted or reversed; returns cleanup. */
export function subscribeReceipts(onChange) {
  return subscribeTable('fee_receipts', onChange, 'ops-fee-receipts');
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
export const financeAnalytics = async (months = 12) => (await rpc('finance_analytics', { p_months: months })) || {};
export const academicAnalytics = async (days = 180) => (await rpc('academic_analytics', { p_days: days })) || {};
