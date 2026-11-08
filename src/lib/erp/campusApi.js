import { query } from './rpc';
import { tx } from '../tx';

/**
 * Shared data helpers + constants for the campus / academic / HR ERP modules.
 * Authorization is enforced by the database (RLS + RPC checks); these helpers
 * only shape queries and printable documents.
 */

export const CLASS_NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAYS_AR = {
  Monday: 'الإثنين',
  Tuesday: 'الثلاثاء',
  Wednesday: 'الأربعاء',
  Thursday: 'الخميس',
  Friday: 'الجمعة',
  Saturday: 'السبت',
  Sunday: 'الأحد',
};

/** Staff roles accepted by profiles.assigned_tutor_role / extra_roles. */
export const STAFF_ROLES = [
  { value: 'principal', en: 'Principal', ar: 'المدير' },
  { value: 'vice_principal', en: 'Vice principal', ar: 'نائب المدير' },
  { value: 'treasurer', en: 'Treasurer', ar: 'أمين الصندوق' },
  { value: 'accountant', en: 'Accountant', ar: 'المحاسب' },
  { value: 'hr_manager', en: 'HR manager', ar: 'مدير الموارد البشرية' },
  { value: 'librarian', en: 'Librarian', ar: 'أمين المكتبة' },
  { value: 'admissions_officer', en: 'Admissions officer', ar: 'مسؤول القبول' },
  { value: 'warden', en: 'Warden', ar: 'مشرف السكن' },
  { value: 'counselor', en: 'Counselor', ar: 'المرشد' },
  { value: 'exam_officer', en: 'Exam officer', ar: 'مسؤول الامتحانات' },
];

export const CRM_STAGES = [
  { value: 'lead', en: 'Lead', ar: 'عميل محتمل' },
  { value: 'submitted', en: 'Submitted', ar: 'مقدم' },
  { value: 'interview', en: 'Interview', ar: 'مقابلة' },
  { value: 'accepted', en: 'Accepted', ar: 'مقبول' },
  { value: 'enrolled', en: 'Enrolled', ar: 'مسجل' },
  { value: 'rejected', en: 'Rejected', ar: 'مرفوض' },
];

/** admissions.status mirror for each pipeline stage (legacy status column). */
export const STAGE_STATUS = {
  lead: 'lead',
  submitted: 'pending',
  interview: 'interview',
  accepted: 'approved',
  enrolled: 'enrolled',
  rejected: 'rejected',
};

export const LEAD_SOURCES = [
  { value: 'website', en: 'Website', ar: 'الموقع' },
  { value: 'walk_in', en: 'Walk-in', ar: 'زيارة مباشرة' },
  { value: 'phone', en: 'Phone', ar: 'هاتف' },
  { value: 'referral', en: 'Referral', ar: 'إحالة' },
  { value: 'social', en: 'Social media', ar: 'وسائل التواصل' },
  { value: 'event', en: 'Event', ar: 'فعالية' },
  { value: 'mobile_app', en: 'Mobile app', ar: 'تطبيق الجوال' },
  { value: 'other', en: 'Other', ar: 'أخرى' },
];

export const COURSES = [
  { value: 'quran', en: 'Quran', ar: 'القرآن' },
  { value: 'arabic', en: 'Arabic', ar: 'العربية' },
  { value: 'hadith', en: 'Hadith', ar: 'الحديث' },
  { value: 'fiqh', en: 'Fiqh', ar: 'الفقه' },
  { value: 'islamic', en: 'Islamic studies', ar: 'الدراسات الإسلامية' },
];

export const CERTIFICATE_TYPES = [
  { value: 'completion', en: 'Completion', ar: 'إتمام الدراسة' },
  { value: 'character', en: 'Character', ar: 'حسن السيرة والسلوك' },
  { value: 'transfer', en: 'Transfer', ar: 'نقل' },
  { value: 'enrolment', en: 'Enrolment', ar: 'قيد' },
  { value: 'hifz', en: 'Hifz', ar: 'حفظ القرآن' },
  { value: 'ijazah', en: 'Ijazah', ar: 'إجازة' },
  { value: 'attendance', en: 'Attendance', ar: 'حضور' },
  { value: 'achievement', en: 'Achievement', ar: 'تفوق' },
  { value: 'other', en: 'Other', ar: 'أخرى' },
];

/** Map a [{value,en,ar}] list to Select options in the active language. */
export function toOptions(list) {
  return list.map((o) => ({ value: o.value, label: tx(o.ar, o.en) }));
}

export function labelOf(list, value) {
  const o = list.find((x) => x.value === value);
  return o ? tx(o.ar, o.en) : value ?? '—';
}

export function classOptions(t) {
  return CLASS_NUMBERS.map((n) => ({ value: String(n), label: `${t('Class', 'الصف')} ${n}` }));
}

/** Approved (or all) students of the caller's organization. */
export function fetchStudents({ includeUnapproved = false } = {}) {
  return query('profiles', (q) => {
    let b = q
      .select('id, full_name, email, phone, index_number, class_number, is_approved, created_at')
      .eq('account_type', 'student');
    if (!includeUnapproved) b = b.eq('is_approved', true);
    return b.order('full_name');
  });
}

/** Employees (tutors + non-teaching staff). */
export function fetchEmployees({ includeUnapproved = false } = {}) {
  return query('profiles', (q) => {
    let b = q
      .select('id, full_name, email, phone, account_type, role, is_approved, assigned_tutor_role, created_at')
      .in('account_type', ['tutor', 'staff']);
    if (!includeUnapproved) b = b.eq('is_approved', true);
    return b.order('full_name');
  });
}

export function studentLabel(s) {
  if (!s) return '—';
  const bits = [s.full_name || s.email || s.id];
  if (s.index_number) bits.push(`#${s.index_number}`);
  if (s.class_number) bits.push(`C${s.class_number}`);
  return bits.join(' · ');
}

/** Inclusive day count between two ISO dates (0 when invalid). */
export function daysInclusive(start, end) {
  if (!start || !end) return 0;
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  const d = Math.round((b - a) / 86400000) + 1;
  return Number.isFinite(d) && d > 0 ? d : 0;
}

export function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start, end: `${month}-${String(last).padStart(2, '0')}` };
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, 'Amiri', sans-serif; color: #1a1a1a; padding: 36px; max-width: 820px; margin: 0 auto; }
  .head { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1a5c38; padding-bottom: 14px; margin-bottom: 22px; gap: 16px; }
  .org { font-size: 20px; font-weight: 900; color: #1a5c38; }
  .org-sub { font-size: 11px; color: #555; margin-top: 2px; }
  .org-ar { font-size: 22px; color: #c9a227; font-weight: bold; direction: rtl; }
  h1 { text-align: center; font-size: 18px; color: #1a5c38; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 18px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; background: #f7faf8; border: 1px solid #d4e8dc; border-radius: 8px; padding: 14px; margin-bottom: 18px; font-size: 13px; }
  .meta .k { color: #666; font-size: 10px; text-transform: uppercase; font-weight: 600; letter-spacing: .5px; }
  .meta .v { font-weight: 700; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 13px; }
  th { background: #1a5c38; color: #fff; padding: 7px 10px; text-align: start; }
  td { padding: 7px 10px; border-bottom: 1px solid #eee; }
  td.num, th.num { text-align: end; }
  tr.total td { font-weight: 800; border-top: 2px solid #1a5c38; }
  .foot { margin-top: 36px; display: flex; justify-content: space-between; font-size: 12px; color: #777; }
  .sig { text-align: center; }
  .sig .line { border-top: 1px solid #999; width: 170px; margin: 34px auto 4px; }
  .muted { color: #777; font-size: 11px; }
  @media print { body { padding: 16px; } .no-print { display: none; } }
`;

/**
 * Open a clean printable document in a new window (same pattern as
 * src/lib/exportUtils.js). `bodyHtml` must already be escaped.
 */
export function openPrintWindow(title, bodyHtml, { dir = 'ltr', css = '' } = {}) {
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) {
    throw new Error('Pop-up blocked: allow pop-ups to print.');
  }
  win.document.write(`<!DOCTYPE html><html lang="${dir === 'rtl' ? 'ar' : 'en'}" dir="${dir}"><head><meta charset="UTF-8" />
<title>${escapeHtml(title)}</title><style>${PRINT_CSS}${css}</style></head><body>
${bodyHtml}
<div class="no-print" style="text-align:center;margin-top:24px"><button onclick="window.print()" style="padding:8px 20px;background:#1a5c38;color:#fff;border:0;border-radius:6px;cursor:pointer">Print</button></div>
</body></html>`);
  win.document.close();
  win.focus();
  return win;
}

export function printHeader(org) {
  return `<div class="head"><div><div class="org">${escapeHtml(org?.name_en || 'Dharul Uloom Kashiful Hudha')}</div>
<div class="org-sub">${escapeHtml(org?.address || 'Arabic College')}</div></div>
<div class="org-ar">${escapeHtml(org?.name_ar || 'دار العلوم كاشف الهدى')}</div></div>`;
}

/** Caller's organization (for printable headers). */
export async function fetchMyOrg(orgId) {
  if (!orgId) return null;
  const rows = await query('organizations', (q) =>
    q.select('id, name_en, name_ar, address, code, contact_email, contact_phone').eq('id', orgId).limit(1)
  );
  return rows?.[0] || null;
}

/** Parse a pasted CSV/TSV block into arrays of trimmed cells (skips blanks). */
export function parsePastedRows(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\t|,/).map((c) => c.trim().replace(/^"|"$/g, '')));
}

export function errMsg(e) {
  return e?.message || String(e);
}
