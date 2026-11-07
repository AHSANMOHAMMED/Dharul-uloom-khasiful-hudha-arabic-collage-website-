import { useState } from 'react';
import { AsyncView, Button, Card, Field, Input, Modal, Select, StatusBadge, Table, useAsync, useLang } from '../ui';
import { deleteRow, formatDate, insertRow, query, updateRow } from '../../../lib/erp/rpc';
import { classOptions } from '../../../lib/erp/campusApi';
import { useAction } from './hooks';

const TYPES = ['term', 'midterm', 'final', 'monthly', 'quiz', 'hifz_test', 'oral', 'other'];
const FLOW = ['draft', 'scheduled', 'marking', 'published'];
const EMPTY = { name: '', exam_type: 'term', academic_year_id: '', term_id: '', class_number: '', start_date: '', end_date: '' };

function ExamPapers({ exam, canEdit }) {
  const { t, ar } = useLang();
  const [busy, run] = useAction();
  const [form, setForm] = useState({ subject_id: '', exam_date: '', max_marks: '100', pass_marks: '40' });
  const [subjects] = useAsync(() => query('subjects', (q) => q.select('id, code, name_en, name_ar').eq('is_active', true).order('code')), []);
  const [state, reload] = useAsync(
    () => query('exam_subjects', (q) => q.select('*, subjects(code, name_en, name_ar)').eq('exam_id', exam.id).order('exam_date')),
    [exam.id]
  );
  const add = async (e) => {
    e.preventDefault();
    const res = await run(() => insertRow('exam_subjects', {
      exam_id: exam.id, subject_id: form.subject_id, exam_date: form.exam_date || null,
      max_marks: Number(form.max_marks) || 100, pass_marks: Number(form.pass_marks) || 0,
    }), t('Paper added', 'تمت إضافة الورقة'));
    if (res.ok) {
      setForm({ ...form, subject_id: '' });
      reload();
    }
  };
  const addClassSubjects = async () => {
    if (!exam.class_number) return;
    const cs = await run(() => query('class_subjects', (q) => q.select('subject_id').eq('class_number', exam.class_number)));
    if (!cs.ok) return;
    const existing = new Set((state.data || []).map((r) => r.subject_id));
    const rows = [...new Set(cs.data.map((r) => r.subject_id))].filter((id) => !existing.has(id)).map((subject_id) => ({ exam_id: exam.id, subject_id }));
    if (!rows.length) return;
    const res = await run(() => query('exam_subjects', (q) => q.insert(rows).select('id')), (r) => `${r?.length ?? rows.length} ${t('papers added', 'ورقة أضيفت')}`);
    if (res.ok) reload();
  };
  const remove = async (r) => {
    if (!window.confirm(t('Remove this paper? Marks already entered stay on the student record.', 'إزالة هذه الورقة؟'))) return;
    const res = await run(() => deleteRow('exam_subjects', r.id), t('Removed', 'تمت الإزالة'));
    if (res.ok) reload();
  };
  const editable = canEdit && exam.status !== 'published';
  return (
    <Card title={`${t('Papers of', 'أوراق')} ${exam.name}`} actions={editable && exam.class_number && (
      <Button size="sm" variant="secondary" disabled={busy} onClick={addClassSubjects}>{t('Add all class subjects', 'إضافة كل مواد الصف')}</Button>
    )}>
      {editable && (
        <form onSubmit={add} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end mb-4">
          <Field label={t('Subject', 'المادة')}>
            <Select required value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} placeholder={t('Select…', 'اختر…')}
              options={(subjects.data || []).map((s) => ({ value: s.id, label: `${s.code} · ${ar ? s.name_ar || s.name_en : s.name_en}` }))} />
          </Field>
          <Field label={t('Date', 'التاريخ')}><Input type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} /></Field>
          <Field label={t('Max marks', 'الدرجة العظمى')}><Input type="number" min="1" value={form.max_marks} onChange={(e) => setForm({ ...form, max_marks: e.target.value })} /></Field>
          <Field label={t('Pass marks', 'درجة النجاح')}><Input type="number" min="0" value={form.pass_marks} onChange={(e) => setForm({ ...form, pass_marks: e.target.value })} /></Field>
          <Button type="submit" disabled={busy}>{t('Add paper', 'إضافة ورقة')}</Button>
        </form>
      )}
      <AsyncView state={state}>
        {(rows) => (
          <Table rows={rows} empty={t('No papers yet.', 'لا توجد أوراق.')} columns={[
            { key: 'subject', label: t('Subject', 'المادة'), render: (r) => `${r.subjects?.code} · ${ar ? r.subjects?.name_ar || r.subjects?.name_en : r.subjects?.name_en}` },
            { key: 'exam_date', label: t('Date', 'التاريخ'), render: (r) => formatDate(r.exam_date) },
            { key: 'max_marks', label: t('Max', 'العظمى') },
            { key: 'pass_marks', label: t('Pass', 'النجاح') },
            { key: 'act', label: '', render: (r) => editable && <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove(r)}>{t('Remove', 'إزالة')}</Button> },
          ]} />
        )}
      </AsyncView>
    </Card>
  );
}

export default function Exams({ canEdit }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [yearFilter, setYearFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [years] = useAsync(() => query('academic_years', (q) => q.select('id, name').order('start_date', { ascending: false })), []);
  const [terms] = useAsync(() => query('terms', (q) => q.select('id, name, academic_year_id').order('sequence')), []);
  const [state, reload] = useAsync(
    () => query('exams', (q) => {
      let b = q.select('*, academic_years(name), terms(name)');
      if (yearFilter) b = b.eq('academic_year_id', yearFilter);
      return b.order('start_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
    }),
    [yearFilter]
  );

  const save = async () => {
    const row = {
      name: modal.name.trim(), exam_type: modal.exam_type,
      academic_year_id: modal.academic_year_id || null, term_id: modal.term_id || null,
      class_number: modal.class_number ? Number(modal.class_number) : null,
      start_date: modal.start_date || null, end_date: modal.end_date || null,
    };
    const res = await run(() => (modal.id ? updateRow('exams', modal.id, row) : insertRow('exams', row)), t('Exam saved', 'تم حفظ الامتحان'));
    if (res.ok) {
      setModal(null);
      reload();
    }
  };
  const move = async (exam, status) => {
    const msg = status === 'published'
      ? t('Publish results? Students and parents will be able to see them.', 'نشر النتائج؟ سيتمكن الطلاب وأولياء الأمور من رؤيتها.')
      : t(`Change status to "${status}"?`, `تغيير الحالة إلى "${status}"؟`);
    if (!window.confirm(msg)) return;
    const patch = { status, published_at: status === 'published' ? new Date().toISOString() : null };
    const res = await run(() => updateRow('exams', exam.id, patch), t('Status updated', 'تم تحديث الحالة'));
    if (res.ok) {
      if (selected?.id === exam.id) setSelected(res.data);
      reload();
    }
  };
  const remove = async (exam) => {
    if (!window.confirm(t(`Delete exam ${exam.name}? All its marks will be deleted.`, `حذف الامتحان ${exam.name}؟ ستحذف كل درجاته.`))) return;
    const res = await run(() => deleteRow('exams', exam.id), t('Exam deleted', 'تم حذف الامتحان'));
    if (res.ok) {
      if (selected?.id === exam.id) setSelected(null);
      reload();
    }
  };
  const termOpts = (terms.data || []).filter((x) => !modal?.academic_year_id || x.academic_year_id === modal.academic_year_id).map((x) => ({ value: x.id, label: x.name }));

  return (
    <div className="space-y-6">
      <Card title={t('Exams', 'الامتحانات')} actions={
        <div className="flex gap-2 items-center">
          <div className="w-48"><Select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} placeholder={t('All years', 'كل الأعوام')} options={(years.data || []).map((y) => ({ value: y.id, label: y.name }))} /></div>
          {canEdit && <Button onClick={() => setModal({ ...EMPTY })}>{t('New exam', 'امتحان جديد')}</Button>}
        </div>
      }>
        <AsyncView state={state}>
          {(rows) => (
            <Table rows={rows} empty={t('No exams yet.', 'لا توجد امتحانات.')} columns={[
              { key: 'name', label: t('Exam', 'الامتحان'), render: (r) => <button type="button" className="text-emerald-300 hover:underline text-start" onClick={() => setSelected(r)}>{r.name}</button> },
              { key: 'exam_type', label: t('Type', 'النوع') },
              { key: 'class_number', label: t('Class', 'الصف'), render: (r) => r.class_number ?? t('All', 'الكل') },
              { key: 'year', label: t('Year / term', 'العام / الفصل'), render: (r) => [r.academic_years?.name, r.terms?.name].filter(Boolean).join(' · ') || '—' },
              { key: 'dates', label: t('Dates', 'التواريخ'), render: (r) => `${formatDate(r.start_date)} → ${formatDate(r.end_date)}` },
              { key: 'status', label: t('Status', 'الحالة'), render: (r) => <StatusBadge status={r.status} /> },
              { key: 'act', label: '', render: (r) => {
                const i = FLOW.indexOf(r.status);
                return (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>{t('Papers', 'الأوراق')}</Button>
                    {canEdit && i < FLOW.length - 1 && <Button size="sm" variant="secondary" disabled={busy} onClick={() => move(r, FLOW[i + 1])}>→ {FLOW[i + 1]}</Button>}
                    {canEdit && r.status === 'published' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => move(r, 'marking')}>{t('Unpublish', 'إلغاء النشر')}</Button>}
                    {canEdit && r.status !== 'published' && <Button size="sm" variant="ghost" onClick={() => setModal({
                      id: r.id, name: r.name, exam_type: r.exam_type, academic_year_id: r.academic_year_id || '', term_id: r.term_id || '',
                      class_number: r.class_number ? String(r.class_number) : '', start_date: r.start_date || '', end_date: r.end_date || '',
                    })}>{t('Edit', 'تعديل')}</Button>}
                    {canEdit && r.status === 'draft' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove(r)}>{t('Delete', 'حذف')}</Button>}
                  </div>
                );
              } },
            ]} />
          )}
        </AsyncView>
      </Card>
      {selected && <ExamPapers key={selected.id} exam={selected} canEdit={canEdit} />}
      <Modal open={Boolean(modal)} title={modal?.id ? t('Edit exam', 'تعديل الامتحان') : t('New exam', 'امتحان جديد')} onClose={() => setModal(null)}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>{t('Cancel', 'إلغاء')}</Button><Button disabled={busy || !modal?.name} onClick={save}>{t('Save', 'حفظ')}</Button></>}>
        {modal && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Field label={t('Name', 'الاسم')}><Input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} /></Field></div>
            <Field label={t('Type', 'النوع')}><Select value={modal.exam_type} onChange={(e) => setModal({ ...modal, exam_type: e.target.value })} options={TYPES.map((x) => ({ value: x, label: x }))} /></Field>
            <Field label={t('Class', 'الصف')}><Select value={modal.class_number} onChange={(e) => setModal({ ...modal, class_number: e.target.value })} placeholder={t('All classes', 'كل الصفوف')} options={classOptions(t)} /></Field>
            <Field label={t('Academic year', 'العام الدراسي')}><Select value={modal.academic_year_id} onChange={(e) => setModal({ ...modal, academic_year_id: e.target.value, term_id: '' })} placeholder="—" options={(years.data || []).map((y) => ({ value: y.id, label: y.name }))} /></Field>
            <Field label={t('Term', 'الفصل')}><Select value={modal.term_id} onChange={(e) => setModal({ ...modal, term_id: e.target.value })} placeholder="—" options={termOpts} /></Field>
            <Field label={t('Start', 'البداية')}><Input type="date" value={modal.start_date} onChange={(e) => setModal({ ...modal, start_date: e.target.value })} /></Field>
            <Field label={t('End', 'النهاية')}><Input type="date" value={modal.end_date} onChange={(e) => setModal({ ...modal, end_date: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
