import { useState } from 'react';
import { AsyncView, Badge, Button, Card, Field, Select, StatusBadge, Table, useAsync, useLang } from '../ui';
import { useAuth } from '../../../context/AuthContext';
import { query, rpc, deleteRow, formatMoney, formatDate, downloadCsv } from '../../../lib/erp/rpc';
import { fetchOrg, num, runAction } from '../../../lib/erp/financeApi';
import { ConfirmModal, DateRange, FilterBar, Num } from './shared';
import AcctJournalForm from './AcctJournalForm';

const SOURCES = ['manual', 'fee_invoice', 'fee_payment', 'fee_reversal', 'payroll', 'payroll_payment', 'expense', 'donation', 'opening_balance', 'reversal', 'adjustment'];
// Only stand-alone journals may be reversed here; sub-ledger postings (fees,
// payroll, expenses, donations, advances) must be reversed from their module
// so the source document stays in sync with the ledger.
const REVERSIBLE = ['manual', 'opening_balance'];

function JournalLines({ lines }) {
  const { t } = useLang();
  return (
    <table className="w-full text-xs mt-2 border border-gray-800 rounded-lg overflow-hidden">
      <thead className="bg-gray-900 text-gray-400">
        <tr>
          <th className="px-2 py-1 text-start">{t('Account', 'الحساب')}</th>
          <th className="px-2 py-1 text-start">{t('Memo', 'ملاحظة')}</th>
          <th className="px-2 py-1 text-end">{t('Debit', 'مدين')}</th>
          <th className="px-2 py-1 text-end">{t('Credit', 'دائن')}</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.id} className="border-t border-gray-800">
            <td className="px-2 py-1">
              <span className="font-mono">{l.account?.code}</span> {l.account?.name}
            </td>
            <td className="px-2 py-1 text-gray-400">{l.memo || ''}</td>
            <td className="px-2 py-1 text-end tabular-nums">{num(l.debit) ? formatMoney(l.debit) : ''}</td>
            <td className="px-2 py-1 text-end tabular-nums">{num(l.credit) ? formatMoney(l.credit) : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AcctJournals() {
  const { t } = useLang();
  const { isAccountant, user } = useAuth();
  const [filters, setFilters] = useState({ from: '', to: '', source: '', status: '' });
  const [expanded, setExpanded] = useState({});
  const [creating, setCreating] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [reversing, setReversing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const [state, reload] = useAsync(
    () =>
      query('journal_entries', (q) => {
        let b = q
          .select('id, entry_no, entry_date, description, source, status, reversal_of, reversed_by, posted_at, created_at, journal_lines(id, debit, credit, memo, account:accounts(code, name))')
          .order('entry_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(200);
        if (filters.from) b = b.gte('entry_date', filters.from);
        if (filters.to) b = b.lte('entry_date', filters.to);
        if (filters.source) b = b.eq('source', filters.source);
        if (filters.status) b = b.eq('status', filters.status);
        return b;
      }),
    [filters.from, filters.to, filters.source, filters.status],
  );

  const openForm = async () => {
    try {
      const org = await fetchOrg(user?.orgId);
      setLockedUntil(org?.books_locked_until || null);
    } catch {
      setLockedUntil(null);
    }
    setCreating(true);
  };

  const exportCsv = () =>
    downloadCsv(
      'journals.csv',
      (state.data || []).flatMap((e) =>
        (e.journal_lines || []).map((l) => ({
          entry_no: e.entry_no,
          date: e.entry_date,
          description: e.description,
          source: e.source,
          status: e.status,
          account: l.account?.code,
          account_name: l.account?.name,
          memo: l.memo,
          debit: l.debit,
          credit: l.credit,
        })),
      ),
    );

  return (
    <Card
      title={t('Journal entries', 'قيود اليومية')}
      actions={
        <>
          {isAccountant && (
            <Button size="sm" onClick={openForm}>
              + {t('New journal', 'قيد جديد')}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!state.data?.length}>
            CSV
          </Button>
          <Button size="sm" variant="secondary" onClick={reload}>
            {t('Refresh', 'تحديث')}
          </Button>
        </>
      }
    >
      <FilterBar>
        <DateRange from={filters.from} to={filters.to} onChange={(r) => setFilters((f) => ({ ...f, ...r }))} />
        <Field label={t('Source', 'المصدر')}>
          <Select
            value={filters.source}
            onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
            placeholder={t('All sources', 'كل المصادر')}
            options={SOURCES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
          />
        </Field>
        <Field label={t('Status', 'الحالة')}>
          <Select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            placeholder={t('All', 'الكل')}
            options={[
              { value: 'posted', label: t('Posted', 'مرحّل') },
              { value: 'draft', label: t('Draft', 'مسودة') },
            ]}
          />
        </Field>
      </FilterBar>
      <AsyncView state={state}>
        {(rows) => (
          <Table
            rows={rows}
            empty={t('No journal entries', 'لا توجد قيود')}
            columns={[
              { key: 'entry_no', label: t('No.', 'الرقم'), render: (e) => <span className="font-mono text-xs">{e.entry_no}</span> },
              { key: 'entry_date', label: t('Date', 'التاريخ'), render: (e) => formatDate(e.entry_date) },
              {
                key: 'description',
                label: t('Description', 'الوصف'),
                render: (e) => (
                  <div className="min-w-[16rem]">
                    <button type="button" className="text-start hover:text-emerald-300" onClick={() => setExpanded((x) => ({ ...x, [e.id]: !x[e.id] }))}>
                      {expanded[e.id] ? '▾' : '▸'} {e.description}
                    </button>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge>{e.source.replace(/_/g, ' ')}</Badge>
                      {e.reversed_by && <Badge tone="red">{t('Reversed', 'معكوس')}</Badge>}
                      {e.reversal_of && <Badge tone="amber">{t('Reversal', 'قيد عكسي')}</Badge>}
                    </div>
                    {expanded[e.id] && <JournalLines lines={e.journal_lines || []} />}
                  </div>
                ),
              },
              {
                key: 'amount',
                label: t('Amount', 'المبلغ'),
                render: (e) => <Num>{formatMoney((e.journal_lines || []).reduce((s, l) => s + num(l.debit), 0))}</Num>,
              },
              { key: 'status', label: t('Status', 'الحالة'), render: (e) => <StatusBadge status={e.status} /> },
              {
                key: 'actions',
                label: '',
                render: (e) =>
                  isAccountant && (
                    <div className="flex gap-1 justify-end">
                      {e.status === 'draft' && (
                        <>
                          <Button
                            size="sm"
                            onClick={async () => {
                              if (!window.confirm(t('Post this draft journal?', 'ترحيل مسودة القيد؟'))) return;
                              if (await runAction(() => rpc('post_journal_entry', { p_entry: e.id }), t('Journal posted', 'تم ترحيل القيد'))) reload();
                            }}
                          >
                            {t('Post', 'ترحيل')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleting(e)}>
                            {t('Delete', 'حذف')}
                          </Button>
                        </>
                      )}
                      {e.status === 'posted' && !e.reversed_by && !e.reversal_of && REVERSIBLE.includes(e.source) && (
                        <Button size="sm" variant="danger" onClick={() => setReversing(e)}>
                          {t('Reverse', 'عكس')}
                        </Button>
                      )}
                    </div>
                  ),
              },
            ]}
          />
        )}
      </AsyncView>

      {creating && (
        <AcctJournalForm
          lockedUntil={lockedUntil}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
      <ConfirmModal
        open={Boolean(reversing)}
        title={t('Reverse journal', 'عكس القيد')}
        message={reversing ? t(`Post an equal and opposite entry for ${reversing.entry_no}, dated today.`, `ترحيل قيد معاكس مساوٍ للقيد ${reversing.entry_no} بتاريخ اليوم.`) : ''}
        requireReason
        confirmLabel={t('Reverse', 'عكس')}
        onClose={() => setReversing(null)}
        onConfirm={async (reason) => {
          const ok = await runAction(() => rpc('reverse_journal_entry', { p_entry: reversing.id, p_reason: reason }), t('Journal reversed', 'تم عكس القيد'));
          if (ok) reload();
          return ok;
        }}
      />
      <ConfirmModal
        open={Boolean(deleting)}
        title={t('Delete draft', 'حذف المسودة')}
        message={deleting ? t(`Delete draft ${deleting.entry_no}?`, `حذف المسودة ${deleting.entry_no}؟`) : ''}
        confirmLabel={t('Delete', 'حذف')}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          const ok = await runAction(() => deleteRow('journal_entries', deleting.id), t('Draft deleted', 'تم حذف المسودة'));
          if (ok) reload();
          return ok;
        }}
      />
    </Card>
  );
}
