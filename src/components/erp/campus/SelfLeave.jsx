import { useEffect } from 'react';
import { AsyncView, Button, Card, Field, Input, Select, StatusBadge, Table, Textarea, useAsync, useLang } from '../ui';
import { formatDate, insertRow, query, rpc, today, updateRow } from '../../../lib/erp/rpc';
import { daysInclusive } from '../../../lib/erp/campusApi';
import { useAction, useForm } from './hooks';

export default function SelfLeave({ user }) {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [balance, reloadBalance] = useAsync(() => rpc('staff_leave_balance', {}), []);
  const [types] = useAsync(
    () => query('staff_leave_types', (q) => q.select('id, code, name, is_paid').eq('is_active', true).order('code')),
    []
  );
  const [mine, reloadMine] = useAsync(
    () =>
      query('staff_leave_requests', (q) =>
        q.select('*, staff_leave_types(name, code)').eq('profile_id', user.id).order('start_date', { ascending: false })
      ),
    [user.id]
  );
  const [form, set, setForm] = useForm({ leave_type_id: '', start_date: today(), end_date: today(), days: '1', reason: '' });

  // keep "days" in sync with the date range (user may still override, e.g. half days)
  useEffect(() => {
    const d = daysInclusive(form.start_date, form.end_date);
    setForm((f) => ({ ...f, days: d ? String(d) : f.days }));
  }, [form.start_date, form.end_date, setForm]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.leave_type_id || !form.reason.trim()) return;
    const res = await run(
      () =>
        insertRow('staff_leave_requests', {
          leave_type_id: form.leave_type_id,
          start_date: form.start_date,
          end_date: form.end_date,
          days: Number(form.days),
          reason: form.reason.trim(),
        }),
      t('Leave request submitted', 'تم تقديم طلب الإجازة')
    );
    if (res.ok) {
      setForm((f) => ({ ...f, reason: '' }));
      reloadMine();
      reloadBalance();
    }
  };

  const cancel = async (r) => {
    if (!window.confirm(t('Cancel this leave request?', 'إلغاء طلب الإجازة هذا؟'))) return;
    const res = await run(() => updateRow('staff_leave_requests', r.id, { status: 'cancelled' }), t('Request cancelled', 'تم الإلغاء'));
    if (res.ok) {
      reloadMine();
      reloadBalance();
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card title={t('My leave balance', 'رصيد إجازاتي')} actions={<span className="text-xs text-gray-500">{new Date().getFullYear()}</span>}>
        <AsyncView state={balance}>
          {(rows) => (
            <Table
              rows={rows}
              rowKey="leave_type_id"
              empty={t('No leave types configured.', 'لا توجد أنواع إجازات.')}
              columns={[
                { key: 'name', label: t('Type', 'النوع'), render: (r) => <span>{r.name}{!r.is_paid && <span className="text-xs text-amber-400 ms-2">{t('unpaid', 'غير مدفوعة')}</span>}</span> },
                { key: 'entitled', label: t('Entitled', 'المستحق') },
                { key: 'used', label: t('Used', 'المستخدم') },
                { key: 'pending', label: t('Pending', 'معلق') },
                { key: 'remaining', label: t('Remaining', 'المتبقي'), render: (r) => <span className="font-bold text-emerald-300">{r.remaining}</span> },
              ]}
            />
          )}
        </AsyncView>
      </Card>

      <Card title={t('Request leave', 'طلب إجازة')}>
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t('Leave type', 'نوع الإجازة')}>
            <Select
              required
              value={form.leave_type_id}
              onChange={set('leave_type_id')}
              placeholder={t('Select…', 'اختر…')}
              options={(types.data || []).map((x) => ({ value: x.id, label: `${x.name}${x.is_paid ? '' : ` (${t('unpaid', 'غير مدفوعة')})`}` }))}
            />
          </Field>
          <Field label={t('Days', 'الأيام')} hint={t('Use 0.5 for a half day', 'استخدم 0.5 لنصف يوم')}>
            <Input type="number" min="0.5" step="0.5" required value={form.days} onChange={set('days')} />
          </Field>
          <Field label={t('From', 'من')}>
            <Input type="date" required value={form.start_date} onChange={set('start_date')} />
          </Field>
          <Field label={t('To', 'إلى')}>
            <Input type="date" required min={form.start_date} value={form.end_date} onChange={set('end_date')} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('Reason', 'السبب')}>
              <Textarea required value={form.reason} onChange={set('reason')} />
            </Field>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={busy}>{t('Submit request', 'إرسال الطلب')}</Button>
          </div>
        </form>
      </Card>

      <div className="xl:col-span-2">
        <Card title={t('My leave requests', 'طلبات إجازتي')}>
          <AsyncView state={mine}>
            {(rows) => (
              <Table
                rows={rows}
                empty={t('No leave requests yet.', 'لا توجد طلبات بعد.')}
                columns={[
                  { key: 'type', label: t('Type', 'النوع'), render: (r) => r.staff_leave_types?.name || '—' },
                  { key: 'start_date', label: t('From', 'من'), render: (r) => formatDate(r.start_date) },
                  { key: 'end_date', label: t('To', 'إلى'), render: (r) => formatDate(r.end_date) },
                  { key: 'days', label: t('Days', 'الأيام') },
                  { key: 'reason', label: t('Reason', 'السبب') },
                  { key: 'status', label: t('Status', 'الحالة'), render: (r) => <StatusBadge status={r.status} /> },
                  { key: 'review_note', label: t('Reviewer note', 'ملاحظة المراجع') },
                  {
                    key: 'act',
                    label: '',
                    render: (r) =>
                      r.status === 'pending' ? (
                        <Button size="sm" variant="danger" disabled={busy} onClick={() => cancel(r)}>{t('Cancel', 'إلغاء')}</Button>
                      ) : null,
                  },
                ]}
              />
            )}
          </AsyncView>
        </Card>
      </div>
    </div>
  );
}
