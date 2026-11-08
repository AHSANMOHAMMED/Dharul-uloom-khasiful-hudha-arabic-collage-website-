import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { formatDate, formatDateTime } from '../lib/format';
import { dutyName } from '../lib/governance';
import { ACTIVITY_STATUS_TONE, CATEGORY_ICON, labelOr } from '../lib/activities';
import { useResponsibilities, promptProps } from '../lib/useResponsibilities';
import { colors } from '../lib/theme';
import ActivityCard from '../components/ActivityCard';
import {
  Screen, Card, Txt, Button, Badge, SectionHeader, Row, EmptyState, ListItem, LiveIndicator, StatTile, TileGrid, PromptModal,
} from '../components';

// What each my_responsibilities().permissions flag lets the person do, and where.
const PERMISSIONS = [
  { key: 'finance', icon: 'cash-outline', href: '/finance' },
  { key: 'accountant', icon: 'calculator-outline' },
  { key: 'governance', icon: 'shield-checkmark-outline' },
  { key: 'leave_review', icon: 'document-text-outline' },
  { key: 'hr', icon: 'briefcase-outline' },
  { key: 'admissions', icon: 'school-outline' },
];

export default function Responsibilities() {
  const { t, lang } = useI18n();
  const { caps } = useAuth();
  const r = useResponsibilities({ enabled: caps.isEmployee });

  // Governance: every upcoming activity, to open its team.
  const all = useAsync(
    () =>
      must(
        supabase
          .from('activities')
          .select('id, title, category, starts_at, ends_at, location, status, assignees:activity_assignees(status)')
          .in('status', ['planned', 'ongoing'])
          .gte('starts_at', new Date(Date.now() - 7 * 86400000).toISOString())
          .order('starts_at')
          .limit(30),
      ),
    [],
    { enabled: caps.isGovernance },
  );

  if (!caps.isEmployee) {
    return (
      <Screen>
        <EmptyState message={t('admin.forbidden')} icon="lock-closed-outline" />
      </Screen>
    );
  }

  const d = r.q.data || {};
  const duties = d.duties || [];
  const activities = d.activities || [];
  const tasks = d.tasks || {};
  const perms = d.permissions || {};
  const granted = PERMISSIONS.filter((p) => perms[p.key]);

  const leaveHref = caps.canReviewStudentLeave ? '/staff/leaves' : null;

  return (
    <Screen
      loading={r.q.loading}
      error={r.q.error}
      onRefresh={() => {
        r.q.refresh();
        if (caps.isGovernance) all.reload();
      }}
      refreshing={r.q.refreshing}
    >
      <Row style={styles.between}>
        <Txt variant="muted" style={styles.flex}>{t('resp.intro')}</Txt>
        <LiveIndicator live={r.live} />
      </Row>

      <SectionHeader title={t('resp.activities')} />
      {r.q.data && !activities.length ? <EmptyState message={t('resp.noActivities')} icon="calendar-outline" /> : null}
      {activities.map((a) => (
        <ActivityCard
          key={a.activity_id}
          a={a}
          busy={r.busyFor(a.activity_id)}
          onRespond={(status) => r.respond(a.activity_id, status)}
          onPress={() => router.push(`/activity/${a.activity_id}`)}
        />
      ))}

      <SectionHeader title={t('resp.duties')} actionLabel={t('common.viewAll')} onAction={() => router.push('/duties')} />
      {r.q.data && !duties.length ? <Txt variant="muted">{t('duty.noneActive')}</Txt> : null}
      {duties.map((x) => (
        <ListItem
          key={x.assignment_id}
          icon="ribbon-outline"
          iconColor={colors.gold}
          title={dutyName(x, lang)}
          subtitle={t('duty.since', { date: formatDate(x.since) })}
          right={
            <View style={styles.badges}>
              {x.is_lead ? <Badge label={t('resp.lead')} tone="gold" /> : null}
              {x.grants_leave_review ? <Badge label={t('resp.leaveReviewDuty')} tone="info" /> : null}
            </View>
          }
          onPress={() => router.push('/duties')}
        >
          {x.petty_fund_id ? (
            <Button
              small
              variant="outline"
              icon="wallet-outline"
              title={t('petty.recordSpend')}
              onPress={() => router.push({ pathname: '/petty-cash-spend', params: { fund: x.petty_fund_id, duty: dutyName(x, lang) } })}
            />
          ) : null}
        </ListItem>
      ))}

      <SectionHeader title={t('resp.tasks')} actionLabel={t('task.boardTitle')} onAction={() => router.push('/tasks')} />
      <TileGrid>
        <StatTile label={t('task.status.todo')} value={String(tasks.todo ?? 0)} icon="ellipse-outline" tone={colors.muted} onPress={() => router.push('/tasks')} />
        <StatTile label={t('task.status.in_progress')} value={String(tasks.in_progress ?? 0)} icon="play-outline" tone={colors.info} onPress={() => router.push('/tasks')} />
        <StatTile label={t('task.status.review')} value={String(tasks.review ?? 0)} icon="eye-outline" tone={colors.warning} onPress={() => router.push('/tasks')} />
        <StatTile
          label={t('resp.overdue')}
          value={String(tasks.overdue ?? 0)}
          icon="alarm-outline"
          tone={tasks.overdue ? colors.danger : colors.primary}
          onPress={() => router.push('/tasks')}
        />
      </TileGrid>

      <SectionHeader title={t('resp.permissions')} />
      <Card>
        {!granted.length ? <Txt variant="muted">{t('resp.perm.none')}</Txt> : null}
        {granted.map((p) => {
          const href = p.key === 'leave_review' ? leaveHref : p.href;
          return (
            <Row key={p.key} style={styles.perm}>
              <Ionicons name={p.icon} size={18} color={colors.primary} />
              <Txt style={styles.flex}>{t(`resp.perm.${p.key}`)}</Txt>
              {href ? <Button small variant="ghost" title={t('common.open')} onPress={() => router.push(href)} /> : null}
            </Row>
          );
        })}
      </Card>

      {caps.isGovernance ? (
        <>
          <SectionHeader title={t('resp.allActivities')} />
          <Txt variant="small">{t('resp.allActivitiesHint')}</Txt>
          {all.error ? <Txt style={styles.err}>{all.error}</Txt> : null}
          {all.data && !all.data.length ? <EmptyState message={t('resp.noUpcoming')} icon="calendar-outline" /> : null}
          {(all.data || []).map((a) => {
            const list = a.assignees || [];
            const accepted = list.filter((x) => x.status === 'accepted' || x.status === 'done').length;
            return (
              <ListItem
                key={a.id}
                icon={CATEGORY_ICON[a.category] || 'flag-outline'}
                title={a.title}
                subtitle={[formatDateTime(a.starts_at), a.location].filter(Boolean).join(' · ')}
                meta={t('resp.teamCount', { n: list.length, ok: accepted })}
                right={<Badge label={labelOr(t, `activity.status.${a.status}`, a.status)} tone={ACTIVITY_STATUS_TONE[a.status] || 'neutral'} />}
                onPress={() => router.push(`/activity/${a.id}`)}
              />
            );
          })}
        </>
      ) : null}

      <PromptModal
        visible={!!r.prompt}
        {...promptProps(t, r.prompt)}
        onClose={() => r.setPrompt(null)}
        onSubmit={r.submitPrompt}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between', alignItems: 'center' },
  flex: { flex: 1 },
  badges: { alignItems: 'flex-end', gap: 4 },
  perm: { alignItems: 'center', gap: 10, paddingVertical: 2 },
  err: { color: colors.danger },
});
