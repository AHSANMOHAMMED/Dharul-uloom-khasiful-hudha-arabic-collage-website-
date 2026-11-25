import { useState } from 'react';
import { AsyncView, Badge, Button, Card, Field, Input, Select, Table, Textarea, useAsync, useLang } from '../ui';
import { formatDate, formatMoney, query, rpc, today } from '../../../lib/erp/rpc';
import { useAction } from '../campus/hooks';

function parseBankCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const split = (row) => {
    const out = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < row.length; i += 1) {
      const ch = row[i];
      if (ch === '"') { q = !q; continue; }
      if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const header = split(lines[0]).map((h) => h.toLowerCase());
  const hasHeader = header.some((h) => /date|amount|ref|memo|desc/.test(h));
  const rows = hasHeader ? lines.slice(1) : lines;
  const idx = (names) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const di = hasHeader ? Math.max(0, idx(['date'])) : 0;
  const ai = hasHeader ? Math.max(1, idx(['amount'])) : 1;
  const ri = hasHeader ? idx(['ref', 'reference']) : 2;
  const mi = hasHeader ? idx(['memo', 'desc', 'description']) : 3;
  return rows.map((line) => {
    const cols = split(line);
    const date = cols[di];
    const amount = Number(String(cols[ai] || '').replace(/[^0-9.-]/g, ''));
    if (!date || !amount) return null;
    return {
      date,
      amount,
      reference: ri >= 0 ? cols[ri] || null : null,
      description: mi >= 0 ? cols[mi] || null : null,
    };
  }).filter(Boolean);
}

export default function BankReconPanel() {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [form, setForm] = useState({ date: today(), amount: '', reference: '', description: '' });
  const [matchPay, setMatchPay] = useState({});
  const [suggestions, setSuggestions] = useState({});
  const [csvText, setCsvText] = useState('');
  const [state, reload] = useAsync(
    () => query('bank_statement_lines', (q) =>
      q.select('*').eq('status', 'unmatched').order('statement_date', { ascending: false }).limit(100)),
    [],
  );
  const [payments] = useAsync(
    () => query('fee_payments', (q) =>
      q.select('id, receipt_no, amount, paid_at, student_id, status')
        .eq('status', 'posted')
        .order('paid_at', { ascending: false })
        .limit(80)),
    [],
  );

  const paymentOptions = (payments.data || []).map((p) => ({
    value: p.id,
    label: `${p.receipt_no || p.id.slice(0, 8)} · ${formatMoney(p.amount)} · ${formatDate(p.paid_at)}`,
  }));

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

  const importCsv = async () => {
    const rows = parseBankCsv(csvText);
    if (!rows.length) {
      window.alert(t('No valid CSV rows (need date,amount[,reference,description]).', 'لا صفوف CSV صالحة.'));
      return;
    }
    const res = await run(
      () => rpc('import_bank_statement_lines', { p_lines: rows }),
      (r) => `${r?.imported ?? 0} ${t('lines imported', 'سطر مستورد')}`,
    );
    if (res.ok) {
      setCsvText('');
      reload();
    }
  };

  const suggest = async (id) => {
    const res = await run(() => rpc('suggest_bank_matches', { p_line: id, p_day_window: 3 }), null);
    if (res.ok) {
      setSuggestions((s) => ({ ...s, [id]: res.data || [] }));
      const top = (res.data || [])[0];
      if (top?.id) setMatchPay((m) => ({ ...m, [id]: top.id }));
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
      <Card title={t('Import CSV', 'استيراد CSV')}>
        <p className="text-sm text-gray-400 mb-2">
          {t('Columns: date, amount, reference, description (header optional).', 'الأعمدة: date, amount, reference, description.')}
        </p>
        <Textarea rows={4} value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder={t('2026-11-01,2500.00,REF1,Tuition', '2026-11-01,2500.00,REF1,الرسوم')} />
        <div className="mt-2">
          <Button disabled={busy || !csvText.trim()} onClick={importCsv}>{t('Import lines', 'استيراد الأسطر')}</Button>
        </div>
      </Card>

      <Card title={t('Add statement line', 'إضافة سطر كشف')}>
        <p className="text-sm text-gray-400 mb-3">
          {t(
            'Enter bank lines manually, then match each to a posted fee receipt (or ignore).',
            'أدخل أسطر الكشف يدويًا ثم طابق كل سطر بإيصال رسوم مرحّل (أو تجاهله).',
          )}
        </p>
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
                  <div className="flex flex-col gap-1 min-w-[16rem]">
                    <div className="flex flex-wrap gap-1 items-center">
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => suggest(r.id)}>
                        {t('Suggest', 'اقتراح')}
                      </Button>
                      <Select
                        className="min-w-[12rem]"
                        value={matchPay[r.id] || ''}
                        onChange={(e) => setMatchPay((m) => ({ ...m, [r.id]: e.target.value }))}
                        placeholder={t('Select receipt', 'اختر إيصالاً')}
                        options={paymentOptions}
                      />
                      <Button size="sm" disabled={busy || !matchPay[r.id]} onClick={() => match(r.id)}>{t('Match', 'مطابقة')}</Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => ignore(r.id)}>{t('Ignore', 'تجاهل')}</Button>
                    </div>
                    {(suggestions[r.id] || []).length > 0 && (
                      <p className="text-xs text-gray-400">
                        {(suggestions[r.id] || []).slice(0, 3).map((s) => `${s.receipt_no || s.id?.slice?.(0, 8)} (${s.score})`).join(' · ')}
                      </p>
                    )}
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
