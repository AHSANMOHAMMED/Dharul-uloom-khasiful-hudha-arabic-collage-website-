import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useAsync } from '../lib/useAsync';
import { useLiveReload } from '../lib/live';
import { useI18n } from '../lib/i18n';
import { formatDate } from '../lib/format';
import { colors } from '../lib/theme';
import { accountName, dutyName } from '../lib/governance';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  KeyValue,
  ListItem,
  LiveIndicator,
  Loading,
  Money,
  Row,
  Screen,
  SectionHeader,
  StatTile,
  StatusBadge,
  TileGrid,
  Txt,
  useMoney,
} from '../components';

const DUTY_COLUMNS =
  'id, status, start_date, end_date, end_reason, is_lead, notes, duty_role_id, ' +
  'duty:duty_roles(id, code, name_en, name_ar, name_ta, category, description), ' +
  'meeting:mashoora_meetings(id, title, meeting_date, meeting_type), ' +
  'year:academic_years(name)';

const ENTRY_TONE = { topup: colors.primary, expense: colors.danger, return: colors.muted };
const ENTRY_ICON = { topup: 'arrow-down-circle-outline', expense: 'cart-outline', return: 'arrow-undo-outline' };

async function loadDuties(userId) {
  const assignments = await must(
    supabase.from('duty_assignments').select(DUTY_COLUMNS).eq('assignee_id', userId).order('start_date', { ascending: false }),
  );
  const active = assignments.filter((a) => a.status === 'active');
  const past = assignments.filter((a) => a.status !== 'active');
  const dutyIds = [...new Set(active.map((a) => a.duty_role_id))];

  let funds = [];
  if (dutyIds.length) {
    funds = await must(supabase.from('petty_cash_funds').select('id, duty_role_id, float_limit, is_active').in('duty_role_id', dutyIds));
  }
  const fundIds = funds.map((f) => f.id);
  const [balances, entries] = await Promise.all([
    Promise.all(fundIds.map((f) => must(supabase.rpc('petty_cash_balance', { p_fund: f })))),
    fundIds.length
      ? must(
          supabase
            .from('petty_cash_entries')
            .select('id, fund_id, entry_type, entry_date, amount, description, vendor, status, rejection_reason, account:accounts(code, name, name_ar)')
            .in('fund_id', fundIds)
            .order('entry_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(100),
        )
      : Promise.resolve([]),
  ]);
  const fundByDuty = {};
  funds.forEach((f, i) => {
    fundByDuty[f.duty_role_id] = { ...f, balance: balances[i] || {}, entries: entries.filter((e) => e.fund_id === f.id).slice(0, 5) };
  });
  return { active, past, fundByDuty };
}

function DutyHistory({ dutyId }) {
  const { t } = useI18n();
  const q = useAsync(() => must(supabase.rpc('duty_history', { p_duty: dutyId })), [dutyId], { reloadOnFocus: false });
  if (q.loading) return <Loading inline />;
  if (q.error) return <Txt variant="small" style={styles.error}>{q.error}</Txt>;
  const rows = q.data?.assignments || [];
  if (!rows.length) return <Txt variant="small">{t('common.none')}</Txt>;
  return rows.map((a) => (
    <Txt key={a.id} variant="small">
      {[
        a.assignee,
        `${formatDate(a.start_date)} → ${a.end_date ? formatDate(a.end_date) : t('duty.present')}`,
        a.meeting ? t('duty.decidedAt', { meeting: a.meeting }) : null,
      ]
        .filter(Boolean)
        .join(' · ')}
    </Txt>
  ));
}

function ActiveDuty({ a, fund }) {
  const { t, lang } = useI18n();
  const money = useMoney();
  const [showHistory, setShowHistory] = useState(false);
  const name = dutyName(a.duty, lang);
  return (
    <Card accent={colors.gold}>
      <Row style={styles.between}>
        <Txt variant="h2" style={styles.flex}>{name}</Txt>
        <StatusBadge status="active" />
      </Row>
      {a.duty?.category ? <Badge label={t(`duty.category.${a.duty.category}`)} tone="gold" /> : null}
      <Txt variant="small">{t('duty.since', { date: formatDate(a.start_date) })}</Txt>
      {a.meeting ? <Txt variant="small">{t('duty.decidedAt', { meeting: `${a.meeting.title} (${formatDate(a.meeting.meeting_date)})` })}</Txt> : null}
      {a.year?.name ? <Txt variant="small">{t('duty.academicYear', { year: a.year.name })}</Txt> : null}
      {a.duty?.description ? <Txt variant="muted">{a.duty.description}</Txt> : null}
      {a.notes ? <Txt variant="muted">{a.notes}</Txt> : null}

      {fund ? (
        <>
          <Txt variant="label">{t('petty.title')}</Txt>
          <TileGrid>
            <StatTile label={t('petty.available')} value={money(fund.balance.available)} icon="wallet-outline" tone={colors.primary} />
            <StatTile label={t('petty.pending')} value={money(fund.balance.pending_spend)} icon="hourglass-outline" tone={colors.warning} />
          </TileGrid>
          <KeyValue label={t('petty.posted')} value={<Money amount={fund.balance.posted_balance} />} />
          {Number(fund.float_limit) > 0 ? <KeyValue label={t('petty.limit')} value={<Money amount={fund.float_limit} />} /> : null}
          <Txt variant="label">{t('petty.recent')}</Txt>
          {!fund.entries.length ? <Txt variant="small">{t('petty.noEntries')}</Txt> : null}
          {fund.entries.map((e) => (
            <ListItem
              key={e.id}
              icon={ENTRY_ICON[e.entry_type]}
              iconColor={ENTRY_TONE[e.entry_type]}
              title={`${t(`petty.type.${e.entry_type}`)} · ${money(e.amount)}`}
              subtitle={[e.description, e.vendor].filter(Boolean).join(' · ')}
              meta={[formatDate(e.entry_date), accountName(e.account, lang), e.rejection_reason].filter(Boolean).join(' · ')}
              right={<StatusBadge status={e.status} />}
            />
          ))}
          {fund.is_active ? (
            <Button
              title={t('petty.recordSpend')}
              icon="receipt-outline"
              variant="gold"
              onPress={() => router.push({ pathname: '/petty-cash-spend', params: { fund: fund.id, duty: name } })}
            />
          ) : (
            <Txt variant="small">{t('petty.inactive')}</Txt>
          )}
        </>
      ) : null}

      <Button
        small
        variant="ghost"
        icon={showHistory ? 'chevron-up' : 'time-outline'}
        title={showHistory ? t('duty.hideHolders') : t('duty.holders')}
        onPress={() => setShowHistory(!showHistory)}
      />
      {showHistory ? <DutyHistory dutyId={a.duty_role_id} /> : null}
    </Card>
  );
}

export default function MyDuties() {
  const { t, lang } = useI18n();
  const { user, caps } = useAuth();
  const enabled = !!user && caps.isEmployee;
  const q = useAsync(() => loadDuties(user.id), [user?.id], { enabled });
  const live = useLiveReload(['duty_assignments', 'petty_cash_entries'], undefined, q.reload, enabled);

  if (!caps.isEmployee) {
    return (
      <Screen>
        <EmptyState message={t('admin.forbidden')} icon="lock-closed-outline" />
      </Screen>
    );
  }

  const active = q.data?.active || [];
  const past = q.data?.past || [];
  const fundByDuty = q.data?.fundByDuty || {};

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <LiveIndicator live={live} />
      <SectionHeader title={t('duty.active')} />
      {!active.length ? <EmptyState message={t('duty.noneActive')} icon="ribbon-outline" /> : null}
      {active.map((a) => (
        <ActiveDuty key={a.id} a={a} fund={fundByDuty[a.duty_role_id]} />
      ))}

      <SectionHeader title={t('duty.past')} />
      {!past.length ? <EmptyState message={t('duty.nonePast')} icon="archive-outline" /> : null}
      {past.map((a) => (
        <ListItem
          key={a.id}
          icon="ribbon-outline"
          iconColor={colors.muted}
          title={dutyName(a.duty, lang)}
          subtitle={`${formatDate(a.start_date)} → ${formatDate(a.end_date)}`}
          meta={[a.meeting ? t('duty.decidedAt', { meeting: a.meeting.title }) : null, a.end_reason].filter(Boolean).join(' · ') || undefined}
          right={<StatusBadge status={a.status} />}
        />
      ))}
      <Button variant="outline" icon="people-outline" title={t('mashoora.title')} onPress={() => router.push('/mashoora')} />
      <Button variant="ghost" icon="help-circle-outline" title={t('duty.help')} onPress={() => Alert.alert(t('duty.title'), t('duty.helpBody'))} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between' },
  flex: { flex: 1 },
  error: { color: colors.danger },
});
