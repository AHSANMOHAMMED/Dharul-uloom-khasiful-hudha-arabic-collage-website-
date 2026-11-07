import { useEffect, useMemo, useState } from 'react';
import { AsyncView, Badge, Button, Card, Field, Input, Select, Table, useAsync, useLang } from '../ui';
import { query } from '../../../lib/erp/rpc';
import { ClassSelect } from './common';
import { useAction } from './hooks';

/**
 * Marks grid for one exam paper. Grades are computed by the DB trigger
 * (tg_student_results_prepare) — the grade column is never sent.
 *
 * Note: the unique index on (exam_id, subject_id, student_id) is partial, so
 * PostgREST cannot use it as an ON CONFLICT target. Existing rows are
 * upserted by primary key and new rows are inserted.
 */
export default function MarksEntry() {
  const { t, ar } = useLang();
  const [busy, run] = useAction();
  const [examId, setExamId] = useState('');
  const [paperId, setPaperId] = useState('');
  const [cls, setCls] = useState('');
  const [grid, setGrid] = useState({});

  const [exams] = useAsync(() => query('exams', (q) => q.select('id, name, class_number, status').neq('status', 'draft').order('created_at', { ascending: false })), []);
  const exam = (exams.data || []).find((e) => e.id === examId);
  const [papers] = useAsync(
    () => (examId ? query('exam_subjects', (q) => q.select('*, subjects(code, name_en, name_ar)').eq('exam_id', examId)) : Promise.resolve([])),
    [examId]
  );
  const paper = (papers.data || []).find((p) => p.id === paperId);
  const classNo = exam?.class_number ? String(exam.class_number) : cls;

  const [sheet, reloadSheet] = useAsync(async () => {
    if (!paper || !classNo) return { students: [], results: [] };
    const [students, results] = await Promise.all([
      query('profiles', (q) => q.select('id, full_name, index_number').eq('account_type', 'student').eq('is_approved', true).eq('class_number', Number(classNo)).order('full_name')),
      query('student_results', (q) => q.select('id, student_id, marks_obtained, max_marks, grade, remarks').eq('exam_id', examId).eq('subject_id', paper.subject_id)),
    ]);
    return { students, results };
  }, [paper?.id, classNo]);

  const resultsBy = useMemo(() => Object.fromEntries((sheet.data?.results || []).map((r) => [r.student_id, r])), [sheet.data]);

  useEffect(() => {
    const g = {};
    (sheet.data?.students || []).forEach((s) => {
      const r = resultsBy[s.id];
      g[s.id] = { marks: r ? String(r.marks_obtained) : '', remarks: r?.remarks || '' };
    });
    setGrid(g);
  }, [sheet.data, resultsBy]);

  const max = Number(paper?.max_marks || 100);
  const invalid = Object.values(grid).some((v) => v.marks !== '' && (Number.isNaN(Number(v.marks)) || Number(v.marks) < 0 || Number(v.marks) > max));

  const save = async () => {
    if (invalid) {
      window.alert(t(`Marks must be between 0 and ${max}.`, `يجب أن تكون الدرجات بين 0 و ${max}.`));
      return;
    }
    const entries = Object.entries(grid).filter(([, v]) => v.marks !== '');
    const base = (studentId, v) => ({
      student_id: studentId, exam_id: examId, subject_id: paper.subject_id,
      marks_obtained: Number(v.marks), max_marks: max, remarks: v.remarks || null,
    });
    const updates = entries.filter(([sid]) => resultsBy[sid]).map(([sid, v]) => ({ id: resultsBy[sid].id, ...base(sid, v) }));
    const inserts = entries.filter(([sid]) => !resultsBy[sid]).map(([sid, v]) => base(sid, v));
    if (!updates.length && !inserts.length) return;
    const res = await run(async () => {
      if (updates.length) await query('student_results', (q) => q.upsert(updates, { onConflict: 'id' }).select('id'));
      if (inserts.length) await query('student_results', (q) => q.insert(inserts).select('id'));
      return updates.length + inserts.length;
    }, (n) => `${n} ${t('marks saved', 'درجة محفوظة')}`);
    if (res.ok) reloadSheet();
  };

  const stats = useMemo(() => {
    const vals = Object.values(grid).filter((v) => v.marks !== '').map((v) => Number(v.marks));
    if (!vals.length) return null;
    const pass = vals.filter((v) => v >= Number(paper?.pass_marks || 0)).length;
    return { n: vals.length, avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1), high: Math.max(...vals), pass };
  }, [grid, paper]);

  return (
    <Card title={t('Marks entry', 'إدخال الدرجات')}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <Field label={t('Exam', 'الامتحان')}>
          <Select value={examId} onChange={(e) => { setExamId(e.target.value); setPaperId(''); }} placeholder={t('Select exam…', 'اختر الامتحان…')}
            options={(exams.data || []).map((e) => ({ value: e.id, label: `${e.name}${e.class_number ? ` · C${e.class_number}` : ''} (${e.status})` }))} />
        </Field>
        <Field label={t('Paper', 'الورقة')}>
          <Select value={paperId} onChange={(e) => setPaperId(e.target.value)} placeholder={t('Select paper…', 'اختر الورقة…')}
            options={(papers.data || []).map((p) => ({ value: p.id, label: `${p.subjects?.code} · ${ar ? p.subjects?.name_ar || p.subjects?.name_en : p.subjects?.name_en}` }))} />
        </Field>
        <Field label={t('Class', 'الصف')}>
          {exam?.class_number ? <Input value={`${t('Class', 'الصف')} ${exam.class_number}`} disabled /> : <ClassSelect value={cls} onChange={setCls} allLabel={t('Select class…', 'اختر الصف…')} />}
        </Field>
        <div className="flex items-end">
          <Button className="w-full" disabled={busy || !paper || !classNo || invalid} onClick={save}>{t('Save marks', 'حفظ الدرجات')}</Button>
        </div>
      </div>
      {exam?.status === 'published' && (
        <p className="text-sm text-amber-300 mb-3">{t('This exam is published — only the exam officer / principal can change marks.', 'هذا الامتحان منشور — يمكن لمسؤول الامتحانات أو المدير فقط تعديل الدرجات.')}</p>
      )}
      {paper && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-400 mb-3">
          <span>{t('Max', 'العظمى')}: <b className="text-white">{max}</b></span>
          <span>{t('Pass', 'النجاح')}: <b className="text-white">{paper.pass_marks}</b></span>
          {stats && <>
            <span>{t('Entered', 'المدخل')}: <b className="text-white">{stats.n}</b></span>
            <span>{t('Average', 'المتوسط')}: <b className="text-white">{stats.avg}</b></span>
            <span>{t('Highest', 'الأعلى')}: <b className="text-white">{stats.high}</b></span>
            <span>{t('Passed', 'الناجحون')}: <b className="text-white">{stats.pass}</b></span>
          </>}
        </div>
      )}
      {!paper || !classNo ? (
        <p className="text-sm text-gray-500 py-6 text-center">{t('Choose an exam, a paper and a class to enter marks.', 'اختر الامتحان والورقة والصف لإدخال الدرجات.')}</p>
      ) : (
        <AsyncView state={sheet}>
          {(d) => (
            <Table rows={d.students} empty={t('No students in this class.', 'لا يوجد طلاب في هذا الصف.')} columns={[
              { key: 'full_name', label: t('Student', 'الطالب') },
              { key: 'index_number', label: t('Index', 'الرقم') },
              { key: 'marks', label: `${t('Marks', 'الدرجة')} / ${max}`, render: (s) => {
                const v = grid[s.id]?.marks ?? '';
                const bad = v !== '' && (Number(v) < 0 || Number(v) > max || Number.isNaN(Number(v)));
                return (
                  <div className={`w-28 ${bad ? 'ring-2 ring-red-500 rounded-xl' : ''}`}>
                    <Input type="number" min="0" max={max} step="0.5" value={v} onChange={(e) => setGrid((g) => ({ ...g, [s.id]: { ...g[s.id], marks: e.target.value } }))} />
                  </div>
                );
              } },
              { key: 'grade', label: t('Grade', 'التقدير'), render: (s) => (resultsBy[s.id]?.grade ? <Badge tone={resultsBy[s.id].grade === 'F' ? 'red' : 'green'}>{resultsBy[s.id].grade}</Badge> : <span className="text-gray-600">—</span>) },
              { key: 'remarks', label: t('Remarks', 'ملاحظات'), render: (s) => (
                <div className="min-w-[180px]"><Input value={grid[s.id]?.remarks ?? ''} onChange={(e) => setGrid((g) => ({ ...g, [s.id]: { ...g[s.id], remarks: e.target.value } }))} /></div>
              ) },
            ]} />
          )}
        </AsyncView>
      )}
    </Card>
  );
}
