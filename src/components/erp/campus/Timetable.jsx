import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { AsyncView, Button, Card, Field, Input, Modal, Select, useAsync, useLang } from '../ui';
import { deleteRow, insertRow, query, updateRow } from '../../../lib/erp/rpc';
import { DAYS, DAYS_AR } from '../../../lib/erp/campusApi';
import { ClassSelect } from './common';
import { useAction, useEmployees } from './hooks';

const EMPTY = { day_of_week: 'Monday', start_time: '08:00', end_time: '08:45', subject_id: '', subject: '', tutor_id: '', room: '' };

export default function Timetable() {
  const { t, ar } = useLang();
  const auth = useAuth();
  const [busy, run] = useAction();
  const [cls, setCls] = useState('1');
  const [modal, setModal] = useState(null);
  const [subjects] = useAsync(() => query('subjects', (q) => q.select('id, code, name_en, name_ar').eq('is_active', true).order('code')), []);
  const [tutors] = useEmployees();
  const [state, reload] = useAsync(
    () => query('class_schedules', (q) =>
      q.select('*, subjects(code, name_en, name_ar), tutor:profiles!tutor_id(full_name)').eq('class_number', Number(cls)).order('start_time')),
    [cls]
  );
  // RLS: admins manage everything; tutors may add periods and edit their own.
  const canAdd = auth.isAdmin || auth.isTutor;
  const canEditRow = (r) => auth.isAdmin || r.tutor_id === auth.user?.id;

  const subjectName = (id) => {
    const s = (subjects.data || []).find((x) => x.id === id);
    return s ? s.name_en : '';
  };

  const save = async () => {
    const row = {
      class_number: Number(cls),
      day_of_week: modal.day_of_week,
      start_time: modal.start_time,
      end_time: modal.end_time,
      subject_id: modal.subject_id || null,
      subject: modal.subject.trim() || subjectName(modal.subject_id),
      tutor_id: modal.tutor_id || auth.user?.id,
      room: modal.room || null,
      academic_year: new Date().getFullYear(),
    };
    if (!row.subject) {
      window.alert(t('Choose a subject.', 'اختر مادة.'));
      return;
    }
    if (row.end_time <= row.start_time) {
      window.alert(t('End time must be after start time.', 'يجب أن يكون وقت النهاية بعد البداية.'));
      return;
    }
    const res = await run(() => (modal.id ? updateRow('class_schedules', modal.id, row) : insertRow('class_schedules', row)), t('Period saved', 'تم حفظ الحصة'));
    if (res.ok) {
      setModal(null);
      reload();
    }
  };
  const remove = async (r) => {
    if (!window.confirm(t('Delete this period?', 'حذف هذه الحصة؟'))) return;
    const res = await run(() => deleteRow('class_schedules', r.id), t('Period deleted', 'تم حذف الحصة'));
    if (res.ok) reload();
  };

  return (
    <Card
      title={t('Class timetable', 'الجدول الدراسي')}
      actions={
        <div className="flex gap-2 items-center">
          <div className="w-40"><ClassSelect value={cls} onChange={(v) => setCls(v || '1')} /></div>
          {canAdd && <Button onClick={() => setModal({ ...EMPTY, tutor_id: auth.isAdmin ? '' : auth.user?.id })}>{t('Add period', 'إضافة حصة')}</Button>}
        </div>
      }
    >
      <AsyncView state={state}>
        {(rows) => (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {DAYS.map((d) => {
              const items = rows.filter((r) => r.day_of_week === d);
              return (
                <div key={d} className="rounded-xl border border-gray-800 p-3 min-h-[120px]">
                  <div className="font-bold text-emerald-300 mb-2">{ar ? DAYS_AR[d] : d}</div>
                  {!items.length && <div className="text-xs text-gray-600">—</div>}
                  <ul className="space-y-2">
                    {items.map((r) => (
                      <li key={r.id} className="rounded-lg bg-gray-900/70 border border-gray-800 p-2 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-400">{String(r.start_time).slice(0, 5)}–{String(r.end_time).slice(0, 5)}</span>
                          {r.room && <span className="text-xs text-gray-500">{r.room}</span>}
                        </div>
                        <div className="text-white font-semibold">{(ar ? r.subjects?.name_ar : r.subjects?.name_en) || r.subject}</div>
                        <div className="text-xs text-gray-400">{r.tutor?.full_name || '—'}</div>
                        {canEditRow(r) && (
                          <div className="flex gap-2 mt-1">
                            <button type="button" className="text-xs text-emerald-400 hover:underline" onClick={() => setModal({
                              id: r.id, day_of_week: r.day_of_week, start_time: String(r.start_time).slice(0, 5), end_time: String(r.end_time).slice(0, 5),
                              subject_id: r.subject_id || '', subject: r.subject_id ? '' : r.subject, tutor_id: r.tutor_id, room: r.room || '',
                            })}>{t('Edit', 'تعديل')}</button>
                            {auth.isAdmin && <button type="button" className="text-xs text-red-400 hover:underline" disabled={busy} onClick={() => remove(r)}>{t('Delete', 'حذف')}</button>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </AsyncView>
      <Modal open={Boolean(modal)} title={modal?.id ? t('Edit period', 'تعديل الحصة') : `${t('New period · class', 'حصة جديدة · الصف')} ${cls}`} onClose={() => setModal(null)}
        footer={<><Button variant="ghost" onClick={() => setModal(null)}>{t('Cancel', 'إلغاء')}</Button><Button disabled={busy} onClick={save}>{t('Save', 'حفظ')}</Button></>}>
        {modal && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('Day', 'اليوم')}><Select value={modal.day_of_week} onChange={(e) => setModal({ ...modal, day_of_week: e.target.value })} options={DAYS.map((d) => ({ value: d, label: ar ? DAYS_AR[d] : d }))} /></Field>
            <Field label={t('Room', 'القاعة')}><Input value={modal.room} onChange={(e) => setModal({ ...modal, room: e.target.value })} /></Field>
            <Field label={t('Start', 'البداية')}><Input type="time" value={modal.start_time} onChange={(e) => setModal({ ...modal, start_time: e.target.value })} /></Field>
            <Field label={t('End', 'النهاية')}><Input type="time" value={modal.end_time} onChange={(e) => setModal({ ...modal, end_time: e.target.value })} /></Field>
            <Field label={t('Subject', 'المادة')}>
              <Select value={modal.subject_id} onChange={(e) => setModal({ ...modal, subject_id: e.target.value })} placeholder={t('Other (type below)', 'أخرى (اكتب أدناه)')}
                options={(subjects.data || []).map((s) => ({ value: s.id, label: `${s.code} · ${ar ? s.name_ar || s.name_en : s.name_en}` }))} />
            </Field>
            <Field label={t('Custom subject label', 'اسم مادة مخصص')}><Input value={modal.subject} onChange={(e) => setModal({ ...modal, subject: e.target.value })} disabled={Boolean(modal.subject_id)} /></Field>
            <div className="sm:col-span-2">
              <Field label={t('Teacher', 'المعلم')}>
                <Select value={modal.tutor_id || ''} disabled={!auth.isAdmin} onChange={(e) => setModal({ ...modal, tutor_id: e.target.value })} placeholder={t('Me', 'أنا')}
                  options={(tutors.data || []).map((p) => ({ value: p.id, label: p.full_name || p.email }))} />
              </Field>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
