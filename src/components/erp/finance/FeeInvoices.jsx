import { useMemo, useState } from 'react';
import { AsyncView, Badge, Button, Card, Field, Input, Modal, Select, StatusBadge, Table, useAsync, useLang } from '../ui';
import { useAuth } from '../../../context/AuthContext';
import { query, formatMoney, formatDate, currentMonth, today, downloadCsv } from '../../../lib/erp/rpc';
import { CLASS_OPTIONS, FEE_STATUSES, num, profilesMap, toOptions } from '../../../lib/erp/financeApi';
import { FilterBar, Num } from './shared';
import FeeInvoiceDetail from './FeeInvoiceDetail';
import FeeChargeForm from './FeeChargeForm';

async function loadInvoices({ month, cls, status }) {
  let studentIds = null;
  if (cls) {
    const students = await query('profiles', (q) => q.select('id').eq('account_type', 'student').eq('class_number', Number(cls)));
    studentIds = (students || []).map((s) => s.id);
    if (!studentIds.length) return [];
  }
  const rows = await query('student_fees', (q) => {
    let b = q
      .select('id, invoice_no, student_id, month, due_date, total_due, paid_amount, status, cancel_reason')
      .order('month', { ascending: false })
      .order('invoice_no', { ascending: true })
      .limit(1000);
    if (month) b = b.eq('month', month);
    if (status) b = b.eq('status', status);
    if (studentIds) b = b.in('student_id', studentIds);
    return b;
  });
  const people = await profilesMap((rows || []).map((r) => r.student_id));
  return (rows || []).map((r) => ({ ...r, student: people[r.student_id] }));
}

export default function FeeInvoices({ studentId = null, onClearStudent }) {
  const { t } = useLang();
  const { isFinanceStaff } = useAuth();
  const [filters, setFilters] = useState({ month: studentId ? '' : currentMonth(), cls: '', status: '', search: '' });
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [state, reload] = useAsync(() => loadInvoices(filters), [filters.month, filters.cls, filters.status]);
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));

  const rows = useMemo(() => {
    const s = filters.search.trim().toLowerCase();
    const list = (state.data || []).filter((r) => !studentId || r.student_id === studentId);
    if (!s) return list;
    return list.filter(
      (r) =>
        (r.invoice_no || '').toLowerCase().includes(s) ||
        (r.student?.full_name || '').toLowerCase().includes(s) ||
        (r.student?.index_number || '').toLowerCase().includes(s),
    );
  }, [state.data, filters.search, studentId]);

  const totals = rows.reduce(
    (acc, r) => ({ due: acc.due + num(r.total_due), paid: acc.paid + num(r.paid_amount) }),
    { due: 0, paid: 0 },
  );

  const exportCsv = () =>
    downloadCsv(
      `fee-invoices-${filters.month || 'all'}.csv`,
      rows.map((r) => ({
        invoice_no: r.invoice_no,
        student: r.student?.full_name,
        index_number: r.student?.index_number,
        class: r.student?.class_number,
        month: r.month,
        due_date: r.due_date,
        total_due: r.total_due,
        paid: r.paid_amount,
        balance: num(r.total_due) - num(r.paid_amount),
        status: r.status,
      })),
    );

  return (
    <Card
      title={t('Invoices', 'الفواتير')}
      actions={
        <>
          {studentId && (
            <Button size="sm" variant="secondary" onClick={onClearStudent}>
              {t('Showing one student — show all', 'عرض طالب واحد — عرض الكل')}
            </Button>
          )}
          {isFinanceStaff && (
            <Button size="sm" onClick={() => setAdding(true)}>
              + {t('Add charges', 'إضافة رسوم')}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!rows.length}>
            CSV
          </Button>
          <Button size="sm" variant="secondary" onClick={reload}>
            {t('Refresh', 'تحديث')}
          </Button>
        </>
      }
    >
      <FilterBar>
        <Field label={t('Month', 'الشهر')}>
          <Input type="month" value={filters.month} onChange={(e) => set({ month: e.target.value })} />
        </Field>
        <Field label={t('Class', 'الصف')}>
          <Select value={filters.cls} onChange={(e) => set({ cls: e.target.value })} placeholder={t('All classes', 'كل الصفوف')} options={CLASS_OPTIONS} />
        </Field>
        <Field label={t('Status', 'الحالة')}>
          <Select value={filters.status} onChange={(e) => set({ status: e.target.value })} placeholder={t('All', 'الكل')} options={toOptions(FEE_STATUSES, t)} />
        </Field>
        <Field label={t('Search', 'بحث')}>
          <Input value={filters.search} onChange={(e) => set({ search: e.target.value })} placeholder={t('Name, index or invoice no.', 'الاسم أو الرقم أو رقم الفاتورة')} />
        </Field>
      </FilterBar>

      <AsyncView state={state}>
        {() => (
          <>
            <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-3">
              <span>
                {t('Invoices', 'الفواتير')}: <b className="text-white">{rows.length}</b>
              </span>
              <span>
                {t('Total due', 'الإجمالي')}: <b className="text-white">{formatMoney(totals.due)}</b>
              </span>
              <span>
                {t('Paid', 'المدفوع')}: <b className="text-emerald-300">{formatMoney(totals.paid)}</b>
              </span>
              <span>
                {t('Balance', 'الرصيد')}: <b className="text-amber-300">{formatMoney(totals.due - totals.paid)}</b>
              </span>
            </div>
            <Table
              rows={rows}
              empty={t('No invoices match these filters', 'لا توجد فواتير مطابقة')}
              columns={[
                { key: 'invoice_no', label: t('Invoice', 'الفاتورة'), render: (r) => <span className="font-mono text-xs">{r.invoice_no || '—'}</span> },
                {
                  key: 'student',
                  label: t('Student', 'الطالب'),
                  render: (r) => (
                    <div>
                      <div>{r.student?.full_name || '—'}</div>
                      <div className="text-xs text-gray-500">
                        {r.student?.index_number || ''} {r.student?.class_number ? `· ${t('Class', 'الصف')} ${r.student.class_number}` : ''}
                      </div>
                    </div>
                  ),
                },
                { key: 'month', label: t('Month', 'الشهر') },
                { key: 'due_date', label: t('Due', 'الاستحقاق'), render: (r) => formatDate(r.due_date) },
                { key: 'total_due', label: t('Total', 'الإجمالي'), render: (r) => <Num>{formatMoney(r.total_due)}</Num> },
                { key: 'paid_amount', label: t('Paid', 'المدفوع'), render: (r) => <Num>{formatMoney(r.paid_amount)}</Num> },
                { key: 'balance', label: t('Balance', 'الرصيد'), render: (r) => <Num>{formatMoney(num(r.total_due) - num(r.paid_amount))}</Num> },
                {
                  key: 'status',
                  label: t('Status', 'الحالة'),
                  render: (r) => (
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge status={r.status} />
                      {['unpaid', 'partial'].includes(r.status) && r.due_date && r.due_date < today() && <Badge tone="red">{t('Overdue', 'متأخر')}</Badge>}
                    </div>
                  ),
                },
                {
                  key: 'open',
                  label: '',
                  render: (r) => (
                    <Button size="sm" variant="secondary" onClick={() => setSelected(r)}>
                      {t('Open', 'فتح')}
                    </Button>
                  ),
                },
              ]}
            />
          </>
        )}
      </AsyncView>

      {selected && (
        <FeeInvoiceDetail invoiceId={selected.id} student={selected.student} onClose={() => setSelected(null)} onChanged={reload} />
      )}

      <Modal open={adding} title={t('Add charges to a student', 'إضافة رسوم لطالب')} onClose={() => setAdding(false)}>
        {adding && (
          <FeeChargeForm
            onCancel={() => setAdding(false)}
            onDone={() => {
              setAdding(false);
              reload();
            }}
          />
        )}
      </Modal>
    </Card>
  );
}
