import { useState } from 'react';
import { Button, Card, Field, Input, Stat, useLang } from '../ui';
import { currentMonth, formatMoney, generateInvoicesInBatches } from '../../../lib/erp/rpc';
import { runAction } from '../../../lib/erp/financeApi';
import { ConfirmModal } from './shared';

export default function FeeGenerate() {
  const { t } = useLang();
  const [month, setMonth] = useState(currentMonth());
  const [tuition, setTuition] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);

  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);

  return (
    <Card title={t('Generate monthly invoices', 'إنشاء الفواتير الشهرية')}>
      <p className="text-sm text-gray-400 mb-4">
        {t(
          'Creates one invoice per active student for the month using the active monthly fee structures and concessions. Students who already have an invoice for the month are skipped, so running it twice is safe. Students and parents are notified.',
          'ينشئ فاتورة واحدة لكل طالب نشط للشهر وفق هياكل الرسوم الشهرية والإعفاءات الفعالة. يتم تخطي من لديهم فاتورة لنفس الشهر، لذا فإن التشغيل مرتين آمن. يتم إشعار الطلاب وأولياء الأمور.',
        )}
      </p>
      <div className="grid sm:grid-cols-3 gap-3 items-end">
        <Field label={t('Month', 'الشهر')}>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
        <Field
          label={t('Default tuition (optional)', 'الرسوم الافتراضية (اختياري)')}
          hint={t('Used only for students with no matching fee structure.', 'تُستخدم فقط للطلاب بدون هيكل رسوم مطابق.')}
        >
          <Input type="number" min="0" step="0.01" value={tuition} onChange={(e) => setTuition(e.target.value)} />
        </Field>
        <div>
          <Button onClick={() => setConfirming(true)} disabled={!valid}>
            {t('Generate invoices', 'إنشاء الفواتير')}
          </Button>
        </div>
      </div>

      {result && (
        <div className="mt-5 space-y-3">
          <div className="rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-200 px-4 py-3 text-sm">{result.message}</div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label={t('Generated', 'تم إنشاؤها')} value={result.generated} />
            <Stat label={t('Skipped', 'تم تخطيها')} value={result.skipped} tone="gray" />
            <Stat label={t('Total invoiced', 'إجمالي الفوترة')} value={formatMoney(result.total_amount)} tone="blue" />
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirming}
        danger={false}
        title={t('Generate invoices', 'إنشاء الفواتير')}
        message={t(`Generate invoices for ${month}? Invoices are posted to the ledger and notifications are sent.`, `إنشاء فواتير شهر ${month}؟ سيتم ترحيلها وإرسال الإشعارات.`)}
        confirmLabel={t('Generate', 'إنشاء')}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          const res = await runAction(() =>
            generateInvoicesInBatches({
              month,
              defaultTuition: Number(tuition) > 0 ? Number(tuition) : null,
              onProgress: (p) => setResult({ ...p, message: `${p.generated} … (${p.remaining} remaining)` }),
            }),
          );
          if (res) setResult(res);
          return Boolean(res);
        }}
      />
    </Card>
  );
}
