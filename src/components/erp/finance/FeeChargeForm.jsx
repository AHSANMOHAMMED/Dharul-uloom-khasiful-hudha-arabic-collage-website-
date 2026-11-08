import { useState } from 'react';
import { Button, Field, Input, Select, useAsync, useLang } from '../ui';
import { query, rpc, currentMonth, formatMoney } from '../../../lib/erp/rpc';
import { num, runAction } from '../../../lib/erp/financeApi';
import { StudentPicker } from './shared';

const blankLine = () => ({ category: 'OTHER', kind: 'charge', description: '', amount: '' });

/**
 * Add charges / fines / discounts to a student's invoice for a month via
 * add_fee_charges (creates the invoice if none is open for that month).
 */
export default function FeeChargeForm({ studentId: fixedStudent, month: fixedMonth, onDone, onCancel }) {
  const { t } = useLang();
  const [studentId, setStudentId] = useState(fixedStudent || null);
  const [month, setMonth] = useState(fixedMonth || currentMonth());
  const [dueDate, setDueDate] = useState('');
  const [lines, setLines] = useState([blankLine()]);
  const [busy, setBusy] = useState(false);
  const [cats] = useAsync(() => query('fee_categories', (q) => q.select('id, code, name, name_ar').eq('is_active', true).order('code')), []);

  const catOptions = (cats.data || []).map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }));
  const kindOptions = [
    { value: 'charge', label: t('Charge', 'رسم') },
    { value: 'fine', label: t('Fine', 'غرامة') },
    { value: 'discount', label: t('Discount', 'خصم') },
  ];
  const setLine = (i, patch) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const valid = studentId && /^\d{4}-\d{2}$/.test(month) && lines.length && lines.every((l) => num(l.amount) > 0);
  const net = lines.reduce((s, l) => s + (l.kind === 'discount' ? -1 : 1) * num(l.amount), 0);

  const submit = async () => {
    setBusy(true);
    const res = await runAction(
      () =>
        rpc('add_fee_charges', {
          p_student: studentId,
          p_month: month,
          p_lines: lines.map((l) => ({
            category: l.category,
            kind: l.kind,
            description: l.description.trim() || undefined,
            amount: num(l.amount),
          })),
          p_due_date: dueDate || null,
        }),
      t('Charges added to invoice', 'أضيفت الرسوم إلى الفاتورة'),
    );
    setBusy(false);
    if (res) onDone?.(res);
  };

  return (
    <div className="space-y-3 rounded-xl border border-gray-800 p-4 bg-gray-900/40">
      {!fixedStudent && <StudentPicker value={studentId} onChange={setStudentId} />}
      {!fixedMonth && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('Invoice month', 'شهر الفاتورة')}>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
          <Field label={t('Due date (new invoice)', 'تاريخ الاستحقاق (فاتورة جديدة)')}>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
      )}
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 border-t border-gray-800 pt-3">
          <Field label={t('Category', 'الفئة')}>
            <Select value={l.category} onChange={(e) => setLine(i, { category: e.target.value })} options={catOptions} />
          </Field>
          <Field label={t('Type', 'النوع')}>
            <Select value={l.kind} onChange={(e) => setLine(i, { kind: e.target.value })} options={kindOptions} />
          </Field>
          <Field label={t('Description', 'الوصف')}>
            <Input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
          </Field>
          <Field label={t('Amount', 'المبلغ')}>
            <div className="flex gap-2">
              <Input type="number" min="0" step="0.01" value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} />
              {lines.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label={t('Remove', 'حذف')}>
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </Button>
              )}
            </div>
          </Field>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => setLines((ls) => [...ls, blankLine()])}>
          + {t('Add line', 'إضافة بند')}
        </Button>
        <span className="text-sm text-gray-400">
          {t('Net change', 'صافي التغيير')}: <span className="text-white font-semibold">{formatMoney(net)}</span>
        </span>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {t('Cancel', 'إلغاء')}
          </Button>
        )}
        <Button onClick={submit} disabled={!valid || busy}>
          {busy ? t('Saving…', 'جارٍ الحفظ…') : t('Add to invoice', 'إضافة إلى الفاتورة')}
        </Button>
      </div>
    </div>
  );
}
