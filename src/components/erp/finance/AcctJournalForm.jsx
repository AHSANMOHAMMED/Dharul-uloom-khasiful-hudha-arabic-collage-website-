import { useState } from 'react';
import { Button, Field, Input, Modal, Select, useAsync, useLang } from '../ui';
import { rpc, formatMoney, formatDate, today } from '../../../lib/erp/rpc';
import { accountLabel, listAccounts, num, runAction } from '../../../lib/erp/financeApi';

const blank = () => ({ account_id: '', debit: '', credit: '', memo: '' });
const round2 = (n) => Math.round(n * 100) / 100;

/** Manual journal with dynamic debit/credit rows and a live balance check. */
export default function AcctJournalForm({ lockedUntil, onClose, onSaved }) {
  const { t, ar } = useLang();
  const [entryDate, setEntryDate] = useState(today());
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState([blank(), blank()]);
  const [busy, setBusy] = useState(false);
  const [accounts] = useAsync(() => listAccounts((q) => q.eq('is_active', true)), []);

  const setRow = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const used = rows.filter((r) => r.account_id || num(r.debit) || num(r.credit));
  const rowErrors = used.map((r) => !r.account_id || (num(r.debit) > 0) === (num(r.credit) > 0) || num(r.debit) < 0 || num(r.credit) < 0);
  const debit = round2(used.reduce((s, r) => s + num(r.debit), 0));
  const credit = round2(used.reduce((s, r) => s + num(r.credit), 0));
  const diff = round2(debit - credit);
  const locked = lockedUntil && entryDate <= lockedUntil;
  const balanced = used.length >= 2 && !rowErrors.some(Boolean) && debit > 0 && diff === 0;
  const valid = balanced && description.trim() && entryDate && !locked;

  const save = async (post) => {
    if (post && !window.confirm(t('Post this journal? Posted entries are immutable and can only be reversed.', 'ترحيل هذا القيد؟ القيود المرحّلة لا تُعدَّل ويمكن عكسها فقط.'))) return;
    setBusy(true);
    const ok = await runAction(
      () =>
        rpc('create_journal_entry', {
          p_date: entryDate,
          p_description: description.trim(),
          p_lines: used.map((r) => ({
            account_id: r.account_id,
            debit: round2(num(r.debit)),
            credit: round2(num(r.credit)),
            memo: r.memo.trim() || null,
          })),
          p_post: post,
        }),
      post ? t('Journal posted', 'تم ترحيل القيد') : t('Draft journal saved', 'تم حفظ مسودة القيد'),
    );
    setBusy(false);
    if (ok) onSaved();
  };

  const options = (accounts.data || []).map((a) => ({ value: a.id, label: accountLabel(a, ar) }));

  return (
    <Modal
      open
      title={t('New manual journal', 'قيد يدوي جديد')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button variant="secondary" onClick={() => save(false)} disabled={!valid || busy}>
            {t('Save draft', 'حفظ كمسودة')}
          </Button>
          <Button onClick={() => save(true)} disabled={!valid || busy}>
            {t('Post', 'ترحيل')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={t('Date', 'التاريخ')}
          hint={lockedUntil ? `${t('Books locked until', 'الدفاتر مقفلة حتى')} ${formatDate(lockedUntil)}` : undefined}
        >
          <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
        </Field>
        <Field label={t('Description', 'الوصف')}>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
      {locked && <p className="text-xs text-red-400">{t('This date falls in a locked period.', 'هذا التاريخ ضمن فترة مقفلة.')}</p>}

      <div className="space-y-3">
        {rows.map((r, i) => {
          const idx = used.indexOf(r);
          const bad = idx >= 0 && rowErrors[idx];
          return (
            <div key={i} className={`rounded-xl border p-3 space-y-2 ${bad ? 'border-red-800' : 'border-gray-800'}`}>
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <Select value={r.account_id} onChange={(e) => setRow(i, { account_id: e.target.value })} placeholder={t('Account…', 'الحساب…')} options={options} />
                </div>
                {rows.length > 2 && (
                  <Button variant="ghost" size="sm" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={t('Remove', 'حذف')}>
                    ✕
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={t('Debit', 'مدين')}
                  value={r.debit}
                  onChange={(e) => setRow(i, { debit: e.target.value, credit: e.target.value ? '' : r.credit })}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={t('Credit', 'دائن')}
                  value={r.credit}
                  onChange={(e) => setRow(i, { credit: e.target.value, debit: e.target.value ? '' : r.debit })}
                />
                <Input placeholder={t('Memo', 'ملاحظة')} value={r.memo} onChange={(e) => setRow(i, { memo: e.target.value })} />
              </div>
            </div>
          );
        })}
      </div>
      <Button variant="ghost" size="sm" onClick={() => setRows((rs) => [...rs, blank()])}>
        + {t('Add line', 'إضافة سطر')}
      </Button>

      <div className={`rounded-xl px-4 py-3 text-sm grid grid-cols-3 gap-2 ${balanced ? 'bg-emerald-950/50 border border-emerald-800' : 'bg-amber-950/40 border border-amber-800'}`}>
        <div>
          <div className="text-xs text-gray-400">{t('Debits', 'المدين')}</div>
          <div className="font-semibold text-white tabular-nums">{formatMoney(debit)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">{t('Credits', 'الدائن')}</div>
          <div className="font-semibold text-white tabular-nums">{formatMoney(credit)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">{t('Difference', 'الفرق')}</div>
          <div className={`font-semibold tabular-nums ${diff === 0 ? 'text-emerald-300' : 'text-amber-300'}`}>{formatMoney(diff)}</div>
        </div>
        <div className="col-span-3 text-xs">
          {balanced
            ? t('Balanced ✓', 'متوازن ✓')
            : rowErrors.some(Boolean)
              ? t('Each line needs an account and either a debit or a credit (not both).', 'كل سطر يحتاج حسابًا ومبلغًا مدينًا أو دائنًا (وليس كليهما).')
              : t('Debits must equal credits across at least two lines.', 'يجب أن يتساوى المدين والدائن في سطرين على الأقل.')}
        </div>
      </div>
    </Modal>
  );
}
