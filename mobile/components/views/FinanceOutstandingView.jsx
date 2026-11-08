import { useState } from 'react';
import { router } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import { Screen, ListItem, EmptyState, Chips, Money, Card, Txt, Button, useMoney } from '..';

const CLASSES = [1, 2, 3, 4, 5, 6, 7];

export default function FinanceOutstandingView() {
  const { t } = useI18n();
  const { caps } = useAuth();
  const money = useMoney();
  const [cls, setCls] = useState(null);
  const q = useAsync(() => must(supabase.rpc('fee_outstanding', { p_class: cls })), [cls], { enabled: caps.isFinanceViewer });

  if (!caps.isFinanceViewer) {
    return (
      <Screen>
        <EmptyState message={t('admin.forbidden')} icon="lock-closed-outline" />
      </Screen>
    );
  }

  const rows = q.data || [];
  const total = rows.reduce((s, r) => s + Number(r.balance || 0), 0);

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      {caps.isFinanceStaff ? (
        <Button title={t('counter.title')} icon="cash-outline" variant="gold" onPress={() => router.push('/receive-payment')} />
      ) : null}
      <Chips
        options={[{ value: null, label: t('admin.allClasses') }, ...CLASSES.map((c) => ({ value: c, label: t('common.classN', { n: c }) }))]}
        value={cls}
        onChange={setCls}
      />
      <Card>
        <Txt variant="label">{t('admin.outstandingTotal')}</Txt>
        <Txt variant="title">{money(total)}</Txt>
      </Card>
      {!rows.length ? <EmptyState message={t('admin.noOutstanding')} icon="checkmark-circle-outline" /> : null}
      {rows.map((r) => (
        <ListItem
          key={r.student_id}
          title={r.full_name}
          subtitle={`${r.index_number || '—'} · ${t('common.classN', { n: r.class_number ?? '—' })} · ${t('admin.openInvoices', { n: r.open_invoices })}`}
          meta={r.days_overdue > 0 ? t('admin.daysOverdue', { n: r.days_overdue }) : undefined}
          right={<Money amount={r.balance} tone="danger" />}
          onPress={() => router.push(`/finance/student/${r.student_id}`)}
        />
      ))}
    </Screen>
  );
}
