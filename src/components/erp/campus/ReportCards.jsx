import { useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';
import { AsyncView, Button, Card, Field, Select, Table, useAsync, useLang } from '../ui';
import { query, rpc } from '../../../lib/erp/rpc';
import { errMsg, escapeHtml, fetchMyOrg, openPrintWindow, printHeader } from '../../../lib/erp/campusApi';
import { ClassSelect } from './common';

function cardHtml(rc) {
  const subjects = (rc.subjects || [])
    .map((s) => `<tr><td>${escapeHtml(s.subject)}</td><td class="num">${escapeHtml(s.marks)}</td><td class="num">${escapeHtml(s.max)}</td>
<td class="num">${escapeHtml(s.max ? ((Number(s.marks) * 100) / Number(s.max)).toFixed(1) : '—')}%</td><td>${escapeHtml(s.grade)}</td><td>${escapeHtml(s.remarks || '')}</td></tr>`)
    .join('');
  return `<h1>Report Card · بطاقة النتائج</h1>
<div class="meta">
  <div><div class="k">Student · الطالب</div><div class="v">${escapeHtml(rc.student?.full_name)}</div></div>
  <div><div class="k">Index · الرقم</div><div class="v">${escapeHtml(rc.student?.index_number || '—')}</div></div>
  <div><div class="k">Class · الصف</div><div class="v">${escapeHtml(rc.student?.class_number ?? '—')}</div></div>
  <div><div class="k">Exam · الامتحان</div><div class="v">${escapeHtml(rc.exam?.name)} (${escapeHtml(rc.exam?.type)})</div></div>
</div>
<table><thead><tr><th>Subject · المادة</th><th class="num">Marks</th><th class="num">Max</th><th class="num">%</th><th>Grade</th><th>Remarks</th></tr></thead>
<tbody>${subjects || '<tr><td colspan="6">No marks recorded</td></tr>'}
<tr class="total"><td>Total · المجموع</td><td class="num">${escapeHtml(rc.total)}</td><td class="num">${escapeHtml(rc.max_total)}</td><td class="num">${escapeHtml(rc.percentage ?? '—')}%</td><td>${escapeHtml(rc.overall_grade || '—')}</td><td></td></tr>
</tbody></table>
<div class="meta">
  <div><div class="k">Class rank · الترتيب</div><div class="v">${escapeHtml(rc.rank ?? '—')} / ${escapeHtml(rc.class_size ?? '—')}</div></div>
  <div><div class="k">Status</div><div class="v">${escapeHtml(rc.exam?.status)}</div></div>
</div>
<div class="foot"><div class="sig"><div class="line"></div>Class teacher · المعلم</div><div class="sig"><div class="line"></div>Principal · المدير</div><div class="sig"><div class="line"></div>Parent · ولي الأمر</div></div>`;
}

export default function ReportCards() {
  const { t } = useLang();
  const { user } = useAuth();
  const [examId, setExamId] = useState('');
  const [cls, setCls] = useState('');
  const [busy, setBusy] = useState(false);
  const [exams] = useAsync(() => query('exams', (q) => q.select('id, name, class_number, status').order('created_at', { ascending: false })), []);
  const exam = (exams.data || []).find((e) => e.id === examId);
  const classNo = exam?.class_number ? String(exam.class_number) : cls;
  const [students] = useAsync(
    () => (classNo ? query('profiles', (q) => q.select('id, full_name, index_number').eq('account_type', 'student').eq('class_number', Number(classNo)).order('full_name')) : Promise.resolve([])),
    [classNo]
  );

  const print = async (list) => {
    if (!examId || !list.length) return;
    setBusy(true);
    try {
      const [org, ...cards] = await Promise.all([
        fetchMyOrg(user?.orgId).catch(() => null),
        ...list.map((s) => rpc('student_report_card', { p_student: s.id, p_exam: examId })),
      ]);
      const body = cards
        .map((rc, i) => `<section style="${i ? 'page-break-before:always;' : ''}">${printHeader(org)}${cardHtml(rc)}</section>`)
        .join('');
      openPrintWindow(`Report cards — ${exam?.name || ''}`, body);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t('Report cards', 'بطاقات النتائج')}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 items-end">
        <Field label={t('Exam', 'الامتحان')}>
          <Select value={examId} onChange={(e) => setExamId(e.target.value)} placeholder={t('Select exam…', 'اختر الامتحان…')}
            options={(exams.data || []).map((e) => ({ value: e.id, label: `${e.name}${e.class_number ? ` · C${e.class_number}` : ''} (${e.status})` }))} />
        </Field>
        <Field label={t('Class', 'الصف')}>
          {exam?.class_number ? <div className="text-gray-200 py-2">{t('Class', 'الصف')} {exam.class_number}</div> : <ClassSelect value={cls} onChange={setCls} allLabel={t('Select class…', 'اختر الصف…')} />}
        </Field>
        <Button disabled={busy || !examId || !students.data?.length} onClick={() => print(students.data || [])}>{t('Print all for class', 'طباعة الكل للصف')}</Button>
      </div>
      {!examId || !classNo ? (
        <p className="text-sm text-gray-500 py-6 text-center">{t('Choose an exam and class.', 'اختر الامتحان والصف.')}</p>
      ) : (
        <AsyncView state={students}>
          {(rows) => (
            <Table rows={rows} empty={t('No students in this class.', 'لا يوجد طلاب.')} columns={[
              { key: 'full_name', label: t('Student', 'الطالب') },
              { key: 'index_number', label: t('Index', 'الرقم') },
              { key: 'act', label: '', render: (s) => <Button size="sm" variant="secondary" disabled={busy} onClick={() => print([s])}>{t('Print', 'طباعة')}</Button> },
            ]} />
          )}
        </AsyncView>
      )}
    </Card>
  );
}
