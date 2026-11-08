import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useAsync } from '../../lib/useAsync';
import { useLiveReload } from '../../lib/live';
import { useI18n } from '../../lib/i18n';
import { formatDate, formatDateTime } from '../../lib/format';
import { methodLabel } from '../../lib/receipts';
import { cleanTerm, searchStudents, sendOverdueReminders } from '../../lib/finance';
import { colors } from '../../lib/theme';
import {
  Screen, Card, Txt, Button, Field, ListItem, EmptyState, Money, useMoney, SectionHeader, Row, StatTile, TileGrid, LiveIndicator,
  PromptModal, HBar,
} from '..';

/** Finance "Today": live KPIs, latest receipts and quick actions (finance_today()). */
export default function FinanceTodayView() {
  const { t } = useI18n();
  const money = useMoney();
  const { caps } = useAuth();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [askDays, setAskDays] = useState(false);

  const q = useAsync(() => must(supabase.rpc('finance_today')), [], { enabled: caps.isFinanceViewer });
  // Every receipt (counter or PayHere) re-fetches the summary.
  const live = useLiveReload(['fee_receipts'], undefined, q.reload, caps.isFinanceViewer);

  if (!caps.isFinanceViewer) {
    return (
      <Screen>
        <EmptyState message={t('admin.forbidden')} icon="lock-closed-outline" />
      </Screen>
    );
  }

  const d = q.data || {};
  const methods = Object.entries(d.by_method || {}).sort((a, b) => Number(b[1]) - Number(a[1]));
  const methodMax = Math.max(0, ...methods.map(([, v]) => Number(v || 0)));
  const pendingApprovals = Number(d.pending_petty_cash || 0) + Number(d.pending_expenses || 0);
  const failed = Number(d.messages_failed_24h || 0);

  const search = async () => {
    if (cleanTerm(term).length < 2) {
      Alert.alert(t('fin.lookup'), t('counter.searchMin'));
      return;
    }
    setSearching(true);
    try {
      setResults((await searchStudents(term)) || []);
    } catch (e) {
      Alert.alert(t('common.error'), e?.message || t('common.error'));
    } finally {
      setSearching(false);
    }
  };

  const runReminders = (days) => {
    Alert.alert(t('fin.remindAllTitle'), t('fin.remindAllConfirm', { n: days }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('fin.send'),
        onPress: async () => {
          try {
            const r = await sendOverdueReminders(days);
            Alert.alert(t('fin.remindAllTitle'), t('fin.remindAllDone', { sent: r?.sent ?? 0, skipped: r?.skipped ?? 0 }));
          } catch (e) {
            Alert.alert(t('common.error'), e?.message || t('common.error'));
          }
        },
      },
    ]);
  };

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Row style={styles.between}>
        <Txt variant="h2">{t('fin.todayHeading', { date: formatDate(d.date) })}</Txt>
        <LiveIndicator live={live} />
      </Row>

      <TileGrid>
        <StatTile label={t('fin.collectedToday')} value={money(d.collected)} icon="cash-outline" />
        <StatTile label={t('fin.receiptsToday')} value={String(d.receipts ?? 0)} icon="receipt-outline" tone={colors.primaryDark} />
        <StatTile label={t('fin.onlineToday')} value={money(d.online)} icon="globe-outline" tone={colors.info} />
        <StatTile
          label={t('fin.outstandingAll')}
          value={money(d.outstanding)}
          icon="alert-circle-outline"
          tone={colors.danger}
          onPress={() => router.push('/finance/outstanding')}
        />
        <StatTile
          label={t('fin.pendingApprovals')}
          value={String(pendingApprovals)}
          sub={t('fin.pendingSplit', { petty: d.pending_petty_cash ?? 0, expenses: d.pending_expenses ?? 0 })}
          icon="hourglass-outline"
          tone={pendingApprovals ? colors.warning : colors.primary}
        />
        <StatTile
          label={t('fin.failedMessages')}
          value={String(failed)}
          icon="warning-outline"
          tone={failed ? colors.danger : colors.primary}
        />
      </TileGrid>

      {methods.length ? (
        <Card>
          <Txt variant="label">{t('fin.byMethodToday')}</Txt>
          {methods.map(([m, v]) => (
            <HBar key={m} label={methodLabel(t, m)} value={Number(v)} max={methodMax} display={money(v)} color={colors.gold} />
          ))}
        </Card>
      ) : null}

      <SectionHeader title={t('fin.actions')} />
      {caps.isFinanceStaff ? (
        <>
          <ListItem icon="cash-outline" iconColor={colors.gold} title={t('counter.title')} subtitle={t('counter.tileHint')} onPress={() => router.push('/receive-payment')} />
          <ListItem
            icon="megaphone-outline"
            iconColor={colors.danger}
            title={t('fin.remindAll')}
            subtitle={t('fin.remindAllHint')}
            onPress={() => setAskDays(true)}
          />
        </>
      ) : null}
      {caps.canViewAnalytics ? (
        <ListItem icon="bar-chart-outline" iconColor={colors.info} title={t('analytics.title')} subtitle={t('analytics.tileHint')} onPress={() => router.push('/analytics')} />
      ) : null}

      <Card>
        <Field
          label={t('fin.lookup')}
          placeholder={t('counter.searchPlaceholder')}
          value={term}
          onChangeText={setTerm}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <Button title={t('counter.search')} icon="search-outline" variant="outline" loading={searching} onPress={search} />
      </Card>
      {results && !results.length ? <EmptyState message={t('counter.noStudents')} icon="person-outline" /> : null}
      {(results || []).map((s) => (
        <ListItem
          key={s.id}
          icon="person-circle-outline"
          title={s.full_name}
          subtitle={[s.index_number, s.class_number ? t('common.classN', { n: s.class_number }) : null].filter(Boolean).join(' · ')}
          onPress={() => router.push(`/finance/student/${s.id}`)}
        />
      ))}

      <SectionHeader title={t('fin.latestReceipts')} />
      {q.data && !(d.latest || []).length ? <EmptyState message={t('fees.noReceipts')} icon="receipt-outline" /> : null}
      {(d.latest || []).map((r) => (
        <ListItem
          key={r.id}
          icon={r.method === 'payhere' ? 'globe-outline' : 'receipt-outline'}
          iconColor={r.method === 'payhere' ? colors.info : colors.primary}
          title={r.student}
          subtitle={[r.receipt_no, r.index_number, methodLabel(t, r.method)].filter(Boolean).join(' · ')}
          meta={formatDateTime(r.paid_at)}
          right={
            <View style={styles.right}>
              <Money amount={r.amount} tone="success" />
            </View>
          }
          onPress={() => router.push(`/receipt/${r.id}`)}
        />
      ))}

      <PromptModal
        visible={askDays}
        title={t('fin.remindAllTitle')}
        message={t('fin.minDaysHint')}
        label={t('fin.minDays')}
        initialValue="7"
        multiline={false}
        keyboardType="number-pad"
        confirmLabel={t('common.next')}
        onClose={() => setAskDays(false)}
        onSubmit={(v) => {
          const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
          if (!Number.isFinite(n) || n < 0 || n > 365) throw new Error(t('fin.minDaysInvalid'));
          // Let the modal close before the confirmation alert opens.
          setTimeout(() => runReminders(n), 350);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between', alignItems: 'center' },
  right: { alignItems: 'flex-end', gap: 4 },
});
