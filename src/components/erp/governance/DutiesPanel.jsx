import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { AsyncView, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Stat, Table, Tabs, Textarea, useAsync, useLang } from '../ui';
import { ConfirmModal, FilterBar, Num } from '../finance/shared';
import { downloadCsv, formatDate, formatMoney, today } from '../../../lib/erp/rpc';
import { num, profilesMap, runAction } from '../../../lib/erp/financeApi';
import {
  DUTY_CATEGORIES,
  assignDuty,
  closeDutyYear,
  dutyHistory,
  dutyName,
  endDuty,
  listAcademicYears,
  listAssignments,
  listDutyRoles,
  listMeetings,
  pairLabel,
  pairOptions,
  saveDutyRole,
} from '../../../lib/erp/governanceApi';
import AssignDutyModal from './AssignDutyModal';
import { Checkbox, DutyLabel, useGovernance, useStaff, GovStatus } from './common';

async function loadCurrent() {
  const [duties, assignments] = await Promise.all([listDutyRoles({ activeOnly: true }), listAssignments({ status: 'active' })]);
  const people = await profilesMap(assignments.map((a) => a.assignee_id));
  return { duties, assignments, people };
}

// ---------------------------------------------------------------------------
// Current responsibilities
// ---------------------------------------------------------------------------
function CurrentTab({ isGov }) {
  const { t, lang } = useLang();
  const [state, reload] = useAsync(loadCurrent, []);
  const [filters, setFilters] = useState({ q: '', category: '', unassigned: false });
  const [assigning, setAssigning] = useState(null);
  const [ending, setEnding] = useState(null);
  const [endDate, setEndDate] = useState(today());

  return (
    <Card actions={<Button size="sm" variant="secondary" onClick={reload}>{t('Refresh', 'تحديث')}</Button>}>
      <FilterBar>
        <Field label={t('Search', 'بحث')}>
          <Input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder={t('Duty or person…', 'المسؤولية أو الشخص…')} />
        </Field>
        <Field label={t('Category', 'الفئة')}>
          <Select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} placeholder={t('All', 'الكل')} options={pairOptions(DUTY_CATEGORIES, t)} />
        </Field>
        <div className="pb-2">
          <Checkbox checked={filters.unassigned} onChange={(v) => setFilters((f) => ({ ...f, unassigned: v }))} label={t('Only duties without a holder', 'المسؤوليات بلا حامل فقط')} />
        </div>
      </FilterBar>
      <AsyncView state={state}>
        {({ duties, assignments, people }) => {
          const needle = filters.q.trim().toLowerCase();
          const cards = duties
            .map((d) => ({ d, holders: assignments.filter((a) => a.duty_role_id === d.id).sort((a, b) => Number(b.is_lead) - Number(a.is_lead)) }))
            .filter(({ d }) => !filters.category || d.category === filters.category)
            .filter(({ holders }) => !filters.unassigned || !holders.length)
            .filter(
              ({ d, holders }) =>
                !needle ||
                [d.name_en, d.name_ar, d.name_ta, d.code, ...holders.map((h) => people[h.assignee_id]?.full_name)]
                  .filter(Boolean)
                  .some((s) => s.toLowerCase().includes(needle)),
            );
          const assigned = duties.filter((d) => assignments.some((a) => a.duty_role_id === d.id)).length;
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <Stat label={t('Duties', 'المسؤوليات')} value={duties.length} tone="gray" />
                <Stat label={t('Assigned', 'مسندة')} value={assigned} />
                <Stat label={t('Without a holder', 'بلا حامل')} value={duties.length - assigned} tone={duties.length - assigned ? 'amber' : 'gray'} />
              </div>
              {!cards.length && <EmptyState text={t('No duties match.', 'لا توجد مسؤوليات مطابقة.')} />}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {cards.map(({ d, holders }) => (
                  <div key={d.id} className="rounded-2xl border border-gray-800 bg-gray-900/40 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-white">{dutyName(d, lang)}</div>
                        <div className="text-xs text-gray-500 font-mono">{d.code}</div>
                      </div>
                      <Badge tone="blue">{pairLabel(DUTY_CATEGORIES, d.category, t)}</Badge>
                    </div>
                    {d.description && <p className="text-xs text-gray-400">{d.description}</p>}
                    {holders.length ? (
                      <ul className="space-y-2">
                        {holders.map((h) => (
                          <li key={h.id} className="rounded-xl bg-gray-950/60 border border-gray-800 p-2 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-emerald-300">{people[h.assignee_id]?.full_name || '—'}</span>
                              {!h.is_lead && <Badge>{t('Co-holder', 'مشارك')}</Badge>}
                            </div>
                            <div className="text-xs text-gray-400">
                              {t('Since', 'منذ')} {formatDate(h.start_date)}
                              {h.year?.name ? ` · ${h.year.name}` : ''}
                            </div>
                            {h.meeting && (
                              <div className="text-xs text-gray-500">
                                {t('Decided at', 'تقرر في')}: {h.meeting.title} · {formatDate(h.meeting.meeting_date)}
                              </div>
                            )}
                            {isGov && (
                              <div className="flex justify-end mt-1">
                                <Button size="sm" variant="ghost" onClick={() => { setEndDate(today()); setEnding({ ...h, name: people[h.assignee_id]?.full_name, duty: d }); }}>
                                  {t('End', 'إنهاء')}
                                </Button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-amber-300">{t('No current holder', 'لا يوجد حامل حالي')}</div>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      {num(d.default_petty_cash) > 0 && <span>{t('Petty cash', 'النثرية')}: {formatMoney(d.default_petty_cash)}</span>}
                      {d.grants_leave_review && <Badge tone="green">{t('Reviews student leave', 'يراجع إجازات الطلاب')}</Badge>}
                    </div>
                    {isGov && (
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => setAssigning({ duty: d, holders: holders.map((h) => people[h.assignee_id]?.full_name || '—') })}>
                          {holders.length ? t('Hand over', 'تسليم') : t('Assign', 'إسناد')}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        }}
      </AsyncView>
      {assigning && (
        <AssignDutyModal
          duty={assigning.duty}
          currentHolders={assigning.holders}
          onClose={() => setAssigning(null)}
          onSaved={() => {
            setAssigning(null);
            reload();
          }}
        />
      )}
      <ConfirmModal
        open={Boolean(ending)}
        title={t('End duty', 'إنهاء المسؤولية')}
        message={ending ? `${dutyName(ending.duty, lang)} · ${ending.name || ''}` : ''}
        requireReason
        confirmLabel={t('End duty', 'إنهاء المسؤولية')}
        onClose={() => setEnding(null)}
        onConfirm={async (reason) => {
          const ok = await runAction(() => endDuty(ending.id, endDate, reason), t('Duty ended', 'تم إنهاء المسؤولية'));
          if (ok) reload();
          return ok;
        }}
      >
        <Field label={t('End date', 'تاريخ الانتهاء')}>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        <p className="text-xs text-gray-400">{t('The assignment is kept in the duty history.', 'تبقى المهمة محفوظة في سجل المسؤولية.')}</p>
      </ConfirmModal>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Year-end rotation
// ---------------------------------------------------------------------------
function RotationTab({ isGov }) {
  const { t } = useLang();
  const staff = useStaff();
  const [state, reload] = useAsync(loadCurrent, []);
  const [meetings] = useAsync(() => listMeetings({ limit: 50 }), []);
  const [years] = useAsync(() => listAcademicYears(), []);
  const [closing, setClosing] = useState(false);
  const [closeDate, setCloseDate] = useState(today());
  const [plan, setPlan] = useState({});
  const [common, setCommon] = useState({ start: today(), meeting: '', academicYear: '' });
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);

  const meetingOptions = useMemo(
    () =>
      [...(meetings.data || [])]
        .sort((a, b) => Number(b.meeting_type === 'annual') - Number(a.meeting_type === 'annual'))
        .map((m) => ({ value: m.id, label: `${m.title} · ${formatDate(m.meeting_date)}` })),
    [meetings.data],
  );

  if (!isGov) return <Card><p className="text-sm text-gray-400">{t('Only the principal or administrators run the yearly rotation.', 'التدوير السنوي للمدير أو المسؤولين فقط.')}</p></Card>;

  const assignAll = async () => {
    const rows = Object.entries(plan).filter(([, v]) => v?.assignee);
    if (!rows.length) return;
    setBusy(true);
    const out = [];
    for (const [dutyId, v] of rows) {
      try {
        await assignDuty({ duty: dutyId, assignee: v.assignee, start: common.start, meeting: common.meeting, academicYear: common.academicYear, keepExisting: Boolean(v.keep) });
        out.push({ dutyId, ok: true });
      } catch (e) {
        out.push({ dutyId, ok: false, message: e.message });
      }
    }
    setBusy(false);
    setResults(out);
    setPlan((p) => Object.fromEntries(Object.entries(p).filter(([id]) => !out.find((o) => o.dutyId === id && o.ok))));
    reload();
  };

  return (
    <div className="space-y-6">
      <Card title={t('Step 1 · Close the year', 'الخطوة 1 · إغلاق العام')}>
        <p className="text-sm text-gray-300 mb-3">
          {t(
            'Before the annual mashoora, end every active duty. Nothing is deleted: each holder’s period, petty cash and purchases stay in the duty history.',
            'قبل الشورى السنوية، أنهِ جميع المسؤوليات النشطة. لا يُحذف شيء: تبقى فترة كل حامل ونثريته ومشترياته في السجل.',
          )}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Field label={t('End date', 'تاريخ الانتهاء')}>
              <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
            </Field>
          </div>
          <Button variant="danger" onClick={() => setClosing(true)}>{t('End all active duties', 'إنهاء جميع المسؤوليات النشطة')}</Button>
        </div>
      </Card>

      <Card title={t('Step 2 · Assign duties for the new year', 'الخطوة 2 · إسناد المسؤوليات للعام الجديد')}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <Field label={t('Start date', 'تاريخ البدء')}>
            <Input type="date" value={common.start} onChange={(e) => setCommon((c) => ({ ...c, start: e.target.value }))} />
          </Field>
          <Field label={t('Decided at meeting', 'تقرر في اجتماع')}>
            <Select value={common.meeting} onChange={(e) => setCommon((c) => ({ ...c, meeting: e.target.value }))} placeholder={t('— None —', '— لا شيء —')} options={meetingOptions} />
          </Field>
          <Field label={t('Academic year', 'العام الدراسي')}>
            <Select value={common.academicYear} onChange={(e) => setCommon((c) => ({ ...c, academicYear: e.target.value }))} placeholder={t('Current year', 'العام الحالي')} options={(years.data || []).map((y) => ({ value: y.id, label: y.name }))} />
          </Field>
        </div>
        <AsyncView state={state}>
          {({ duties, assignments, people }) => (
            <Table
              rows={duties}
              columns={[
                { key: 'duty', label: t('Duty', 'المسؤولية'), render: (d) => <DutyLabel duty={d} /> },
                {
                  key: 'current',
                  label: t('Current holder', 'الحامل الحالي'),
                  render: (d) =>
                    assignments
                      .filter((a) => a.duty_role_id === d.id)
                      .map((a) => people[a.assignee_id]?.full_name || '—')
                      .join(', ') || <span className="text-gray-500">—</span>,
                },
                {
                  key: 'next',
                  label: t('New holder', 'الحامل الجديد'),
                  render: (d) => (
                    <div className="min-w-[12rem]">
                      <Select
                        value={plan[d.id]?.assignee || ''}
                        onChange={(e) => setPlan((p) => ({ ...p, [d.id]: { ...p[d.id], assignee: e.target.value } }))}
                        placeholder={t('— Skip —', '— تخطٍّ —')}
                        options={staff.options}
                      />
                    </div>
                  ),
                },
                {
                  key: 'keep',
                  label: t('Co-holder', 'مشارك'),
                  render: (d) => (
                    <input
                      type="checkbox"
                      aria-label={t('Keep the existing holder (add as co-holder)', 'إبقاء الحامل الحالي (إضافة كمشارك)')}
                      checked={Boolean(plan[d.id]?.keep)}
                      onChange={(e) => setPlan((p) => ({ ...p, [d.id]: { ...p[d.id], keep: e.target.checked } }))}
                    />
                  ),
                },
                {
                  key: 'result',
                  label: '',
                  render: (d) => {
                    const r = results?.find((x) => x.dutyId === d.id);
                    if (!r) return null;
                    return r.ok ? <Badge tone="green">{t('Assigned', 'مسندة')}</Badge> : <span className="text-xs text-red-400">{r.message}</span>;
                  },
                },
              ]}
            />
          )}
        </AsyncView>
        <div className="flex justify-end mt-4">
          <Button onClick={assignAll} disabled={busy || !Object.values(plan).some((v) => v?.assignee)}>
            {busy ? t('Working…', 'جارٍ التنفيذ…') : t('Assign selected duties', 'إسناد المسؤوليات المحددة')}
          </Button>
        </div>
        {results && (
          <p className="text-sm text-gray-400 mt-2">
            {t('Assigned', 'مسندة')}: {results.filter((r) => r.ok).length} · {t('Failed', 'فشل')}: {results.filter((r) => !r.ok).length}
          </p>
        )}
      </Card>

      <ConfirmModal
        open={closing}
        title={t('End all active duties?', 'إنهاء جميع المسؤوليات النشطة؟')}
        message={t(
          'Every current holder’s assignment will be ended on the chosen date. The full history (holders, periods, meetings, petty cash, purchases) is kept and the duties can then be assigned for the new year.',
          'ستنتهي مهام جميع الحاملين الحاليين في التاريخ المحدد. يُحفظ السجل كاملًا (الحاملون والفترات والاجتماعات والنثرية والمشتريات) ثم يمكن إسناد المسؤوليات للعام الجديد.',
        )}
        requireReason
        reasonLabel={t('Reason (e.g. End of academic year)', 'السبب (مثل: نهاية العام الدراسي)')}
        confirmLabel={t('End all active duties', 'إنهاء جميع المسؤوليات النشطة')}
        onClose={() => setClosing(false)}
        onConfirm={async (reason) => {
          const n = await runAction(() => closeDutyYear(closeDate, reason));
          if (n !== undefined) {
            toast.success(`${t('Duties ended', 'المسؤوليات المنتهية')}: ${Number(n) || 0}`);
            reload();
          }
          return n !== undefined;
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
function HistoryTab() {
  const { t, lang } = useLang();
  const [dutyId, setDutyId] = useState('');
  const [duties] = useAsync(() => listDutyRoles(), []);
  const [state] = useAsync(() => (dutyId ? dutyHistory(dutyId) : Promise.resolve(null)), [dutyId]);

  const exportCsv = (h) =>
    downloadCsv(
      `duty-history-${h.duty?.code || 'duty'}.csv`,
      h.assignments.map((a) => ({
        duty: h.duty?.name_en,
        holder: a.assignee,
        lead: a.is_lead ? 'yes' : 'no',
        status: a.status,
        start_date: a.start_date,
        end_date: a.end_date || '',
        academic_year: a.academic_year || '',
        meeting: a.meeting || '',
        meeting_date: a.meeting_date || '',
        petty_topups: a.petty_topups,
        petty_spent: a.petty_spent,
        petty_pending: a.petty_pending,
        petty_returned: a.petty_returned,
        purchases: a.purchases,
        purchase_count: a.purchase_count,
        tasks_done: a.tasks_done,
        end_reason: a.end_reason || '',
      })),
    );

  return (
    <Card title={t('Duty history', 'سجل المسؤولية')}>
      <div className="max-w-md mb-4">
        <Field label={t('Duty', 'المسؤولية')}>
          <Select value={dutyId} onChange={(e) => setDutyId(e.target.value)} placeholder={t('Select…', 'اختر…')} options={(duties.data || []).map((d) => ({ value: d.id, label: dutyName(d, lang) }))} />
        </Field>
      </div>
      {!dutyId ? (
        <EmptyState text={t('Pick a duty to see everyone who has held it.', 'اختر مسؤولية لعرض كل من تولاها.')} />
      ) : (
        <AsyncView state={state}>
          {(h) => {
            const total = (k) => h.assignments.reduce((s, a) => s + num(a[k]), 0);
            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <DutyLabel duty={h.duty} />
                  <Button size="sm" variant="secondary" disabled={!h.assignments.length} onClick={() => exportCsv(h)}>
                    {t('Export CSV', 'تصدير CSV')}
                  </Button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <Stat label={t('Holders', 'الحاملون')} value={h.assignments.length} tone="gray" />
                  <Stat label={t('Petty cash topped up', 'النثرية المعبأة')} value={formatMoney(total('petty_topups'))} tone="blue" />
                  <Stat label={t('Petty cash spent', 'النثرية المصروفة')} value={formatMoney(total('petty_spent'))} />
                  <Stat label={t('Purchases', 'المشتريات')} value={formatMoney(total('purchases'))} tone="amber" />
                  <Stat label={t('Tasks done', 'المهام المنجزة')} value={total('tasks_done')} tone="gray" />
                </div>
                <Table
                  rows={h.assignments}
                  empty={t('Nobody has held this duty yet.', 'لم يتولَّ أحد هذه المسؤولية بعد.')}
                  columns={[
                    {
                      key: 'assignee',
                      label: t('Holder', 'الحامل'),
                      render: (a) => (
                        <div>
                          <div className="font-semibold">{a.assignee}</div>
                          <div className="flex gap-1 mt-1">
                            <GovStatus status={a.status} />
                            {!a.is_lead && <Badge>{t('Co-holder', 'مشارك')}</Badge>}
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: 'period',
                      label: t('Period', 'الفترة'),
                      render: (a) => (
                        <div className="text-xs whitespace-nowrap">
                          <div>{formatDate(a.start_date)} → {a.end_date ? formatDate(a.end_date) : t('now', 'الآن')}</div>
                          {a.academic_year && <div className="text-gray-500">{a.academic_year}</div>}
                          {a.end_reason && <div className="text-gray-500">{a.end_reason}</div>}
                        </div>
                      ),
                    },
                    {
                      key: 'meeting',
                      label: t('Decided at', 'تقرر في'),
                      render: (a) => (a.meeting ? <div className="text-xs">{a.meeting}<div className="text-gray-500">{formatDate(a.meeting_date)}</div></div> : '—'),
                    },
                    { key: 'petty_topups', label: t('Topped up', 'المعبأ'), render: (a) => <Num>{formatMoney(a.petty_topups)}</Num> },
                    { key: 'petty_spent', label: t('Spent', 'المصروف'), render: (a) => <Num>{formatMoney(a.petty_spent)}</Num> },
                    { key: 'petty_pending', label: t('Pending', 'معلق'), render: (a) => <Num>{formatMoney(a.petty_pending)}</Num> },
                    { key: 'petty_returned', label: t('Returned', 'المُرجَع'), render: (a) => <Num>{formatMoney(a.petty_returned)}</Num> },
                    {
                      key: 'purchases',
                      label: t('Purchases', 'المشتريات'),
                      render: (a) => (
                        <Num>
                          {formatMoney(a.purchases)}
                          <span className="block text-xs text-gray-500">× {a.purchase_count}</span>
                        </Num>
                      ),
                    },
                    { key: 'tasks_done', label: t('Tasks done', 'المهام المنجزة'), render: (a) => <Num>{a.tasks_done}</Num> },
                  ]}
                />
              </div>
            );
          }}
        </AsyncView>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Duty catalog
// ---------------------------------------------------------------------------
const EMPTY_DUTY = { code: '', name_en: '', name_ar: '', name_ta: '', category: 'other', description: '', default_petty_cash: '', grants_leave_review: false, is_active: true };

function CatalogTab({ isGov }) {
  const { t } = useLang();
  const [state, reload] = useAsync(() => listDutyRoles(), []);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setEdit((e) => ({ ...e, ...patch }));

  const save = async () => {
    setBusy(true);
    const row = {
      ...(edit.id ? { id: edit.id } : {}),
      code: edit.code.trim().toUpperCase().replace(/\s+/g, '_'),
      name_en: edit.name_en.trim(),
      name_ar: edit.name_ar.trim() || null,
      name_ta: edit.name_ta.trim() || null,
      category: edit.category,
      description: edit.description.trim() || null,
      default_petty_cash: Math.max(0, num(edit.default_petty_cash)),
      grants_leave_review: Boolean(edit.grants_leave_review),
      is_active: Boolean(edit.is_active),
    };
    const ok = await runAction(() => saveDutyRole(row), t('Duty saved', 'تم حفظ المسؤولية'));
    setBusy(false);
    if (ok) {
      setEdit(null);
      reload();
    }
  };
  const toggleActive = async (d) => {
    const ok = await runAction(() => saveDutyRole({ id: d.id, is_active: !d.is_active }), d.is_active ? t('Duty deactivated', 'تم تعطيل المسؤولية') : t('Duty activated', 'تم تفعيل المسؤولية'));
    if (ok) reload();
  };

  return (
    <Card
      title={t('Duty catalog', 'دليل المسؤوليات')}
      actions={isGov && <Button size="sm" onClick={() => setEdit({ ...EMPTY_DUTY })}>+ {t('New duty', 'مسؤولية جديدة')}</Button>}
    >
      <AsyncView state={state}>
        {(rows) => (
          <Table
            rows={rows}
            empty={t('No duties defined.', 'لا توجد مسؤوليات.')}
            columns={[
              { key: 'code', label: t('Code', 'الرمز'), render: (d) => <span className="font-mono text-xs">{d.code}</span> },
              {
                key: 'names',
                label: t('Name', 'الاسم'),
                render: (d) => (
                  <div className="min-w-[12rem]">
                    <div>{d.name_en}</div>
                    {d.name_ar && <div className="text-xs text-gray-400" dir="rtl">{d.name_ar}</div>}
                    {d.name_ta && <div className="text-xs text-gray-400">{d.name_ta}</div>}
                  </div>
                ),
              },
              { key: 'category', label: t('Category', 'الفئة'), render: (d) => pairLabel(DUTY_CATEGORIES, d.category, t) },
              { key: 'default_petty_cash', label: t('Default petty cash', 'النثرية الافتراضية'), render: (d) => <Num>{formatMoney(d.default_petty_cash)}</Num> },
              { key: 'grants_leave_review', label: t('Reviews student leave', 'يراجع إجازات الطلاب'), render: (d) => (d.grants_leave_review ? <span className="material-symbols-outlined text-[15px] text-[#11694A]">check</span> : '—') },
              { key: 'is_active', label: t('Status', 'الحالة'), render: (d) => (d.is_active ? <Badge tone="green">{t('Active', 'نشط')}</Badge> : <Badge>{t('Inactive', 'غير نشط')}</Badge>) },
              {
                key: 'act',
                label: '',
                render: (d) =>
                  isGov && (
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="secondary" onClick={() => setEdit({ ...EMPTY_DUTY, ...d, name_ar: d.name_ar || '', name_ta: d.name_ta || '', description: d.description || '' })}>
                        {t('Edit', 'تعديل')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(d)}>
                        {d.is_active ? t('Deactivate', 'تعطيل') : t('Activate', 'تفعيل')}
                      </Button>
                    </div>
                  ),
              },
            ]}
          />
        )}
      </AsyncView>
      <Modal
        open={Boolean(edit)}
        title={edit?.id ? t('Edit duty', 'تعديل المسؤولية') : t('New duty', 'مسؤولية جديدة')}
        onClose={() => setEdit(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdit(null)}>{t('Cancel', 'إلغاء')}</Button>
            <Button onClick={save} disabled={busy || !edit?.code?.trim() || !edit?.name_en?.trim()}>{t('Save', 'حفظ')}</Button>
          </>
        }
      >
        {edit && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('Code', 'الرمز')} hint={t('e.g. FOOD, LIBRARY', 'مثل FOOD، LIBRARY')}>
              <Input value={edit.code} disabled={Boolean(edit.id)} onChange={(e) => set({ code: e.target.value })} />
            </Field>
            <Field label={t('Category', 'الفئة')}>
              <Select value={edit.category} onChange={(e) => set({ category: e.target.value })} options={pairOptions(DUTY_CATEGORIES, t)} />
            </Field>
            <Field label={t('Name (English)', 'الاسم (إنجليزي)')}>
              <Input value={edit.name_en} onChange={(e) => set({ name_en: e.target.value })} />
            </Field>
            <Field label={t('Name (Arabic)', 'الاسم (عربي)')}>
              <Input dir="rtl" value={edit.name_ar} onChange={(e) => set({ name_ar: e.target.value })} />
            </Field>
            <Field label={t('Name (Tamil)', 'الاسم (تاميلي)')}>
              <Input value={edit.name_ta} onChange={(e) => set({ name_ta: e.target.value })} />
            </Field>
            <Field label={t('Default petty cash (LKR)', 'النثرية الافتراضية (روبية)')} hint={t('A fund opens on first assignment when above 0', 'يُفتح صندوق عند أول إسناد إذا كانت أكبر من 0')}>
              <Input type="number" min="0" step="0.01" value={edit.default_petty_cash} onChange={(e) => set({ default_petty_cash: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t('Description', 'الوصف')}>
                <Textarea rows={2} value={edit.description} onChange={(e) => set({ description: e.target.value })} />
              </Field>
            </div>
            <Checkbox checked={edit.grants_leave_review} onChange={(v) => set({ grants_leave_review: v })} label={t('Holder may review student leave', 'يمكن للحامل مراجعة إجازات الطلاب')} />
            <Checkbox checked={edit.is_active} onChange={(v) => set({ is_active: v })} label={t('Active', 'نشط')} />
          </div>
        )}
      </Modal>
    </Card>
  );
}

export default function DutiesPanel() {
  const { t } = useLang();
  const { isGov } = useGovernance();
  const [tab, setTab] = useState('current');
  const tabs = [
    { id: 'current', label: t('Current responsibilities', 'المسؤوليات الحالية') },
    ...(isGov ? [{ id: 'rotation', label: t('Year-end rotation', 'التدوير السنوي') }] : []),
    { id: 'history', label: t('History', 'السجل') },
    { id: 'catalog', label: t('Duty catalog', 'دليل المسؤوليات') },
  ];
  return (
    <div>
      <PageHeader
        title={t('Duties', 'المسؤوليات')}
        subtitle={t('Who is responsible for what this year, decided at the mashoora — with the full history.', 'من المسؤول عن ماذا هذا العام بقرار الشورى — مع السجل الكامل.')}
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'current' && <CurrentTab isGov={isGov} />}
      {tab === 'rotation' && <RotationTab isGov={isGov} />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'catalog' && <CatalogTab isGov={isGov} />}
    </div>
  );
}
