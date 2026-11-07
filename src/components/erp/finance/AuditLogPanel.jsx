import { Fragment, useState } from 'react';
import { AsyncView, Badge, Button, Card, Field, Input, PageHeader, Select, useAsync, useLang } from '../ui';
import { query } from '../../../lib/erp/rpc';
import { profilesMap } from '../../../lib/erp/financeApi';
import { DateRange, FilterBar } from './shared';

const PAGE = 25;
const TABLES = [
  'accounts', 'journal_entries', 'expenses', 'donations', 'student_fees', 'fee_payments', 'fee_invoice_lines',
  'student_fee_concessions', 'fee_structures', 'staff_salary_profiles', 'payroll_runs', 'staff_advances',
  'staff_leave_requests', 'payment_transactions', 'tutor_salaries', 'staff_hr', 'profiles', 'organizations',
  'parent_children', 'org_invitations', 'student_results', 'valid_index_numbers',
];
const ACTION_TONE = { INSERT: 'green', UPDATE: 'amber', DELETE: 'red' };

const show = (v) => (v === null || v === undefined ? '∅' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function Diff({ log }) {
  const { t } = useLang();
  if (log.action === 'UPDATE') {
    const fields = log.changed_fields || [];
    if (!fields.length) return <p className="text-xs text-gray-500">{t('No field changes recorded', 'لا توجد تغييرات مسجلة')}</p>;
    return (
      <table className="w-full text-xs">
        <thead className="text-gray-400">
          <tr>
            <th className="text-start py-1 pe-3">{t('Field', 'الحقل')}</th>
            <th className="text-start py-1 pe-3">{t('Old', 'القديم')}</th>
            <th className="text-start py-1">{t('New', 'الجديد')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {fields.map((f) => (
            <tr key={f}>
              <td className="py-1 pe-3 font-mono text-gray-300 align-top">{f}</td>
              <td className="py-1 pe-3 text-red-300 break-all align-top">{show(log.old_data?.[f])}</td>
              <td className="py-1 text-emerald-300 break-all align-top">{show(log.new_data?.[f])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  const data = log.action === 'INSERT' ? log.new_data : log.old_data;
  return (
    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
      {Object.entries(data || {}).map(([k, v]) => (
        <div key={k} className="flex gap-2 min-w-0">
          <span className="font-mono text-gray-400 shrink-0">{k}</span>
          <span className={`break-all ${log.action === 'DELETE' ? 'text-red-300' : 'text-gray-200'}`}>{show(v)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AuditLogPanel() {
  const { t } = useLang();
  const [filters, setFilters] = useState({ table: '', action: '', from: '', to: '', record: '' });
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState({});
  const setF = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  };

  const [state, reload] = useAsync(async () => {
    const rows = await query('audit_logs', (q) => {
      let b = q
        .select('id, table_name, record_id, action, actor_id, actor_role, changed_fields, old_data, new_data, created_at')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE);
      if (filters.table) b = b.eq('table_name', filters.table);
      if (filters.action) b = b.eq('action', filters.action);
      if (filters.from) b = b.gte('created_at', `${filters.from}T00:00:00`);
      if (filters.to) b = b.lte('created_at', `${filters.to}T23:59:59.999`);
      if (filters.record.trim()) b = b.eq('record_id', filters.record.trim());
      return b;
    });
    const hasMore = rows.length > PAGE;
    const list = rows.slice(0, PAGE);
    const people = await profilesMap(list.map((r) => r.actor_id));
    return { list, hasMore, people };
  }, [filters.table, filters.action, filters.from, filters.to, filters.record, page]);

  return (
    <div>
      <PageHeader
        title={t('Audit log', 'سجل التدقيق')}
        subtitle={t('Every change to finance, HR and identity records, with before/after values.', 'كل تغيير على السجلات المالية والبشرية والهوية مع القيم قبل وبعد.')}
      />
      <Card
        actions={
          <Button size="sm" variant="secondary" onClick={reload}>
            {t('Refresh', 'تحديث')}
          </Button>
        }
      >
        <FilterBar>
          <Field label={t('Table', 'الجدول')}>
            <Select value={filters.table} onChange={(e) => setF({ table: e.target.value })} placeholder={t('All tables', 'كل الجداول')} options={TABLES.map((x) => ({ value: x, label: x }))} />
          </Field>
          <Field label={t('Action', 'العملية')}>
            <Select
              value={filters.action}
              onChange={(e) => setF({ action: e.target.value })}
              placeholder={t('All', 'الكل')}
              options={[
                { value: 'INSERT', label: t('Insert', 'إضافة') },
                { value: 'UPDATE', label: t('Update', 'تعديل') },
                { value: 'DELETE', label: t('Delete', 'حذف') },
              ]}
            />
          </Field>
          <DateRange from={filters.from} to={filters.to} onChange={(r) => setF(r)} />
          <Field label={t('Record ID', 'معرّف السجل')}>
            <Input value={filters.record} onChange={(e) => setF({ record: e.target.value })} placeholder="uuid" />
          </Field>
        </FilterBar>
        <AsyncView state={state}>
          {({ list, hasMore, people }) => (
            <>
              {list.length ? (
                <div className="overflow-x-auto rounded-xl border border-gray-800">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-900/80 text-gray-400">
                      <tr>
                        <th className="px-3 py-2 text-start">{t('When', 'الوقت')}</th>
                        <th className="px-3 py-2 text-start">{t('Table', 'الجدول')}</th>
                        <th className="px-3 py-2 text-start">{t('Action', 'العملية')}</th>
                        <th className="px-3 py-2 text-start">{t('Actor', 'المنفّذ')}</th>
                        <th className="px-3 py-2 text-start">{t('Changed', 'المتغير')}</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {list.map((log) => (
                        <Fragment key={log.id}>
                          <tr className="hover:bg-gray-900/50">
                            <td className="px-3 py-2 whitespace-nowrap text-gray-300">{new Date(log.created_at).toLocaleString('en-GB')}</td>
                            <td className="px-3 py-2">
                              <div className="font-mono text-xs">{log.table_name}</div>
                              <div className="font-mono text-[10px] text-gray-500 break-all">{log.record_id}</div>
                            </td>
                            <td className="px-3 py-2">
                              <Badge tone={ACTION_TONE[log.action]}>{log.action}</Badge>
                            </td>
                            <td className="px-3 py-2">
                              <div>{people[log.actor_id]?.full_name || (log.actor_id ? log.actor_id.slice(0, 8) : t('System', 'النظام'))}</div>
                              <div className="text-xs text-gray-500">{log.actor_role}</div>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-400 max-w-xs">{(log.changed_fields || []).join(', ') || '—'}</td>
                            <td className="px-3 py-2 text-end">
                              <Button size="sm" variant="ghost" onClick={() => setExpanded((x) => ({ ...x, [log.id]: !x[log.id] }))}>
                                {expanded[log.id] ? t('Hide', 'إخفاء') : t('Details', 'التفاصيل')}
                              </Button>
                            </td>
                          </tr>
                          {expanded[log.id] && (
                            <tr className="bg-gray-950/60">
                              <td colSpan={6} className="px-4 py-3">
                                <Diff log={log} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8 text-sm">{t('No audit entries match these filters', 'لا توجد سجلات مطابقة')}</p>
              )}
              <div className="flex items-center justify-between mt-4">
                <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  {t('← Newer', '→ الأحدث')}
                </Button>
                <span className="text-xs text-gray-400">
                  {t('Page', 'صفحة')} {page + 1}
                </span>
                <Button size="sm" variant="secondary" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
                  {t('Older →', 'الأقدم ←')}
                </Button>
              </div>
            </>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
