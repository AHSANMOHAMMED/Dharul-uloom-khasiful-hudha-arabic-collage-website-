import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { AsyncView, Button, Card, Field, Input, Stat, Table, useAsync, useLang } from '../ui';
import { query, rpc, today } from '../../../lib/erp/rpc';
import { printTable } from '../../../lib/printReport';
import { ClassSelect } from './common';
import { useAction } from './hooks';

const STATUSES = [
  { value: 'present', en: 'Present', ar: 'حاضر', cls: 'bg-emerald-700 border-emerald-500' },
  { value: 'late', en: 'Late', ar: 'متأخر', cls: 'bg-amber-700 border-amber-500' },
  { value: 'absent', en: 'Absent', ar: 'غائب', cls: 'bg-red-700 border-red-500' },
  { value: 'excused', en: 'Excused', ar: 'بعذر', cls: 'bg-sky-700 border-sky-500' },
];

export default function ClassAttendance() {
  const { t, lang } = useLang();
  const auth = useAuth();
  const [busy, run] = useAction();
  const [cls, setCls] = useState(auth.user?.classNumber ? String(auth.user.classNumber) : '1');
  const [date, setDate] = useState(today());
  const [marks, setMarks] = useState({});
  const [state, reload] = useAsync(() => rpc('class_attendance_sheet', { p_class: Number(cls), p_date: date }), [cls, date]);

  useEffect(() => {
    const m = {};
    (state.data || []).forEach((r) => {
      m[r.student_id] = { status: r.status || '', excuse_note: r.excuse_note || '' };
    });
    setMarks(m);
  }, [state.data]);

  const setStatus = (id, status) => setMarks((m) => ({ ...m, [id]: { ...m[id], status } }));
  const setNote = (id, excuse_note) => setMarks((m) => ({ ...m, [id]: { ...m[id], excuse_note } }));
  const markAll = (status) =>
    setMarks((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { ...v, status: v.status || status }])));

  const values = Object.values(marks);
  const count = (s) => values.filter((v) => v.status === s).length;
  const unmarked = values.filter((v) => !v.status).length;

  const save = async () => {
    const rows = Object.entries(marks)
      .filter(([, v]) => v.status)
      .map(([student_id, v]) => ({ student_id, date, status: v.status, excuse_note: v.excuse_note || null, marked_by: auth.user?.id }));
    if (!rows.length) return;
    const res = await run(
      () => query('attendance', (q) => q.upsert(rows, { onConflict: 'student_id,date' }).select('id')),
      (r) => `${r?.length ?? rows.length} ${t('attendance records saved', 'سجل حضور تم حفظه')}`
    );
    if (res.ok) reload();
  };

  const statusLabel = (id) => {
    const s = marks[id]?.status;
    if (!s) return '—';
    const hit = STATUSES.find((x) => x.value === s);
    return hit ? t(hit.en, hit.ar) : s;
  };

  const printRegister = () => {
    const sheet = state.data || [];
    if (!sheet.length) return;
    printTable({
      title: t('Class attendance register', 'سجل حضور الصف'),
      columns: [
        { key: 'date', label: t('Date', 'التاريخ'), type: 'date' },
        { key: 'index_number', label: t('Index', 'الرقم') },
        { key: 'full_name', label: t('Student', 'الطالب') },
        { key: 'status', label: t('Status', 'الحالة') },
        { key: 'excuse_note', label: t('Note', 'ملاحظة') },
      ],
      rows: sheet.map((r) => ({
        date,
        index_number: r.index_number,
        full_name: r.full_name,
        status: statusLabel(r.student_id),
        excuse_note: marks[r.student_id]?.excuse_note || '',
      })),
      filters: [
        [t('Class', 'الصف'), cls],
        [t('Date', 'التاريخ'), date],
      ],
      dir: document.documentElement.dir || 'ltr',
      lang,
    });
  };

  return (
    <Card
      title={t('Class attendance', 'حضور الصف')}
      actions={
        <Button size="sm" variant="secondary" disabled={!state.data?.length} onClick={printRegister}>
          <span className="material-symbols-outlined text-[16px] align-middle me-1">print</span>
          {t('Print', 'طباعة')}
        </Button>
      }
    >
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div className="w-40"><Field label={t('Class', 'الصف')}><ClassSelect value={cls} onChange={(v) => setCls(v || '1')} /></Field></div>
        <div className="w-48"><Field label={t('Date', 'التاريخ')}><Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} /></Field></div>
        <Button variant="secondary" onClick={() => markAll('present')}>{t('Mark unmarked as present', 'تحديد غير المسجلين كحاضرين')}</Button>
        <Button disabled={busy || !values.some((v) => v.status)} onClick={save}>{t('Save attendance', 'حفظ الحضور')}</Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {STATUSES.map((s) => (
          <Stat key={s.value} label={t(s.en, s.ar)} value={count(s.value)} tone={{ present: 'emerald', late: 'amber', absent: 'red', excused: 'blue' }[s.value]} />
        ))}
        <Stat label={t('Unmarked', 'غير مسجل')} value={unmarked} tone="gray" />
      </div>
      <AsyncView state={state}>
        {(rows) => (
          <Table rows={rows} rowKey="student_id" empty={t('No approved students in this class.', 'لا يوجد طلاب معتمدون في هذا الصف.')} columns={[
            { key: 'full_name', label: t('Student', 'الطالب') },
            { key: 'index_number', label: t('Index', 'الرقم') },
            { key: 'status', label: t('Status', 'الحالة'), render: (r) => (
              <div className="flex flex-wrap gap-1">
                {STATUSES.map((s) => {
                  const on = marks[r.student_id]?.status === s.value;
                  return (
                    <button key={s.value} type="button" onClick={() => setStatus(r.student_id, s.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${on ? `${s.cls} text-white` : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'}`}>
                      {t(s.en, s.ar)}
                    </button>
                  );
                })}
              </div>
            ) },
            { key: 'note', label: t('Note', 'ملاحظة'), render: (r) => (
              <div className="min-w-[160px]"><Input value={marks[r.student_id]?.excuse_note || ''} onChange={(e) => setNote(r.student_id, e.target.value)} /></div>
            ) },
          ]} />
        )}
      </AsyncView>
    </Card>
  );
}
