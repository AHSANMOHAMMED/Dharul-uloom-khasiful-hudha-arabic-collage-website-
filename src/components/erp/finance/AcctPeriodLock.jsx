import { useState } from 'react';
import { AsyncView, Button, Card, Field, Input, Stat, useAsync, useLang } from '../ui';
import { useAuth } from '../../../context/AuthContext';
import { query, rpc, formatDate } from '../../../lib/erp/rpc';
import { invalidateOrg, runAction } from '../../../lib/erp/financeApi';
import { ConfirmModal } from './shared';

export default function AcctPeriodLock() {
  const { t } = useLang();
  const { isAccountant, user } = useAuth();
  const [newDate, setNewDate] = useState('');
  const [confirm, setConfirm] = useState(null); // 'set' | 'clear'
  const [state, reload] = useAsync(
    () => query('organizations', (q) => q.select('id, name_en, books_locked_until').eq('id', user?.orgId).maybeSingle()),
    [user?.orgId],
  );

  const apply = async (value) => {
    const ok = await runAction(
      () => rpc('set_books_lock_date', { p_date: value }),
      value ? t('Books locked', 'تم إقفال الدفاتر') : t('Period lock removed', 'تمت إزالة الإقفال'),
    );
    if (ok) {
      invalidateOrg(user?.orgId);
      setNewDate('');
      reload();
    }
    return ok;
  };

  return (
    <Card title={t('Period lock', 'إقفال الفترة')}>
      <AsyncView state={state}>
        {(org) => (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-3">
              <Stat
                label={t('Books locked until', 'الدفاتر مقفلة حتى')}
                value={org?.books_locked_until ? formatDate(org.books_locked_until) : t('Not locked', 'غير مقفلة')}
                tone={org?.books_locked_until ? 'amber' : 'gray'}
                hint={t('No journal can be posted on or before this date.', 'لا يمكن ترحيل أي قيد في هذا التاريخ أو قبله.')}
              />
            </div>
            {isAccountant ? (
              <div className="flex flex-wrap items-end gap-3">
                <Field label={t('Lock books up to and including', 'إقفال الدفاتر حتى تاريخ (شاملًا)')}>
                  <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                </Field>
                <Button onClick={() => setConfirm('set')} disabled={!newDate}>
                  {t('Set lock date', 'تعيين تاريخ الإقفال')}
                </Button>
                {org?.books_locked_until && (
                  <Button variant="secondary" onClick={() => setConfirm('clear')}>
                    {t('Remove lock', 'إزالة الإقفال')}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t('Only accountants can change the lock date.', 'يمكن للمحاسبين فقط تغيير تاريخ الإقفال.')}</p>
            )}
            {newDate && org?.books_locked_until && newDate < org.books_locked_until && (
              <p className="text-xs text-amber-300">
                {t('This moves the lock date backwards and re-opens a closed period.', 'هذا يعيد تاريخ الإقفال للخلف ويعيد فتح فترة مغلقة.')}
              </p>
            )}
          </div>
        )}
      </AsyncView>
      <ConfirmModal
        open={Boolean(confirm)}
        danger={confirm === 'clear'}
        title={confirm === 'clear' ? t('Remove period lock', 'إزالة إقفال الفترة') : t('Lock accounting period', 'إقفال الفترة المحاسبية')}
        message={
          confirm === 'clear'
            ? t('All past periods will be open for posting again.', 'ستصبح كل الفترات السابقة مفتوحة للترحيل مجددًا.')
            : t(`Lock the books up to ${formatDate(newDate)}? Postings dated on or before it will be rejected.`, `إقفال الدفاتر حتى ${formatDate(newDate)}؟ سيتم رفض القيود في هذا التاريخ أو قبله.`)
        }
        onClose={() => setConfirm(null)}
        onConfirm={() => apply(confirm === 'clear' ? null : newDate)}
      />
    </Card>
  );
}
