import { useState } from 'react';
import { AsyncView, Badge, Button, Card, Field, Input, Modal, Select, Table, useAsync, useLang } from '../ui';
import { deleteRow, insertRow, query, updateRow } from '../../../lib/erp/rpc';
import { ClassSelect } from './common';
import { useAction, useEmployees } from './hooks';

const CATEGORIES = ['quran', 'arabic', 'hadith', 'fiqh', 'aqeedah', 'tafseer', 'seerah', 'tajweed', 'general', 'language', 'science', 'other'];
const SUBJECT_EMPTY = { code: '', name_en: '', name_ar: '', category: 'general', credit_hours: '1', is_active: true };

export function SubjectsTab({ canEdit }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [modal, setModal] = useState(null);
  const [state, reload] = useAsync(() => query('subjects', (q) => q.select('*').order('code')), []);
  const save = async () => {
    const row = {
      code: modal.code.trim().toUpperCase(), name_en: modal.name_en.trim(), name_ar: modal.name_ar.trim() || null,
      category: modal.category, credit_hours: Number(modal.credit_hours) || 1, is_active: Boolean(modal.is_active),
    };
    const res = await run(() => (modal.id ? updateRow('subjects', modal.id, row) : insertRow('subjects', row)), t('Subject saved', 'تم حفظ المادة'));
    if (res.ok) {
      setModal(null);
      reload();
    }
  };
  const remove = async (r) => {
    if (!window.confirm(t(`Delete subject ${r.code}? Class assignments and exam papers for it are removed too.`, `حذف المادة ${r.code}؟ ستحذف إسناداتها وأوراق امتحاناتها.`))) return;
    const res = await run(() => deleteRow('subjects', r.id), t('Deleted', 'تم الحذف'));
    if (res.ok) reload();
  };
  return (
    <Card title={t('Subjects', 'المواد')} actions={canEdit && <Button onClick={() => setModal({ ...SUBJECT_EMPTY })}>{t('New subject', 'مادة جديدة')}</Button>}>
      <AsyncView state={state}>
        {(rows) => (
          <Table rows={rows} empty={t('No subjects yet.', 'لا توجد مواد.')} columns={[
            { key: 'code', label: t('Code', 'الرمز') },
            { key: 'name', label: t('Name', 'الاسم'), render: (r) => t(r.name_en, r.name_ar) },
            { key: 'name_ar', label: t('Arabic name', 'الاسم بالعربية') },
            { key: 'category', label: t('Category', 'الفئة') },
            { key: 'credit_hours', label: t('Credits', 'الساعات') },
            { key: 'is_active', label: t('Active', 'نشطة'), render: (r) => (r.is_active ? <Badge tone="green"><span className="material-symbols-outlined text-[13px]">check</span></Badge> : <Badge>—</Badge>) },
            { key: 'act', label: '', render: (r) => canEdit && (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setModal({ ...r, name_ar: r.name_ar || '', credit_hours: String(r.credit_hours) })}>{t('Edit', 'تعديل')}</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove(r)}>{t('Delete', 'حذف')}</Button>
              </div>
            ) },
          ]} />
        )}
      </AsyncView>
      <Modal open={Boolean(modal)} title={modal?.id ? t('Edit subject', 'تعديل المادة') : t('New subject', 'مادة جديدة')} onClose={() => setModal(null)}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>{t('Cancel', 'إلغاء')}</Button><Button disabled={busy || !modal?.code || !modal?.name_en} onClick={save}>{t('Save', 'حفظ')}</Button></>}>
        {modal && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('Code', 'الرمز')}><Input value={modal.code} onChange={(e) => setModal({ ...modal, code: e.target.value })} placeholder="FIQ1" /></Field>
            <Field label={t('Category', 'الفئة')}><Select value={modal.category} onChange={(e) => setModal({ ...modal, category: e.target.value })} options={CATEGORIES.map((c) => ({ value: c, label: c }))} /></Field>
            <Field label={t('Name (English)', 'الاسم (إنجليزي)')}><Input value={modal.name_en} onChange={(e) => setModal({ ...modal, name_en: e.target.value })} /></Field>
            <Field label={t('Name (Arabic)', 'الاسم (عربي)')}><Input dir="rtl" value={modal.name_ar} onChange={(e) => setModal({ ...modal, name_ar: e.target.value })} /></Field>
            <Field label={t('Credit hours', 'الساعات المعتمدة')}><Input type="number" step="0.5" min="0" value={modal.credit_hours} onChange={(e) => setModal({ ...modal, credit_hours: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm text-gray-300 mt-6">
              <input type="checkbox" className="accent-emerald-600 h-4 w-4" checked={Boolean(modal.is_active)} onChange={(e) => setModal({ ...modal, is_active: e.target.checked })} />
              {t('Active', 'نشطة')}
            </label>
          </div>
        )}
      </Modal>
    </Card>
  );
}

export function ClassSubjectsTab({ canEdit }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [cls, setCls] = useState('1');
  const [form, setForm] = useState({ subject_id: '', tutor_id: '', academic_year_id: '', weekly_periods: '1' });
  const [subjects] = useAsync(() => query('subjects', (q) => q.select('id, code, name_en, name_ar').eq('is_active', true).order('code')), []);
  const [years] = useAsync(() => query('academic_years', (q) => q.select('id, name, is_current').order('start_date', { ascending: false })), []);
  const [tutors] = useEmployees();
  const [state, reload] = useAsync(
    () => query('class_subjects', (q) =>
      q.select('*, subjects(code, name_en, name_ar), tutor:profiles!tutor_id(full_name), academic_years(name)').eq('class_number', Number(cls)).order('created_at')),
    [cls]
  );
  const add = async (e) => {
    e.preventDefault();
    const res = await run(() => insertRow('class_subjects', {
      class_number: Number(cls), subject_id: form.subject_id, tutor_id: form.tutor_id || null,
      academic_year_id: form.academic_year_id || null, weekly_periods: Number(form.weekly_periods) || 1,
    }), t('Subject assigned', 'تم إسناد المادة'));
    if (res.ok) {
      setForm({ ...form, subject_id: '' });
      reload();
    }
  };
  const changeTutor = async (r, tutorId) => {
    const res = await run(() => updateRow('class_subjects', r.id, { tutor_id: tutorId || null }), t('Teacher updated', 'تم تحديث المعلم'));
    if (res.ok) reload();
  };
  const remove = async (r) => {
    if (!window.confirm(t('Remove this subject from the class?', 'إزالة هذه المادة من الصف؟'))) return;
    const res = await run(() => deleteRow('class_subjects', r.id), t('Removed', 'تمت الإزالة'));
    if (res.ok) reload();
  };
  const tutorOpts = (tutors.data || []).map((p) => ({ value: p.id, label: `${p.full_name || p.email} (${p.account_type})` }));
  return (
    <Card title={t('Class subjects & teachers', 'مواد الصفوف والمعلمون')} actions={<div className="w-40"><ClassSelect value={cls} onChange={(v) => setCls(v || '1')} /></div>}>
      {canEdit && (
        <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end mb-4">
          <Field label={t('Subject', 'المادة')}>
            <Select required value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} placeholder={t('Select…', 'اختر…')}
              options={(subjects.data || []).map((s) => ({ value: s.id, label: `${s.code} · ${t(s.name_en, s.name_ar)}` }))} />
          </Field>
          <Field label={t('Teacher', 'المعلم')}><Select value={form.tutor_id} onChange={(e) => setForm({ ...form, tutor_id: e.target.value })} placeholder="—" options={tutorOpts} /></Field>
          <Field label={t('Academic year', 'العام الدراسي')}>
            <Select value={form.academic_year_id} onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })} placeholder={t('Every year', 'كل الأعوام')}
              options={(years.data || []).map((y) => ({ value: y.id, label: y.name }))} />
          </Field>
          <Field label={t('Periods / week', 'حصص أسبوعية')}><Input type="number" min="0" max="40" value={form.weekly_periods} onChange={(e) => setForm({ ...form, weekly_periods: e.target.value })} /></Field>
          <Button type="submit" disabled={busy}>{t('Assign', 'إسناد')}</Button>
        </form>
      )}
      <AsyncView state={state}>
        {(rows) => (
          <Table rows={rows} empty={t('No subjects assigned to this class.', 'لا توجد مواد لهذا الصف.')} columns={[
            { key: 'subject', label: t('Subject', 'المادة'), render: (r) => `${r.subjects?.code} · ${t(r.subjects?.name_en, r.subjects?.name_ar)}` },
            { key: 'tutor', label: t('Teacher', 'المعلم'), render: (r) => canEdit ? (
              <div className="min-w-[200px]"><Select value={r.tutor_id || ''} onChange={(e) => changeTutor(r, e.target.value)} placeholder="—" options={tutorOpts} /></div>
            ) : r.tutor?.full_name || '—' },
            { key: 'year', label: t('Year', 'العام'), render: (r) => r.academic_years?.name || t('All', 'الكل') },
            { key: 'weekly_periods', label: t('Periods', 'الحصص') },
            { key: 'act', label: '', render: (r) => canEdit && <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove(r)}>{t('Remove', 'إزالة')}</Button> },
          ]} />
        )}
      </AsyncView>
    </Card>
  );
}

export function GradeScalesTab({ canEdit }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [modal, setModal] = useState(null);
  const [state, reload] = useAsync(() => query('grade_scales', (q) => q.select('*').order('min_percent', { ascending: false })), []);
  const save = async () => {
    const row = {
      grade: modal.grade.trim(), min_percent: Number(modal.min_percent), max_percent: Number(modal.max_percent),
      grade_point: modal.grade_point === '' ? null : Number(modal.grade_point), remark: modal.remark || null,
    };
    const res = await run(() => (modal.id ? updateRow('grade_scales', modal.id, row) : insertRow('grade_scales', row)), t('Grade saved', 'تم حفظ التقدير'));
    if (res.ok) {
      setModal(null);
      reload();
    }
  };
  const remove = async (r) => {
    if (!window.confirm(t(`Delete grade ${r.grade}?`, `حذف التقدير ${r.grade}؟`))) return;
    const res = await run(() => deleteRow('grade_scales', r.id), t('Deleted', 'تم الحذف'));
    if (res.ok) reload();
  };
  return (
    <Card title={t('Grading scale', 'سلم التقديرات')} actions={canEdit && <Button onClick={() => setModal({ grade: '', min_percent: '', max_percent: '', grade_point: '', remark: '' })}>{t('New grade', 'تقدير جديد')}</Button>}>
      <p className="text-xs text-gray-500 mb-3">{t('Grades on results are computed automatically by the database from this scale.', 'تحسب التقديرات تلقائيًا من هذا السلم.')}</p>
      <AsyncView state={state}>
        {(rows) => (
          <Table rows={rows} empty={t('No grade bands (default scale applies).', 'لا توجد شرائح (يطبق السلم الافتراضي).')} columns={[
            { key: 'grade', label: t('Grade', 'التقدير'), render: (r) => <b>{r.grade}</b> },
            { key: 'range', label: t('Range %', 'النطاق %'), render: (r) => `${r.min_percent} – ${r.max_percent}` },
            { key: 'grade_point', label: t('Grade point', 'النقاط') },
            { key: 'remark', label: t('Remark', 'ملاحظة') },
            { key: 'act', label: '', render: (r) => canEdit && (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setModal({ ...r, grade_point: r.grade_point ?? '', remark: r.remark || '' })}>{t('Edit', 'تعديل')}</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove(r)}>{t('Delete', 'حذف')}</Button>
              </div>
            ) },
          ]} />
        )}
      </AsyncView>
      <Modal open={Boolean(modal)} title={t('Grade band', 'شريحة التقدير')} onClose={() => setModal(null)}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>{t('Cancel', 'إلغاء')}</Button><Button disabled={busy || !modal?.grade || modal?.min_percent === '' || modal?.max_percent === ''} onClick={save}>{t('Save', 'حفظ')}</Button></>}>
        {modal && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('Grade', 'التقدير')}><Input value={modal.grade} onChange={(e) => setModal({ ...modal, grade: e.target.value })} /></Field>
            <Field label={t('Grade point', 'النقاط')}><Input type="number" step="0.01" value={modal.grade_point} onChange={(e) => setModal({ ...modal, grade_point: e.target.value })} /></Field>
            <Field label={t('Min %', 'الحد الأدنى %')}><Input type="number" step="0.01" min="0" max="100" value={modal.min_percent} onChange={(e) => setModal({ ...modal, min_percent: e.target.value })} /></Field>
            <Field label={t('Max %', 'الحد الأعلى %')}><Input type="number" step="0.01" min="0" max="100" value={modal.max_percent} onChange={(e) => setModal({ ...modal, max_percent: e.target.value })} /></Field>
            <div className="col-span-2"><Field label={t('Remark', 'ملاحظة')}><Input value={modal.remark} onChange={(e) => setModal({ ...modal, remark: e.target.value })} /></Field></div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
