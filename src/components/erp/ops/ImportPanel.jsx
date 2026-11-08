import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';
import { Badge, Button, ErrorNote, Field, Loading, PageHeader, Select, Table, Tabs, useLang } from '../ui';
import { downloadImportTemplate, exportXlsx, readSpreadsheet } from '../../../lib/spreadsheet';
import { rpcJson } from '../../../lib/erp/reportsApi';
import { query } from '../../../lib/erp/rpc';

/**
 * Field lists mirror the import RPCs in 0027_import_reports.sql. Labels are
 * [English, Arabic]; `example` fills the template's sample row.
 */
const KINDS = {
  students: {
    rpc: 'import_students',
    title: ['Students', 'الطلاب'],
    help: [
      'Existing students are matched by index number and updated. New index numbers are pre-registered: the student signs up with that index number and the details are filled in automatically.',
      'يُطابَق الطلاب الحاليون برقم القيد ويُحدَّثون. أرقام القيد الجديدة تُسجَّل مسبقاً: يسجّل الطالب بهذا الرقم فتُملأ بياناته تلقائياً.',
    ],
    show: (a) => a.isAdmin || a.isAdmissionsStaff || a.isAcademicAdmin,
    fields: [
      { key: 'index_number', label: 'Index number', required: true, example: 'KH-2026-001' },
      { key: 'full_name', label: 'Full name', required: true, example: 'Mohamed Rizan' },
      { key: 'class_number', label: 'Class (1-7)', required: true, example: '1' },
      { key: 'date_of_birth', label: 'Date of birth', hint: 'YYYY-MM-DD', example: '2014-03-05' },
      { key: 'gender', label: 'Gender', hint: 'male / female', example: 'male' },
      { key: 'phone', label: 'Phone', example: '0771234567' },
      { key: 'admission_no', label: 'Admission number', example: 'ADM-118' },
      { key: 'admission_date', label: 'Admission date', hint: 'YYYY-MM-DD', example: '2026-01-15' },
      { key: 'guardian_name', label: 'Guardian name', example: 'Abdul Haleem' },
      { key: 'guardian_relationship', label: 'Guardian relationship', example: 'Father' },
      { key: 'guardian_phone', label: 'Guardian phone', example: '0779876543' },
      { key: 'guardian_email', label: 'Guardian email', example: '' },
      { key: 'address', label: 'Address', example: 'Main Street' },
      { key: 'city', label: 'City', example: 'Kalpitiya' },
      { key: 'national_id', label: 'National ID / birth certificate no.', example: '' },
      { key: 'nationality', label: 'Nationality', example: 'Sri Lankan' },
      { key: 'blood_group', label: 'Blood group', example: '' },
      { key: 'emergency_contact', label: 'Emergency contact', example: '' },
      { key: 'previous_school', label: 'Previous school', example: '' },
      { key: 'medical_notes', label: 'Medical notes', example: '' },
    ],
  },
  staff: {
    rpc: 'import_staff',
    title: ['Lecturers & staff', 'المحاضرون والموظفون'],
    help: [
      'Existing accounts are matched by email and their HR record updated (roles of existing accounts are not changed). New emails receive an invitation: when the person registers with that email they are approved automatically and their HR record is filled in.',
      'تُطابَق الحسابات الحالية بالبريد الإلكتروني ويُحدَّث سجلها الوظيفي (لا تتغير أدوار الحسابات الحالية). البريد الجديد يتلقى دعوة: عند التسجيل به يُعتمد الحساب تلقائياً ويُملأ سجله.',
    ],
    show: (a) => a.isAdmin || a.isHrStaff,
    fields: [
      { key: 'email', label: 'Email', required: true, example: 'ustadh.ahmed@example.com' },
      { key: 'full_name', label: 'Full name', required: true, example: 'Ahmed Fathih' },
      { key: 'account_type', label: 'Account type', hint: 'tutor (lecturer) or staff (non-teaching)', example: 'tutor' },
      {
        key: 'staff_role',
        label: 'Staff role (new accounts only)',
        hint: 'none, principal, vice_principal, treasurer, accountant, hr_manager, librarian, admissions_officer, warden, counselor, exam_officer',
        example: 'none',
      },
      { key: 'phone', label: 'Phone', example: '0771234567' },
      { key: 'employee_no', label: 'Employee number', example: 'E-014' },
      { key: 'department', label: 'Department', example: 'Arabic' },
      { key: 'job_title', label: 'Job title', example: 'Senior Lecturer' },
      { key: 'employment_type', label: 'Employment type', hint: 'permanent, contract, part_time, visiting, volunteer', example: 'permanent' },
      { key: 'employment_start', label: 'Start date', hint: 'YYYY-MM-DD', example: '2024-01-10' },
      { key: 'national_id', label: 'National ID', example: '' },
      { key: 'epf_no', label: 'EPF number', example: '' },
      { key: 'bank_name', label: 'Bank', example: '' },
      { key: 'bank_branch', label: 'Bank branch', example: '' },
      { key: 'bank_account_no', label: 'Bank account number', example: '' },
      { key: 'emergency_contact', label: 'Emergency contact name', example: '' },
      { key: 'emergency_phone', label: 'Emergency phone', example: '' },
    ],
  },
  marks: {
    rpc: 'import_exam_marks',
    title: ['Exam marks', 'درجات الامتحان'],
    help: [
      'Choose the exam, then upload one row per student and subject. Subjects must already be part of the exam paper; grades are calculated automatically. Your normal marks-entry permissions apply.',
      'اختر الامتحان ثم ارفع صفاً لكل طالب ومادة. يجب أن تكون المواد ضمن ورقة الامتحان؛ تُحسب التقديرات تلقائياً. تنطبق صلاحيات إدخال الدرجات المعتادة.',
    ],
    show: (a) => a.isEmployee,
    needsExam: true,
    fields: [
      { key: 'index_number', label: 'Student index number', required: true, example: 'KH-2026-001' },
      { key: 'subject_code', label: 'Subject code', required: true, example: 'QUR' },
      { key: 'marks', label: 'Marks obtained', required: true, example: '42' },
      { key: 'remarks', label: 'Remarks', example: '' },
    ],
  },
};

const ACTION_TONE = { create: 'green', update: 'blue', update_pending: 'blue', upsert: 'green', error: 'red' };

export default function ImportPanel() {
  const auth = useAuth();
  const { t, ar } = useLang();
  const tt = (pair) => t(pair[0], pair[1]);
  const kinds = useMemo(() => Object.entries(KINDS).filter(([, k]) => k.show(auth)), [auth]);
  const [kindId, setKindId] = useState(kinds[0]?.[0]);
  const kind = KINDS[kindId];

  const [file, setFile] = useState(null);
  const [rows, setRows] = useState(null);
  const [unknown, setUnknown] = useState([]);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [examId, setExamId] = useState('');
  const [exams, setExams] = useState([]);
  const inputRef = useRef(null);

  const reset = () => {
    setFile(null);
    setRows(null);
    setUnknown([]);
    setReport(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  useEffect(() => {
    if (!kind?.needsExam) return;
    query('exams', (q) => q.select('id, name, class_number, status').neq('status', 'published').order('created_at', { ascending: false }).limit(200))
      .then(setExams)
      .catch(() => setExams([]));
  }, [kind]);

  if (!kind) {
    return <p className="text-sm text-ink-text-secondary">{t('Bulk import is not available for your role.', 'الاستيراد الجماعي غير متاح لدورك.')}</p>;
  }

  const callRpc = (commit) =>
    rpcJson(kind.rpc, kind.needsExam ? { p_exam: examId, p_rows: rows, p_commit: commit } : { p_rows: rows, p_commit: commit });

  const onFile = async (f) => {
    reset();
    if (!f) return;
    setFile(f);
    setBusy(true);
    try {
      const parsed = await readSpreadsheet(f);
      const known = new Set(kind.fields.map((x) => x.key));
      setUnknown(parsed.headers.filter((h) => h && !known.has(h)));
      const missing = kind.fields.filter((x) => x.required && !parsed.headers.includes(x.key));
      if (missing.length) {
        throw new Error(
          `${t('Missing required columns', 'أعمدة مطلوبة مفقودة')}: ${missing.map((m) => m.key).join(', ')}. ${t('Download the template to see the expected columns.', 'نزّل القالب لمعرفة الأعمدة المطلوبة.')}`
        );
      }
      // Drop the template's example row if it was left in.
      const example = kind.fields.filter((x) => x.example).map((x) => [x.key, x.example]);
      const data = parsed.rows
        .filter((r) => !example.every(([k, v]) => r[k] === v))
        .map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => known.has(k))));
      if (!data.length) throw new Error(t('The file has no data rows.', 'الملف لا يحتوي على صفوف بيانات.'));
      setRows(data);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const validate = async () => {
    setBusy(true);
    setError(null);
    try {
      setReport(await callRpc(false));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!window.confirm(t('Import these rows now?', 'استيراد هذه الصفوف الآن؟'))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await callRpc(true);
      setReport(res);
      if (res.committed) {
        toast.success(
          `${t('Import complete', 'اكتمل الاستيراد')}: ${res.created} ${t('new', 'جديد')}, ${res.updated} ${t('updated', 'محدّث')}`
        );
      } else {
        toast.warn(t('Nothing was imported: fix the rows marked in red and try again.', 'لم يُستورد شيء: صحّح الصفوف المعلّمة بالأحمر وأعد المحاولة.'));
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const downloadErrors = () =>
    exportXlsx({
      filename: `${kindId}-import-errors`,
      rtl: ar,
      sheets: [
        {
          name: t('Errors', 'الأخطاء'),
          columns: [
            { key: 'row', label: t('Row', 'الصف'), type: 'number', width: 6 },
            ...kind.fields.map((f) => ({ key: f.key, label: f.key, width: 16 })),
            { key: '_errors', label: t('Errors', 'الأخطاء'), width: 60 },
          ],
          rows: report.rows
            .filter((r) => r.errors?.length)
            .map((r) => ({ ...rows[r.row - 1], row: r.row + 1, _errors: r.errors.join('; ') })),
        },
      ],
    }).catch((e) => toast.error(e.message));

  const errorCount = report?.errors ?? 0;
  const canCommit = report && !report.committed && errorCount === 0 && (!kind.needsExam || examId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('Bulk import', 'الاستيراد الجماعي')}
        subtitle={t('Upload an Excel (.xlsx) or CSV file. Every row is checked before anything is saved.', 'ارفع ملف Excel (.xlsx) أو CSV. يُفحص كل صف قبل حفظ أي شيء.')}
      />
      <Tabs
        tabs={kinds.map(([id, k]) => ({ id, label: tt(k.title) }))}
        active={kindId}
        onChange={(id) => {
          setKindId(id);
          reset();
        }}
      />

      <section className="rounded-[14px] border border-sand-border bg-paper-white p-4 sm:p-5 space-y-4">
        <p className="text-sm text-ink-text-secondary leading-relaxed">{tt(kind.help)}</p>

        <ol className="grid gap-4 md:grid-cols-3">
          <li className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{t('1. Template', '1. القالب')}</div>
            <Button
              variant="secondary"
              onClick={() =>
                downloadImportTemplate({ filename: `${kindId}-import-template.xlsx`, fields: kind.fields, sheetName: kind.title[0] }).catch((e) =>
                  toast.error(e.message)
                )
              }
            >
              <span className="material-symbols-outlined text-[16px] align-[-3px] me-1" aria-hidden>{'download'}</span>
              {t('Download template', 'تنزيل القالب')}
            </Button>
            <p className="text-xs text-ink-text-muted">
              {t('Required columns are dark green. Keep the first row as column names.', 'الأعمدة المطلوبة باللون الأخضر الداكن. أبقِ الصف الأول لأسماء الأعمدة.')}
            </p>
          </li>
          <li className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{t('2. Upload', '2. الرفع')}</div>
            {kind.needsExam && (
              <Field label={`${t('Exam', 'الامتحان')} *`}>
                <Select
                  value={examId}
                  onChange={(e) => {
                    setExamId(e.target.value);
                    setReport(null);
                  }}
                  placeholder={t('Choose an exam', 'اختر امتحاناً')}
                  options={exams.map((e) => ({ value: e.id, label: `${e.name}${e.class_number ? ` · ${t('Class', 'الصف')} ${e.class_number}` : ''}` }))}
                />
              </Field>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="block w-full text-sm text-ink-text-secondary file:me-3 file:rounded-[10px] file:border-0 file:bg-emerald-700 file:px-3 file:py-2 file:text-white file:font-semibold hover:file:bg-emerald-500"
            />
            {file && rows && (
              <p className="text-xs text-ink-text-muted">
                {file.name}: <b>{rows.length}</b> {t('rows', 'صف')}
              </p>
            )}
          </li>
          <li className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{t('3. Check & import', '3. الفحص والاستيراد')}</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={validate} disabled={!rows || busy || (kind.needsExam && !examId)}>
                {t('Check rows', 'فحص الصفوف')}
              </Button>
              <Button onClick={commit} disabled={!canCommit || busy}>
                {t('Import', 'استيراد')} {report && !report.committed ? `(${report.total})` : ''}
              </Button>
            </div>
          </li>
        </ol>

        {unknown.length > 0 && (
          <p className="text-xs rounded-[10px] bg-gold-wash-100 border border-brass-gold-500/30 px-3 py-2 text-ink-green-900">
            {t('These columns are not recognised and will be ignored', 'هذه الأعمدة غير معروفة وسيتم تجاهلها')}: {unknown.join(', ')}
          </p>
        )}
        <ErrorNote error={error} />
        {busy && <Loading />}

        {report && !busy && (
          <div className="space-y-3 border-t border-sand-border pt-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {report.committed ? (
                <Badge tone="green">{t('Imported', 'تم الاستيراد')}</Badge>
              ) : errorCount ? (
                <Badge tone="red">
                  {errorCount} {t('rows need fixing', 'صفوف تحتاج تصحيحاً')}
                </Badge>
              ) : (
                <Badge tone="green">{t('All rows are valid', 'كل الصفوف صالحة')}</Badge>
              )}
              <span className="text-ink-text-secondary">
                {report.created} {t('new', 'جديد')} · {report.updated} {t('updated', 'محدّث')} · {report.total} {t('total', 'الإجمالي')}
              </span>
              {errorCount > 0 && (
                <Button variant="ghost" onClick={downloadErrors}>
                  {t('Download rows with errors', 'تنزيل الصفوف ذات الأخطاء')}
                </Button>
              )}
            </div>
            <Table
              rowKey="row"
              columns={[
                { key: 'row', label: t('Row', 'الصف'), render: (r) => r.row + 1 },
                { key: 'key', label: kind.fields[0].key },
                { key: 'name', label: kind.fields[1].key },
                {
                  key: 'action',
                  label: t('Result', 'النتيجة'),
                  render: (r) => <Badge tone={ACTION_TONE[r.action] || 'gray'}>{actionLabel(r.action, t)}</Badge>,
                },
                {
                  key: 'errors',
                  label: t('Problems', 'المشكلات'),
                  render: (r) => (
                    <div className="space-y-0.5">
                      {(r.errors || []).map((e) => (
                        <div key={e} className="text-feedback-danger text-xs">{e}</div>
                      ))}
                      {(r.warnings || []).map((w) => (
                        <div key={w} className="text-brass-gold-500 text-xs">{w}</div>
                      ))}
                    </div>
                  ),
                },
              ]}
              rows={[...report.rows].sort((a, b) => (b.errors?.length || 0) - (a.errors?.length || 0)).slice(0, 500)}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function actionLabel(action, t) {
  return (
    {
      create: t('New', 'جديد'),
      update: t('Update', 'تحديث'),
      update_pending: t('Update (not registered yet)', 'تحديث (لم يسجّل بعد)'),
      upsert: t('Save', 'حفظ'),
      error: t('Error', 'خطأ'),
    }[action] || action
  );
}
