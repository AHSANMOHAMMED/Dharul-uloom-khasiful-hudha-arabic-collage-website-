import { useEffect, useMemo, useState } from 'react';
import { AsyncView, Button, Card, Field, Input, Select, StatusBadge, Table, useAsync, useLang } from '../ui';
import { query, queryAll, rpc } from '../../../lib/erp/rpc';
import { ClassSelect } from './common';
import { useAction } from './hooks';

export default function StudentEnrolment({ canEnroll, canPromote }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [years] = useAsync(() => query('academic_years', (q) => q.select('*').order('start_date', { ascending: false })), []);
  const yearOpts = (years.data || []).map((y) => ({ value: y.id, label: `${y.name}${y.is_current ? ` (${t('current', 'الحالي')})` : ''}` }));

  const [yearId, setYearId] = useState('');
  const [fromYear, setFromYear] = useState('');
  const [toYear, setToYear] = useState('');
  const [cls, setCls] = useState('');
  const [maxClass, setMaxClass] = useState('7');
  const [repeat, setRepeat] = useState([]);

  useEffect(() => {
    const list = years.data || [];
    if (!list.length) return;
    const current = list.find((y) => y.is_current) || list[0];
    setYearId((v) => v || current.id);
    setFromYear((v) => v || current.id);
    const next = list.find((y) => y.start_date > current.start_date);
    if (next) setToYear((v) => v || next.id);
  }, [years.data]);

  const [enrolled, reloadEnrolled] = useAsync(
    () =>
      yearId
        ? queryAll('student_enrollments', (q) =>
            q.select('*, profiles!student_id(full_name, index_number)').eq('academic_year_id', yearId).order('class_number').order('student_id'),
            { pageSize: 400, maxRows: 50000 },
          )
        : Promise.resolve([]),
    [yearId]
  );
  const [candidates, reloadCandidates] = useAsync(
    () =>
      fromYear
        ? queryAll('student_enrollments', (q) => {
            let b = q.select('id, student_id, class_number, status, profiles!student_id(full_name, index_number)')
              .eq('academic_year_id', fromYear).eq('status', 'active');
            if (cls) b = b.eq('class_number', Number(cls));
            return b.order('class_number').order('id');
          }, { pageSize: 400, maxRows: 50000 })
        : Promise.resolve([]),
    [fromYear, cls]
  );

  const byClass = useMemo(() => {
    const m = {};
    (enrolled.data || []).forEach((e) => {
      m[e.class_number] = (m[e.class_number] || 0) + 1;
    });
    return m;
  }, [enrolled.data]);

  const enrollAll = async () => {
    if (!yearId) return;
    const res = await run(() => rpc('enroll_active_students', { p_year_id: yearId }), (n) => `${n ?? 0} ${t('students enrolled', 'طالب تم تسجيله')}`);
    if (res.ok) reloadEnrolled();
  };

  const promote = async () => {
    if (!fromYear || !toYear || fromYear === toYear) {
      window.alert(t('Choose two different academic years.', 'اختر عامين دراسيين مختلفين.'));
      return;
    }
    const n = candidates.data?.length || 0;
    if (!window.confirm(t(
      `Promote ${n} active enrolment(s)? ${repeat.length} will repeat; class ${maxClass} and above graduate. This cannot be undone automatically.`,
      `ترفيع ${n} طالب؟ ${repeat.length} سيعيدون السنة؛ الصف ${maxClass} فما فوق يتخرجون. لا يمكن التراجع تلقائيًا.`
    ))) return;
    const res = await run(
      () => rpc('promote_students', {
        p_from_year: fromYear,
        p_to_year: toYear,
        p_class_number: cls ? Number(cls) : null,
        p_repeat_ids: repeat,
        p_max_class: Number(maxClass) || 7,
      }),
      (r) => `${t('Promoted', 'ترفيع')} ${r?.promoted ?? 0} · ${t('Repeated', 'إعادة')} ${r?.repeated ?? 0} · ${t('Graduated', 'تخرج')} ${r?.graduated ?? 0}`
    );
    if (res.ok) {
      setRepeat([]);
      reloadCandidates();
      reloadEnrolled();
    }
  };

  const toggleRepeat = (id) => setRepeat((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

  return (
    <AsyncView state={years}>
      {(ys) =>
        !ys.length ? (
          <Card><p className="text-sm text-gray-400">{t('Create an academic year first (Academics → Years & terms).', 'أنشئ عامًا دراسيًا أولًا (الشؤون الأكاديمية ← الأعوام والفصول).')}</p></Card>
        ) : (
          <div className="space-y-6">
            <Card title={t('Enrolments by year', 'التسجيل حسب العام')} actions={
              <div className="flex flex-wrap gap-2 items-center">
                <div className="w-56"><Select value={yearId} onChange={(e) => setYearId(e.target.value)} options={yearOpts} /></div>
                {canEnroll && <Button disabled={busy || !yearId} onClick={enrollAll}>{t('Enrol all un-enrolled students', 'تسجيل كل الطلاب غير المسجلين')}</Button>}
              </div>
            }>
              <div className="flex flex-wrap gap-2 mb-3 text-xs">
                {Object.entries(byClass).map(([c, n]) => (
                  <span key={c} className="rounded-full bg-gray-800 px-3 py-1 text-gray-300">{t('Class', 'الصف')} {c}: <b className="text-white">{n}</b></span>
                ))}
              </div>
              <AsyncView state={enrolled}>
                {(rows) => (
                  <Table rows={rows} empty={t('Nobody enrolled in this year yet.', 'لا يوجد تسجيل في هذا العام بعد.')} columns={[
                    { key: 'name', label: t('Student', 'الطالب'), render: (r) => r.profiles?.full_name },
                    { key: 'index', label: t('Index', 'الرقم'), render: (r) => r.profiles?.index_number },
                    { key: 'class_number', label: t('Class', 'الصف') },
                    { key: 'section', label: t('Section', 'الشعبة') },
                    { key: 'status', label: t('Status', 'الحالة'), render: (r) => <StatusBadge status={r.status} /> },
                  ]} />
                )}
              </AsyncView>
            </Card>

            {canPromote && (
              <Card title={t('Year-end promotion', 'الترفيع في نهاية العام')}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                  <Field label={t('From year', 'من عام')}><Select value={fromYear} onChange={(e) => setFromYear(e.target.value)} options={yearOpts} /></Field>
                  <Field label={t('To year', 'إلى عام')}><Select value={toYear} onChange={(e) => setToYear(e.target.value)} options={yearOpts} placeholder="—" /></Field>
                  <Field label={t('Class (optional)', 'الصف (اختياري)')}><ClassSelect value={cls} onChange={(v) => { setCls(v); setRepeat([]); }} allLabel={t('All classes', 'كل الصفوف')} /></Field>
                  <Field label={t('Final class (graduates)', 'الصف النهائي (يتخرج)')}><Input type="number" min="1" max="20" value={maxClass} onChange={(e) => setMaxClass(e.target.value)} /></Field>
                </div>
                <p className="text-xs text-gray-500 mb-2">{t('Tick students who should repeat their class.', 'حدد الطلاب الذين سيعيدون الصف.')}</p>
                <AsyncView state={candidates}>
                  {(rows) => (
                    <Table rows={rows} empty={t('No active enrolments in the source year.', 'لا توجد تسجيلات نشطة في العام المصدر.')} columns={[
                      { key: 'rep', label: t('Repeat', 'إعادة'), render: (r) => (
                        <input type="checkbox" className="accent-amber-500 h-4 w-4" checked={repeat.includes(r.student_id)} onChange={() => toggleRepeat(r.student_id)} />
                      ) },
                      { key: 'name', label: t('Student', 'الطالب'), render: (r) => r.profiles?.full_name },
                      { key: 'index', label: t('Index', 'الرقم'), render: (r) => r.profiles?.index_number },
                      { key: 'class_number', label: t('Class', 'الصف') },
                      { key: 'next', label: t('Next', 'التالي'), render: (r) =>
                        repeat.includes(r.student_id) ? t('Repeat', 'إعادة') : r.class_number >= Number(maxClass) ? t('Graduate', 'تخرج') : `${t('Class', 'الصف')} ${r.class_number + 1}` },
                    ]} />
                  )}
                </AsyncView>
                <div className="flex justify-end mt-4">
                  <Button disabled={busy || !candidates.data?.length || !toYear} onClick={promote}>{t('Run promotion', 'تنفيذ الترفيع')}</Button>
                </div>
              </Card>
            )}
          </div>
        )
      }
    </AsyncView>
  );
}
