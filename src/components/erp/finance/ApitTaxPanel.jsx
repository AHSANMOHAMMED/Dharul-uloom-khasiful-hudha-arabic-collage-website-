import { useState } from 'react';
import { AsyncView, Button, Card, Field, Input, Table, Textarea, useAsync, useLang } from '../ui';
import { formatDate, query, rpc, today } from '../../../lib/erp/rpc';
import { useAction } from '../campus/hooks';

const DEFAULT_BRACKETS = `[
  { "up_to": 100000, "rate": 0 },
  { "up_to": 141667, "rate": 6 },
  { "up_to": 183333, "rate": 12 },
  { "up_to": 225000, "rate": 18 },
  { "up_to": 266667, "rate": 24 },
  { "up_to": 308333, "rate": 30 },
  { "up_to": null, "rate": 36 }
]`;

export default function ApitTaxPanel() {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [bracketsText, setBracketsText] = useState(DEFAULT_BRACKETS);
  const [state, reload] = useAsync(
    () => query('payroll_tax_tables', (q) => q.select('*').order('effective_from', { ascending: false })),
    [],
  );

  const validateBrackets = (brackets) => {
    if (!Array.isArray(brackets) || !brackets.length) {
      throw new Error(t('Brackets must be a non-empty array', 'يجب أن تكون الشرائح مصفوفة غير فارغة'));
    }
    let prev = null;
    brackets.forEach((b, i) => {
      const rate = Number(b.rate);
      if (Number.isNaN(rate) || rate < 0 || rate > 100) {
        throw new Error(t(`Invalid rate at tier ${i + 1}`, `معدل غير صالح في الشريحة ${i + 1}`));
      }
      const up = b.up_to == null ? null : Number(b.up_to);
      if (up != null && (Number.isNaN(up) || up <= 0)) {
        throw new Error(t(`Invalid up_to at tier ${i + 1}`, `حد أعلى غير صالح في الشريحة ${i + 1}`));
      }
      if (prev != null && up != null && up <= prev) {
        throw new Error(t('Brackets must be strictly ascending by up_to', 'يجب أن تتصاعد الشرائح حسب up_to'));
      }
      if (prev != null && up == null && i !== brackets.length - 1) {
        throw new Error(t('Only the last tier may have null up_to', 'الشريحة الأخيرة فقط قد تكون بلا حد أعلى'));
      }
      if (up != null) prev = up;
    });
    const last = brackets[brackets.length - 1];
    if (last.up_to != null) {
      throw new Error(t('Final tier should use null up_to (open-ended)', 'الشريحة الأخيرة يجب أن تكون مفتوحة (up_to: null)'));
    }
  };

  const save = async () => {
    let brackets;
    try { brackets = JSON.parse(bracketsText); }
    catch {
      window.alert(t('Invalid JSON', 'JSON غير صالح'));
      return;
    }
    try { validateBrackets(brackets); }
    catch (e) {
      window.alert(e.message || String(e));
      return;
    }
    const res = await run(() => rpc('upsert_payroll_tax_table', {
      p_effective_from: effectiveFrom,
      p_brackets: brackets,
      p_label: 'APIT',
    }), t('APIT table saved', 'تم حفظ جدول ضريبة الدخل'));
    if (res.ok) reload();
  };

  return (
    <div className="space-y-4">
      <Card title={t('Effective-dated APIT table', 'جدول ضريبة الدخل حسب التاريخ')}>
        <p className="text-xs text-ink-text-muted mb-3">
          {t('Rates are institutional configuration — confirm with HR/counsel before production use.',
            'المعدلات إعداد مؤسسي — أكّدها مع الموارد البشرية/المستشار قبل الإنتاج.')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label={t('Effective from', 'ساري من')}>
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </Field>
        </div>
        <Field label={t('Brackets JSON', 'شرائح JSON')}>
          <Textarea rows={10} value={bracketsText} onChange={(e) => setBracketsText(e.target.value)} className="font-mono text-xs" />
        </Field>
        <Button className="mt-3" disabled={busy} onClick={save}>{t('Save table', 'حفظ الجدول')}</Button>
      </Card>
      <Card title={t('Saved tables', 'الجداول المحفوظة')}>
        <AsyncView state={state}>
          {(rows) => (
            <Table rows={rows} empty={t('No tax tables yet.', 'لا جداول ضريبية بعد.')} columns={[
              { key: 'effective_from', label: t('From', 'من'), render: (r) => formatDate(r.effective_from) },
              { key: 'label', label: t('Label', 'التسمية') },
              { key: 'brackets', label: t('Brackets', 'الشرائح'), render: (r) => `${(r.brackets || []).length} tiers` },
            ]} />
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
