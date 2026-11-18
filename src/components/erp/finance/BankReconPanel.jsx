import { useState } from 'react';
import { AsyncView, Badge, Button, Card, Field, Input, Table, Textarea, useAsync, useLang } from '../ui';
import { formatDate, formatMoney, query, rpc, today } from '../../../lib/erp/rpc';
import { useAction } from '../campus/hooks';

export default function BankReconPanel() {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [form, setForm] = useState({ date: today(), amount: '', reference: '', description: '' });
  const [matchPay, setMatchPay] = useState({});
  const [state, reload] = useAsync(
    () => query('bank_statement_lines', (q) =>
      q.select('*').eq('status', 'unmatched').order('statement_date', { ascending: false }).limit(100)),
    [],
  );

  const add = async () => {
    const res = await run(() => rpc('add_bank_statement_line', {
      p_date: form.date,
      p_amount: Number(form.amount),
      p_reference: form.reference || null,
      p_description: form.description || null,
    }), t('Line added', 'تمت إضافة السطر'));
    if (res.ok) {
      setForm({ date: today(), amount: '', reference: '', description: '' });
      reload();
    }
  };

  const match = async (id) => {
    const payment = matchPay[id]?.trim();
    if (!payment) return;
    const res = await run(() => rpc('match_bank_statement_line', {
      p_line: id,
      p_payment: payment,
      p_txn: null,
    }), t('Matched', 'تمت المطابقة'));
    if (res.ok) reload();
  };

  const ignore = async (id) => {
    const res = await run(() => rpc('ignore_bank_statement_line', { p_line: id, p_reason: 'manual' }), t('Ignored', 'تم التجاهل'));
    if (res.ok) reload();
  };

  return (
    <div className="space-y-4">
      <Card title={t('Add statement line', 'إضافة سطر كشف')}>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <Field label={t('Date', 'التاريخ')}><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label={t('Amount', 'المبلغ')}><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label={t('Reference', 'المرجع')}><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
          <Button disabled={busy || !form.amount} onClick={add}>{t('Add', 'إضافة')}</Button>
        </div>
        <div className="mt-2">
          <Field label={t('Description', 'الوصف')}>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card title={t('Unmatched bank lines', 'أسطر البنك غير المطابقة')}>
        <AsyncView state={state}>
          {(rows) => (
            <Table
              rows={rows}
              empty={t('No unmatched lines.', 'لا أسطر غير مطابقة.')}
              columns={[
                { key: 'statement_date', label: t('Date', 'التاريخ'), render: (r) => formatDate(r.statement_date) },
                { key: 'amount', label: t('Amount', 'المبلغ'), render: (r) => formatMoney(r.amount) },
                { key: 'reference', label: t('Ref', 'المرجع'), render: (r) => r.reference || '—' },
                { key: 'description', label: t('Description', 'الوصف'), render: (r) => r.description || '—' },
                { key: 'status', label: t('Status', 'الحالة'), render: (r) => <Badge tone="amber">{r.status}</Badge> },
                { key: 'actions', label: t('Match', 'مطابقة'), render: (r) => (
                  <div className="flex flex-wrap gap-1 items-center">
                    <Input
                      className="min-w-[10rem]"
                      placeholder={t('fee_payment UUID', 'معرّف الدفعة')}
                      value={matchPay[r.id] || ''}
                      onChange={(e) => setMatchPay((m) => ({ ...m, [r.id]: e.target.value }))}
                    />
                    <Button size="sm" disabled={busy} onClick={() => match(r.id)}>{t('Match', 'مطابقة')}</Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => ignore(r.id)}>{t('Ignore', 'تجاهل')}</Button>
                  </div>
                ) },
              ]}
            />
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
