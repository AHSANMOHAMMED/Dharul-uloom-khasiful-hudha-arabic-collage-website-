import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { ErpError } from './rpc';

const PAGE = 1000; // PostgREST's default max rows per response

/**
 * Call a set-returning RPC and read every row in pages. A plain .rpc() call is
 * silently capped at the server's max-rows, which would truncate big reports.
 */
export async function rpcAll(name, params = {}, { maxRows = 100000 } = {}) {
  if (!isSupabaseConfigured || !supabase) throw new ErpError('Supabase is not configured');
  const out = [];
  for (let from = 0; from < maxRows; from += PAGE) {
    const { data, error } = await supabase.rpc(name, params).range(from, from + PAGE - 1);
    if (error) throw new ErpError(error.message, error);
    out.push(...(data || []));
    if (!data || data.length < PAGE) return out;
  }
  throw new ErpError(`Report is larger than ${maxRows} rows; narrow the filters`);
}

export async function rpcJson(name, params = {}) {
  if (!isSupabaseConfigured || !supabase) throw new ErpError('Supabase is not configured');
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw new ErpError(error.message, error);
  return data;
}

const monthStr = (d) => d.toISOString().slice(0, 7);
const dayStr = (d) => d.toISOString().slice(0, 10);

/**
 * Report catalogue. Labels are [English, Arabic] pairs; the panel translates
 * them (Tamil comes from the locale dictionaries keyed by English).
 * filters: [{ key, label, type: 'class'|'month'|'date'|'select'|'exam', options?, default? }]
 * show(auth): who sees the report in the list (the database still decides the rows).
 */
export const REPORTS = [
  {
    id: 'students',
    icon: 'groups',
    title: ['Student roster', 'سجل الطلاب'],
    description: ['Full student profiles with guardian and contact details.', 'ملفات الطلاب الكاملة مع بيانات ولي الأمر والاتصال.'],
    show: (a) => a.isEmployee,
    filters: [
      { key: 'p_class', label: ['Class', 'الصف'], type: 'class' },
      {
        key: 'p_status',
        label: ['Status', 'الحالة'],
        type: 'select',
        options: [
          ['active', ['Active', 'نشط']],
          ['suspended', ['Suspended', 'موقوف']],
          ['graduated', ['Graduated', 'متخرج']],
          ['withdrawn', ['Withdrawn', 'منسحب']],
          ['transferred', ['Transferred', 'منقول']],
          ['alumni', ['Alumni', 'خريج']],
        ],
      },
    ],
    load: (p) => rpcAll('report_student_roster', { p_class: p.p_class ? Number(p.p_class) : null, p_status: p.p_status || null }),
    columns: [
      { key: 'index_number', label: ['Index no.', 'رقم القيد'], width: 12 },
      { key: 'full_name', label: ['Name', 'الاسم'], width: 28 },
      { key: 'class_number', label: ['Class', 'الصف'], type: 'number', width: 7 },
      { key: 'status', label: ['Status', 'الحالة'], width: 11 },
      { key: 'gender', label: ['Gender', 'الجنس'], width: 9 },
      { key: 'date_of_birth', label: ['Date of birth', 'تاريخ الميلاد'], type: 'date', width: 13 },
      { key: 'admission_no', label: ['Admission no.', 'رقم القبول'], width: 13 },
      { key: 'admission_date', label: ['Admitted', 'تاريخ القبول'], type: 'date', width: 12 },
      { key: 'phone', label: ['Phone', 'الهاتف'], width: 14 },
      { key: 'email', label: ['Email', 'البريد الإلكتروني'], width: 24 },
      { key: 'guardian_name', label: ['Guardian', 'ولي الأمر'], width: 22 },
      { key: 'guardian_relationship', label: ['Relationship', 'صلة القرابة'], width: 12 },
      { key: 'guardian_phone', label: ['Guardian phone', 'هاتف ولي الأمر'], width: 14 },
      { key: 'guardian_email', label: ['Guardian email', 'بريد ولي الأمر'], width: 24 },
      { key: 'address', label: ['Address', 'العنوان'], width: 30 },
      { key: 'city', label: ['City', 'المدينة'], width: 14 },
      { key: 'national_id', label: ['National ID', 'رقم الهوية'], width: 14 },
      { key: 'blood_group', label: ['Blood group', 'فصيلة الدم'], width: 9 },
      { key: 'previous_school', label: ['Previous school', 'المدرسة السابقة'], width: 22 },
    ],
    printColumns: ['index_number', 'full_name', 'class_number', 'gender', 'date_of_birth', 'guardian_name', 'guardian_phone', 'city', 'status'],
  },
  {
    id: 'staff',
    icon: 'badge',
    title: ['Staff directory', 'دليل الموظفين'],
    description: ['Lecturers and staff with department, role and employment details.', 'المحاضرون والموظفون مع القسم والوظيفة وبيانات التوظيف.'],
    show: (a) => a.isAdmin || a.isHrStaff || a.isPrincipal || a.isVP,
    filters: [
      {
        key: 'p_status',
        label: ['Status', 'الحالة'],
        type: 'select',
        options: [
          ['active', ['Active', 'نشط']],
          ['on_leave', ['On leave', 'في إجازة']],
          ['resigned', ['Resigned', 'مستقيل']],
          ['terminated', ['Terminated', 'منتهي الخدمة']],
        ],
      },
    ],
    load: (p) => rpcAll('report_staff_directory', { p_status: p.p_status || null }),
    columns: [
      { key: 'employee_no', label: ['Employee no.', 'الرقم الوظيفي'], width: 12 },
      { key: 'full_name', label: ['Name', 'الاسم'], width: 28 },
      { key: 'account_type', label: ['Type', 'النوع'], width: 9 },
      { key: 'roles', label: ['Roles', 'الأدوار'], width: 22 },
      { key: 'department', label: ['Department', 'القسم'], width: 16 },
      { key: 'job_title', label: ['Job title', 'المسمى الوظيفي'], width: 18 },
      { key: 'employment_type', label: ['Employment', 'نوع التوظيف'], width: 12 },
      { key: 'employment_start', label: ['Joined', 'تاريخ الالتحاق'], type: 'date', width: 12 },
      { key: 'phone', label: ['Phone', 'الهاتف'], width: 14 },
      { key: 'email', label: ['Email', 'البريد الإلكتروني'], width: 26 },
      { key: 'status', label: ['Status', 'الحالة'], width: 10 },
    ],
  },
  {
    id: 'attendance',
    icon: 'fact_check',
    title: ['Attendance summary', 'ملخص الحضور'],
    description: ['Present, late, excused and absent days per student for a date range.', 'أيام الحضور والتأخر والغياب لكل طالب خلال فترة.'],
    show: (a) => a.isEmployee,
    filters: [
      { key: 'p_from', label: ['From', 'من'], type: 'date', default: () => dayStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) },
      { key: 'p_to', label: ['To', 'إلى'], type: 'date', default: () => dayStr(new Date()) },
      { key: 'p_class', label: ['Class', 'الصف'], type: 'class' },
    ],
    required: ['p_from', 'p_to'],
    load: (p) => rpcAll('report_attendance_summary', { p_from: p.p_from, p_to: p.p_to, p_class: p.p_class ? Number(p.p_class) : null }),
    columns: [
      { key: 'index_number', label: ['Index no.', 'رقم القيد'], width: 12 },
      { key: 'full_name', label: ['Name', 'الاسم'], width: 28 },
      { key: 'class_number', label: ['Class', 'الصف'], type: 'number', width: 7 },
      { key: 'present', label: ['Present', 'حاضر'], type: 'number', width: 9 },
      { key: 'late', label: ['Late', 'متأخر'], type: 'number', width: 8 },
      { key: 'excused', label: ['Excused', 'بعذر'], type: 'number', width: 9 },
      { key: 'absent', label: ['Absent', 'غائب'], type: 'number', width: 8 },
      { key: 'marked_days', label: ['Days marked', 'الأيام المسجلة'], type: 'number', width: 11 },
      { key: 'attendance_pct', label: ['Attendance %', 'نسبة الحضور'], type: 'percent', width: 12 },
    ],
  },
  {
    id: 'fees',
    icon: 'payments',
    title: ['Fee collection & arrears', 'تحصيل الرسوم والمتأخرات'],
    description: ['Invoiced, paid and outstanding fees per student, with unpaid months.', 'الرسوم المفوترة والمدفوعة والمتبقية لكل طالب مع الأشهر غير المدفوعة.'],
    show: (a) => a.isFinanceViewer,
    filters: [
      { key: 'p_from_month', label: ['From month', 'من شهر'], type: 'month', default: () => `${new Date().getFullYear()}-01` },
      { key: 'p_to_month', label: ['To month', 'إلى شهر'], type: 'month', default: () => monthStr(new Date()) },
      { key: 'p_class', label: ['Class', 'الصف'], type: 'class' },
    ],
    required: ['p_from_month', 'p_to_month'],
    load: (p) =>
      rpcAll('report_fee_summary', { p_from_month: p.p_from_month, p_to_month: p.p_to_month, p_class: p.p_class ? Number(p.p_class) : null }),
    columns: [
      { key: 'index_number', label: ['Index no.', 'رقم القيد'], width: 12 },
      { key: 'full_name', label: ['Name', 'الاسم'], width: 28 },
      { key: 'class_number', label: ['Class', 'الصف'], type: 'number', width: 7 },
      { key: 'invoices', label: ['Invoices', 'الفواتير'], type: 'number', width: 9 },
      { key: 'invoiced', label: ['Invoiced', 'المفوتر'], type: 'money', width: 13 },
      { key: 'paid', label: ['Paid', 'المدفوع'], type: 'money', width: 13 },
      { key: 'outstanding', label: ['Outstanding', 'المتبقي'], type: 'money', width: 13 },
      { key: 'unpaid_months', label: ['Unpaid months', 'الأشهر غير المدفوعة'], width: 30 },
    ],
    totals: ['invoiced', 'paid', 'outstanding'],
  },
  {
    id: 'results',
    icon: 'grading',
    title: ['Exam results', 'نتائج الامتحانات'],
    description: ['Marks and grades for an exam; Excel export adds a mark sheet with one column per subject.', 'الدرجات والتقديرات لامتحان؛ ملف Excel يضيف كشفاً بعمود لكل مادة.'],
    show: (a) => a.isEmployee,
    filters: [{ key: 'p_exam', label: ['Exam', 'الامتحان'], type: 'exam' }],
    required: ['p_exam'],
    load: (p) => rpcAll('report_exam_results', { p_exam: p.p_exam }),
    columns: [
      { key: 'index_number', label: ['Index no.', 'رقم القيد'], width: 12 },
      { key: 'full_name', label: ['Name', 'الاسم'], width: 28 },
      { key: 'class_number', label: ['Class', 'الصف'], type: 'number', width: 7 },
      { key: 'subject_code', label: ['Code', 'الرمز'], width: 8 },
      { key: 'subject', label: ['Subject', 'المادة'], width: 22 },
      { key: 'marks_obtained', label: ['Marks', 'الدرجة'], type: 'number', width: 8 },
      { key: 'max_marks', label: ['Max', 'العظمى'], type: 'number', width: 7 },
      { key: 'percentage', label: ['%', '%'], type: 'percent', width: 8 },
      { key: 'grade', label: ['Grade', 'التقدير'], width: 7 },
      { key: 'remarks', label: ['Remarks', 'ملاحظات'], width: 24 },
    ],
  },
];

/**
 * Long results (one row per student × subject) → mark sheet
 * (one row per student, one column per subject, plus total and average %).
 */
export function pivotResults(rows) {
  const subjects = [];
  const byStudent = new Map();
  for (const r of rows) {
    const code = r.subject_code || r.subject || '?';
    if (!subjects.some((s) => s.code === code)) subjects.push({ code, name: r.subject || code });
    if (!byStudent.has(r.index_number)) {
      byStudent.set(r.index_number, { index_number: r.index_number, full_name: r.full_name, class_number: r.class_number, _total: 0, _max: 0 });
    }
    const s = byStudent.get(r.index_number);
    s[`sub_${code}`] = r.marks_obtained;
    s._total += Number(r.marks_obtained) || 0;
    s._max += Number(r.max_marks) || 0;
  }
  const students = [...byStudent.values()].map((s) => ({
    ...s,
    total: s._total,
    average_pct: s._max ? Math.round((1000 * s._total) / s._max) / 10 : null,
  }));
  // Rank by total (ties share a rank).
  const sorted = [...students].sort((a, b) => b.total - a.total);
  sorted.forEach((s, i) => {
    s.rank = i > 0 && sorted[i - 1].total === s.total ? sorted[i - 1].rank : i + 1;
  });
  return { subjects, students };
}

export function totalsFor(rows, keys = []) {
  if (!keys.length) return null;
  return Object.fromEntries(keys.map((k) => [k, rows.reduce((sum, r) => sum + (Number(r[k]) || 0), 0)]));
}
