import { AsyncView, Badge, Card, PageHeader, Table, useAsync, useLang } from '../ui';
import { query } from '../../../lib/erp/rpc';
import { formatDate } from '../../../lib/erp/rpc';

export default function JobRunsPanel() {
  const { t } = useLang();
  const [state] = useAsync(
    () => query('platform_job_runs', (q) =>
      q.select('*').order('started_at', { ascending: false }).limit(100)),
    [],
  );

  return (
    <div>
      <PageHeader
        title={t('Scheduled job runs', 'تشغيل المهام المجدولة')}
        subtitle={t('Last success/failure from Edge cron workers (fees, outbound).',
          'آخر نجاح/فشل من مهام الحافة المجدولة.')}
      />
      <Card>
        <AsyncView state={state}>
          {(rows) => (
            <Table rows={rows} empty={t('No job runs recorded yet.', 'لا تشغيلات مسجّلة بعد.')} columns={[
              { key: 'job_name', label: t('Job', 'المهمة') },
              { key: 'status', label: t('Status', 'الحالة'), render: (r) => (
                <Badge tone={r.status === 'success' ? 'green' : r.status === 'failed' ? 'red' : 'amber'}>{r.status}</Badge>
              ) },
              { key: 'started_at', label: t('Started', 'البدء'), render: (r) => formatDate(r.started_at) },
              { key: 'finished_at', label: t('Finished', 'الانتهاء'), render: (r) => formatDate(r.finished_at) },
              { key: 'message', label: t('Message', 'الرسالة'), render: (r) => r.message || r.error || '—' },
            ]} />
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
