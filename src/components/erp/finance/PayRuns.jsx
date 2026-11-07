import { useState } from 'react';
import { AsyncView, Button, Card, Field, Input, StatusBadge, Table, useAsync, useLang } from '../ui';
import { useAuth } from '../../../context/AuthContext';
import { query, rpc, currentMonth, formatMoney, formatDate } from '../../../lib/erp/rpc';
import { profilesMap, runAction } from '../../../lib/erp/financeApi';
import { ConfirmModal, Num } from './shared';
import PayRunDetail from './PayRunDetail';

export default function PayRuns() {
  const { t } = useLang();
  const { isHrStaff, isAccountant } = useAuth();
  const canGenerate = isHrStaff || isAccountant;
  const [period, setPeriod] = useState(currentMonth());
  const [confirming, setConfirming] = useState(false);
  const [openRun, setOpenRun] = useState(null);

  const [state, reload] = useAsync(async () => {
    const runs = await query('payroll_runs', (q) => q.select('*').order('period', { ascending: false }).order('created_at', { ascending: false }).limit(60));
    const people = await profilesMap(runs.flatMap((r) => [r.created_by, r.approved_by, r.paid_by]));
    return { runs, people };
  }, []);

  const existing = (state.data?.runs || []).find((r) => r.period === period && r.status !== 'cancelled');

  return (
    <Card title={t('Payroll runs', 'مسيرات الرواتب')}>
      {canGenerate && (
        <div className="flex flex-wrap items-end gap-3 mb-5">
          <Field label={t('Pay period', 'فترة الراتب')}>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </Field>
          <Button onClick={() => setConfirming(true)} disabled={!/^\d{4}-\d{2}$/.test(period) || (existing && existing.status !== 'draft')}>
            {existing?.status === 'draft' ? t('Regenerate draft', 'إعادة إنشاء المسودة') : t('Generate payroll', 'إنشاء الرواتب')}
          </Button>
          {existing && existing.status !== 'draft' && (
            <span className="text-xs text-amber-300 pb-2">{t(`Payroll for ${period} is already ${existing.status}.`, `رواتب ${period} بحالة ${existing.status} بالفعل.`)}</span>
          )}
        </div>
      )}
      <AsyncView state={state}>
        {({ runs, people }) => (
          <Table
            rows={runs}
            empty={t('No payroll runs yet', 'لا توجد مسيرات رواتب بعد')}
            columns={[
              { key: 'period', label: t('Period', 'الفترة'), render: (r) => <span className="font-semibold">{r.period}</span> },
              { key: 'staff_count', label: t('Staff', 'الموظفون') },
              { key: 'total_gross', label: t('Gross', 'الإجمالي'), render: (r) => <Num>{formatMoney(r.total_gross)}</Num> },
              { key: 'total_net', label: t('Net', 'الصافي'), render: (r) => <Num>{formatMoney(r.total_net)}</Num> },
              { key: 'total_employer', label: t('Employer', 'صاحب العمل'), render: (r) => <Num>{formatMoney(r.total_employer)}</Num> },
              {
                key: 'people',
                label: t('Prepared / approved', 'الإعداد / الاعتماد'),
                render: (r) => (
                  <div className="text-xs">
                    <div>{people[r.created_by]?.full_name || '—'}</div>
                    {r.approved_by && (
                      <div className="text-gray-500">
                        ✓ {people[r.approved_by]?.full_name || '—'} · {formatDate(r.approved_at)}
                      </div>
                    )}
                  </div>
                ),
              },
              { key: 'status', label: t('Status', 'الحالة'), render: (r) => <StatusBadge status={r.status} /> },
              {
                key: 'open',
                label: '',
                render: (r) => (
                  <Button size="sm" variant="secondary" onClick={() => setOpenRun(r.id)}>
                    {t('Open', 'فتح')}
                  </Button>
                ),
              },
            ]}
          />
        )}
      </AsyncView>

      {openRun && <PayRunDetail runId={openRun} onClose={() => setOpenRun(null)} onChanged={reload} />}
      <ConfirmModal
        open={confirming}
        danger={false}
        title={t('Generate payroll', 'إنشاء الرواتب')}
        message={
          existing
            ? t(`Recalculate the draft payroll for ${period}? Manual payslip adjustments will be discarded.`, `إعادة حساب مسودة رواتب ${period}؟ ستُلغى التعديلات اليدوية.`)
            : t(`Generate payslips for ${period} from active salary profiles, leave and attendance?`, `إنشاء قسائم ${period} من ملفات الرواتب والإجازات والحضور؟`)
        }
        confirmLabel={t('Generate', 'إنشاء')}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          const res = await runAction(() => rpc('generate_payroll', { p_period: period }), t('Payroll generated', 'تم إنشاء الرواتب'));
          if (res) {
            reload();
            if (res.id) setOpenRun(res.id);
          }
          return Boolean(res);
        }}
      />
    </Card>
  );
}
