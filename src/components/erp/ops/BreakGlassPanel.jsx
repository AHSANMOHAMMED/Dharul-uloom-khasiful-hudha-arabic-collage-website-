import { useState } from 'react';
import { AsyncView, Badge, Button, Card, Field, PageHeader, Select, Table, Textarea, useAsync, useLang } from '../ui';
import { query, rpc } from '../../../lib/erp/rpc';
import { useAction } from '../campus/hooks';

/** MFA-gated break-glass requests. Production use requires institutional policy. */
export default function BreakGlassPanel() {
  const { t } = useLang();
  const [busy, run] = useAction();
  const [reason, setReason] = useState('');
  const [scope, setScope] = useState('read_student_records');
  const [state, reload] = useAsync(async () => {
    await rpc('expire_break_glass').catch(() => null);
    return query('break_glass_requests', (q) =>
      q.select('*, requester:profiles!requester_id(full_name)')
        .order('created_at', { ascending: false }).limit(50));
  }, []);

  const request = async () => {
    const res = await run(() => rpc('request_break_glass', {
      p_reason: reason,
      p_scope: scope,
      p_target_student: null,
    }), t('Break-glass requested', 'تم طلب الوصول الطارئ'));
    if (res.ok) { setReason(''); reload(); }
  };

  const decide = async (row, approve) => {
    const hours = approve ? Number(window.prompt(t('Hours (max 24)', 'الساعات (حد أقصى 24)'), '4') || 4) : 4;
    const res = await run(() => rpc('decide_break_glass', {
      p_request: row.id,
      p_approve: approve,
      p_hours: hours,
      p_notes: null,
    }), approve ? t('Approved', 'تمت الموافقة') : t('Denied', 'مرفوض'));
    if (res.ok) reload();
  };

  return (
    <div>
      <PageHeader
        title={t('Break-glass access', 'الوصول الطارئ')}
        subtitle={t('Time-boxed elevated read access. Institutional policy required before production use.',
          'وصول قراءة مرتفع ومحدود زمنياً. يلزم سياسة مؤسسية قبل الإنتاج.')}
      />
      <Card title={t('New request', 'طلب جديد')} className="mb-4">
        <div className="space-y-3 max-w-xl">
          <Field label={t('Scope', 'النطاق')}>
            <Select value={scope} onChange={(e) => setScope(e.target.value)} options={[
              { value: 'read_student_records', label: t('Student records', 'سجلات الطلاب') },
              { value: 'read_finance', label: t('Finance', 'المالية') },
              { value: 'read_welfare', label: t('Welfare', 'الرعاية') },
              { value: 'read_all', label: t('All (read)', 'الكل (قراءة)') },
            ]} />
          </Field>
          <Field label={t('Reason', 'السبب')}>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button disabled={busy || !reason.trim()} onClick={request}>{t('Submit request', 'إرسال الطلب')}</Button>
        </div>
      </Card>
      <AsyncView state={state}>
        {(rows) => (
          <Table rows={rows} empty={t('No requests.', 'لا توجد طلبات.')} columns={[
            { key: 'requester', label: t('Requester', 'مقدم الطلب'), render: (r) => r.requester?.full_name || '—' },
            { key: 'scope', label: t('Scope', 'النطاق') },
            { key: 'reason', label: t('Reason', 'السبب') },
            { key: 'status', label: t('Status', 'الحالة'), render: (r) => <Badge>{r.status}</Badge> },
            {
              key: 'act', label: '',
              render: (r) => r.status === 'pending' ? (
                <div className="flex gap-1">
                  <Button size="sm" disabled={busy} onClick={() => decide(r, true)}>{t('Approve', 'موافقة')}</Button>
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => decide(r, false)}>{t('Deny', 'رفض')}</Button>
                </div>
              ) : null,
            },
          ]} />
        )}
      </AsyncView>
    </div>
  );
}
