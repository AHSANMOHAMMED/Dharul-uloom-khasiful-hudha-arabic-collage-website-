import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useAsync } from '../lib/useAsync';
import { useLiveReload } from '../lib/live';
import { useI18n } from '../lib/i18n';
import { formatDate } from '../lib/format';
import { colors } from '../lib/theme';
import { TASK_STATUS_TONE, dutyName } from '../lib/governance';
import { Badge, Button, Card, Chips, EmptyState, ListItem, LiveIndicator, Row, Screen, Txt } from '../components';

const TYPE_TONE = { weekly: 'info', annual: 'gold', special: 'warning' };

async function loadMeetings(type) {
  let query = supabase
    .from('mashoora_meetings')
    .select('id, title, meeting_type, meeting_date, decisions, status')
    .order('meeting_date', { ascending: false })
    .limit(30);
  if (type !== 'all') query = query.eq('meeting_type', type);
  const meetings = await must(query);
  const ids = meetings.map((m) => m.id);
  if (!ids.length) return { meetings, tasks: [], duties: [] };
  const [tasks, duties] = await Promise.all([
    must(
      supabase
        .from('tasks')
        .select('id, title, status, due_date, meeting_id, assignee:profiles!tasks_assignee_id_fkey(full_name)')
        .in('meeting_id', ids)
        .order('created_at'),
    ),
    must(
      supabase
        .from('duty_assignments')
        .select(
          'id, meeting_id, status, start_date, duty:duty_roles(code, name_en, name_ar, name_ta), assignee:profiles!duty_assignments_assignee_id_fkey(full_name)',
        )
        .in('meeting_id', ids)
        .order('start_date'),
    ),
  ]);
  return { meetings, tasks, duties };
}

function Meeting({ m, tasks, duties }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const decisions = (m.decisions || '').trim();
  const long = decisions.length > 220;
  return (
    <Card accent={m.meeting_type === 'annual' ? colors.gold : colors.primary}>
      <Row style={styles.between}>
        <Badge label={t(`mashoora.type.${m.meeting_type}`)} tone={TYPE_TONE[m.meeting_type] || 'neutral'} />
        <Badge label={t(`mashoora.status.${m.status}`)} tone={m.status === 'finalized' ? 'success' : 'neutral'} />
      </Row>
      <Txt variant="h2">{m.title}</Txt>
      <Txt variant="small">{formatDate(m.meeting_date)}</Txt>

      <Txt variant="label">{t('mashoora.decisions')}</Txt>
      {decisions ? (
        <>
          <Txt numberOfLines={open || !long ? undefined : 5} style={styles.decisions}>{decisions}</Txt>
          {long ? <Button small variant="ghost" title={open ? t('mashoora.less') : t('mashoora.more')} onPress={() => setOpen(!open)} /> : null}
        </>
      ) : (
        <Txt variant="muted">{t('mashoora.noDecisions')}</Txt>
      )}

      {duties.length ? (
        <>
          <Txt variant="label">{t('mashoora.dutiesDecided', { n: duties.length })}</Txt>
          {duties.map((d) => (
            <ListItem
              key={d.id}
              icon="ribbon-outline"
              iconColor={colors.gold}
              title={dutyName(d.duty, lang)}
              subtitle={`${d.assignee?.full_name || '—'} · ${t('duty.since', { date: formatDate(d.start_date) })}`}
              right={<Badge label={t(`status.${d.status}`)} tone={d.status === 'active' ? 'success' : 'neutral'} />}
            />
          ))}
        </>
      ) : null}

      {tasks.length ? (
        <>
          <Txt variant="label">{t('mashoora.tasksDecided', { n: tasks.length })}</Txt>
          {tasks.map((task) => (
            <ListItem
              key={task.id}
              icon="checkbox-outline"
              title={task.title}
              subtitle={[task.assignee?.full_name, task.due_date ? t('task.dueOn', { date: formatDate(task.due_date) }) : null].filter(Boolean).join(' · ')}
              right={<Badge label={t(`task.status.${task.status}`)} tone={TASK_STATUS_TONE[task.status] || 'neutral'} />}
              onPress={() => router.push(`/task/${task.id}`)}
            />
          ))}
        </>
      ) : null}
    </Card>
  );
}

export default function Mashoora() {
  const { t } = useI18n();
  const { user, caps } = useAuth();
  const [type, setType] = useState('all');
  const enabled = !!user && caps.isEmployee;
  const q = useAsync(() => loadMeetings(type), [type], { enabled });
  const live = useLiveReload(['tasks', 'duty_assignments'], undefined, q.reload, enabled);

  if (!caps.isEmployee) {
    return (
      <Screen>
        <EmptyState message={t('admin.forbidden')} icon="lock-closed-outline" />
      </Screen>
    );
  }

  const meetings = q.data?.meetings || [];
  const tasks = q.data?.tasks || [];
  const duties = q.data?.duties || [];

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Row style={styles.between}>
        <Txt variant="muted" style={styles.flex}>{t('mashoora.intro')}</Txt>
        <LiveIndicator live={live} />
      </Row>
      <Chips
        options={['all', 'weekly', 'annual', 'special'].map((v) => ({ value: v, label: v === 'all' ? t('mashoora.allTypes') : t(`mashoora.type.${v}`) }))}
        value={type}
        onChange={setType}
      />
      {!meetings.length ? <EmptyState message={t('mashoora.none')} icon="people-outline" /> : null}
      {meetings.map((m) => (
        <Meeting
          key={m.id}
          m={m}
          tasks={tasks.filter((x) => x.meeting_id === m.id)}
          duties={duties.filter((x) => x.meeting_id === m.id)}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between' },
  flex: { flex: 1 },
  decisions: { lineHeight: 22 },
});
