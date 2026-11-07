import { useState } from 'react';
import { Button, Field, Input, Modal, Select, Textarea, useAsync, useLang } from '../ui';
import { EmployeePicker } from '../finance/shared';
import { today, formatDate } from '../../../lib/erp/rpc';
import { runAction } from '../../../lib/erp/financeApi';
import { assignDuty, dutyName, listAcademicYears, listDutyRoles, listMeetings } from '../../../lib/erp/governanceApi';
import { Checkbox } from './common';

/**
 * Assign / hand over a duty (assign_duty). With "keep existing" the person is
 * added as a co-holder; otherwise the current holder's assignment is ended
 * (history kept).
 */
export default function AssignDutyModal({ duty, meeting, currentHolders = [], onClose, onSaved }) {
  const { t, lang } = useLang();
  const [form, setForm] = useState({
    duty: duty?.id || '',
    assignee: null,
    start: meeting?.meeting_date && meeting.meeting_date > today() ? meeting.meeting_date : today(),
    meeting: meeting?.id || '',
    academicYear: meeting?.academic_year_id || '',
    notes: '',
    keepExisting: false,
  });
  const [busy, setBusy] = useState(false);
  const [duties] = useAsync(() => (duty ? Promise.resolve([duty]) : listDutyRoles({ activeOnly: true })), [duty?.id]);
  const [meetings] = useAsync(() => (meeting ? Promise.resolve([meeting]) : listMeetings({ limit: 50 })), [meeting?.id]);
  const [years] = useAsync(() => listAcademicYears(), []);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setBusy(true);
    const ok = await runAction(() => assignDuty(form), t('Duty assigned', 'تم إسناد المسؤولية'));
    setBusy(false);
    if (ok) onSaved?.();
  };

  return (
    <Modal
      open
      title={currentHolders.length ? t('Hand over duty', 'تسليم المسؤولية') : t('Assign duty', 'إسناد مسؤولية')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button onClick={save} disabled={busy || !form.duty || !form.assignee}>
            {busy ? t('Working…', 'جارٍ التنفيذ…') : t('Assign', 'إسناد')}
          </Button>
        </>
      }
    >
      <Field label={t('Duty', 'المسؤولية')}>
        <Select
          value={form.duty}
          disabled={Boolean(duty)}
          onChange={(e) => set({ duty: e.target.value })}
          placeholder={t('Select…', 'اختر…')}
          options={(duties.data || []).map((d) => ({ value: d.id, label: dutyName(d, lang) }))}
        />
      </Field>
      {currentHolders.length > 0 && (
        <div className="rounded-xl border border-amber-800 bg-amber-950/40 p-3 text-xs text-amber-200">
          {t('Current holder', 'الحامل الحالي')}: {currentHolders.join(', ')}
        </div>
      )}
      <EmployeePicker value={form.assignee} onChange={(v) => set({ assignee: v })} label={t('Person (lecturer / staff)', 'الشخص (محاضر / موظف)')} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t('Start date', 'تاريخ البدء')}>
          <Input type="date" value={form.start} onChange={(e) => set({ start: e.target.value })} />
        </Field>
        <Field label={t('Academic year', 'العام الدراسي')} hint={t('Blank = current year', 'فارغ = العام الحالي')}>
          <Select
            value={form.academicYear}
            onChange={(e) => set({ academicYear: e.target.value })}
            placeholder={t('Current year', 'العام الحالي')}
            options={(years.data || []).map((y) => ({ value: y.id, label: y.name }))}
          />
        </Field>
      </div>
      <Field label={t('Decided at meeting', 'تقرر في اجتماع')}>
        <Select
          value={form.meeting}
          disabled={Boolean(meeting)}
          onChange={(e) => set({ meeting: e.target.value })}
          placeholder={t('— None —', '— لا شيء —')}
          options={(meetings.data || []).map((m) => ({ value: m.id, label: `${m.title} · ${formatDate(m.meeting_date)}` }))}
        />
      </Field>
      <Field label={t('Notes', 'ملاحظات')}>
        <Textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
      <Checkbox
        checked={form.keepExisting}
        onChange={(v) => set({ keepExisting: v })}
        label={t('Keep the existing holder (add as co-holder)', 'إبقاء الحامل الحالي (إضافة كمشارك)')}
      />
      {!form.keepExisting && currentHolders.length > 0 && (
        <p className="text-xs text-gray-400">
          {t('The current holder’s assignment ends the day before the start date. Their history is kept.', 'تنتهي مهمة الحامل الحالي قبل يوم من تاريخ البدء، ويُحفظ سجله.')}
        </p>
      )}
    </Modal>
  );
}
