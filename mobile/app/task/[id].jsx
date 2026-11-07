import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useAsync } from '../../lib/useAsync';
import { useLiveReload } from '../../lib/live';
import { useI18n } from '../../lib/i18n';
import { formatDate, formatDateTime } from '../../lib/format';
import { colors } from '../../lib/theme';
import {
  TASK_COLUMNS,
  TASK_STATUSES,
  TASK_STATUS_TONE,
  PRIORITY_TONE,
  canMoveTask,
  dutyName,
  isOverdue,
  moveTask,
} from '../../lib/governance';
import { Badge, Button, Card, EmptyState, Field, KeyValue, ListItem, LiveIndicator, Row, Screen, SectionHeader, Txt } from '../../components';

export default function TaskDetail() {
  const { id } = useLocalSearchParams();
  const { t, lang } = useI18n();
  const { user, caps } = useAuth();
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [moving, setMoving] = useState(null);
  const enabled = !!id && !!user && caps.isEmployee;

  const q = useAsync(
    async () => {
      const [task, comments, events] = await Promise.all([
        must(supabase.from('tasks').select(TASK_COLUMNS).eq('id', id).maybeSingle()),
        must(
          supabase
            .from('task_comments')
            .select('id, body, created_at, author_id, author:profiles!task_comments_author_id_fkey(full_name)')
            .eq('task_id', id)
            .order('created_at', { ascending: true }),
        ),
        must(
          supabase
            .from('task_events')
            .select('id, from_status, to_status, note, created_at, actor:profiles!task_events_actor_id_fkey(full_name)')
            .eq('task_id', id)
            .order('created_at', { ascending: false }),
        ),
      ]);
      return { task, comments, events };
    },
    [id],
    { enabled },
  );
  const liveTask = useLiveReload(['tasks'], `id=eq.${id}`, q.reload, enabled);
  const liveComments = useLiveReload(['task_comments'], `task_id=eq.${id}`, q.reload, enabled);

  if (!caps.isEmployee) {
    return (
      <Screen>
        <EmptyState message={t('admin.forbidden')} icon="lock-closed-outline" />
      </Screen>
    );
  }

  const task = q.data?.task;
  const comments = q.data?.comments || [];
  const events = q.data?.events || [];

  const move = async (to) => {
    setMoving(to);
    try {
      await moveTask(task.id, to);
      q.reload();
    } catch (e) {
      Alert.alert(t('common.error'), e.code === 'not_allowed' ? t('task.notAllowed') : e.message);
    } finally {
      setMoving(null);
    }
  };

  const send = async () => {
    const body = comment.trim();
    if (!body) return;
    setSending(true);
    try {
      await must(supabase.from('task_comments').insert({ task_id: id, body, author_id: user.id }));
      setComment('');
      q.reload();
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSending(false);
    }
  };

  const eventText = (ev) => {
    const who = ev.actor?.full_name || t('task.system');
    if (ev.note === 'created') return t('task.event.created', { who, status: t(`task.status.${ev.to_status}`) });
    const from = ev.from_status ? t(`task.status.${ev.from_status}`) : '—';
    const to = ev.to_status ? t(`task.status.${ev.to_status}`) : '—';
    if (ev.note === 'reassigned') return t('task.event.reassigned', { who, from, to });
    return t('task.event.moved', { who, from, to });
  };

  if (!q.loading && !q.error && !task) {
    return (
      <Screen onRefresh={q.refresh} refreshing={q.refreshing}>
        <EmptyState message={t('task.notFound')} icon="help-circle-outline" />
      </Screen>
    );
  }

  const overdue = isOverdue(task);
  const duty = dutyName(task?.duty, lang);

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      {task ? (
        <>
          <Card accent={overdue ? colors.danger : colors.gold}>
            <Row style={styles.between}>
              <Badge label={t(`task.status.${task.status}`)} tone={TASK_STATUS_TONE[task.status] || 'neutral'} />
              <LiveIndicator live={liveTask && liveComments} />
            </Row>
            <Txt variant="title">{task.title}</Txt>
            <Row style={styles.wrap}>
              <Badge label={t(`task.priority.${task.priority}`)} tone={PRIORITY_TONE[task.priority] || 'neutral'} />
              {overdue ? <Badge label={t('fees.overdue')} tone="danger" /> : null}
            </Row>
            <KeyValue
              label={t('task.dueDate')}
              value={<Txt style={overdue ? styles.overdue : null}>{task.due_date ? formatDate(task.due_date) : '—'}</Txt>}
            />
            <KeyValue label={t('task.assignee')} value={task.assignee?.full_name || t('task.unassigned')} />
            <KeyValue label={t('task.createdBy')} value={task.creator?.full_name || '—'} />
            {duty ? <KeyValue label={t('task.duty')} value={duty} /> : null}
            {task.meeting ? <KeyValue label={t('task.meeting')} value={`${task.meeting.title} · ${formatDate(task.meeting.meeting_date)}`} /> : null}
            {task.completed_at ? <KeyValue label={t('task.completedAt')} value={formatDateTime(task.completed_at)} /> : null}
            {task.description ? <Txt style={styles.description}>{task.description}</Txt> : <Txt variant="muted">{t('task.noDescription')}</Txt>}
          </Card>

          <SectionHeader title={t('task.moveTo')} />
          <View style={styles.moves}>
            {TASK_STATUSES.filter((s) => s !== task.status).map((s) => {
              const allowed = canMoveTask(task, s, user?.id, caps);
              return (
                <Button
                  key={s}
                  small
                  variant={allowed ? 'outline' : 'ghost'}
                  title={t(`task.status.${s}`)}
                  loading={moving === s}
                  disabled={!allowed || !!moving}
                  onPress={() => move(s)}
                />
              );
            })}
          </View>
          {task.status === 'review' && task.assignee_id === user?.id && !canMoveTask(task, 'done', user?.id, caps) ? (
            <Txt variant="small">{t('task.awaitingReview')}</Txt>
          ) : null}

          <SectionHeader title={t('task.comments')} />
          {!comments.length ? <EmptyState message={t('task.noComments')} icon="chatbubbles-outline" /> : null}
          {comments.map((c) => (
            <ListItem
              key={c.id}
              icon="chatbubble-outline"
              iconColor={c.author_id === user?.id ? colors.gold : colors.primary}
              title={c.author?.full_name || '—'}
              subtitle={c.body}
              meta={formatDateTime(c.created_at)}
            />
          ))}
          <Card>
            <Field label={t('task.addComment')} value={comment} onChangeText={setComment} placeholder={t('task.commentPlaceholder')} multiline />
            <Button title={t('task.send')} icon="send-outline" loading={sending} disabled={!comment.trim()} onPress={send} />
          </Card>

          <SectionHeader title={t('task.history')} />
          {!events.length ? <EmptyState message={t('common.none')} icon="time-outline" /> : null}
          {events.map((ev) => (
            <ListItem key={ev.id} icon="git-commit-outline" iconColor={colors.muted} title={eventText(ev)} meta={formatDateTime(ev.created_at)} />
          ))}
          {task.meeting ? <Button variant="ghost" icon="people-outline" title={t('mashoora.title')} onPress={() => router.push('/mashoora')} /> : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between' },
  wrap: { flexWrap: 'wrap' },
  overdue: { color: colors.danger, fontWeight: '700' },
  description: { lineHeight: 22 },
  moves: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
