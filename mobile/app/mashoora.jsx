import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useAsync } from '../lib/useAsync';
import { useLiveReload } from '../lib/live';
import { useI18n } from '../lib/i18n';
import { formatDate, isISODate, toISODate } from '../lib/format';
import { colors, space } from '../lib/theme';
import { TASK_STATUS_TONE, dutyName } from '../lib/governance';
import { Badge, Button, Card, Chips, EmptyState, Field, ListItem, LiveIndicator, Row, Screen, Txt } from '../components';

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
      <Button
        small
        variant="outline"
        icon="add-outline"
        title={t('task.create')}
        onPress={() => router.push({ pathname: '/tasks', params: { meeting: m.id } })}
      />
    </Card>
  );
}

function AddMeetingModal({ visible, onClose, onCreated }) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [meetingType, setMeetingType] = useState('weekly');
  const [meetingDate, setMeetingDate] = useState(toISODate());
  const [decisions, setDecisions] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return Alert.alert(t('common.error'), t('task.titleRequired'));
    if (!isISODate(meetingDate.trim())) return Alert.alert(t('common.error'), t('common.invalidDate'));
    setSaving(true);
    try {
      await must(
        supabase.from('mashoora_meetings').insert({
          title: title.trim(),
          meeting_type: meetingType,
          meeting_date: meetingDate.trim(),
          decisions: decisions.trim() || null,
          status: 'draft',
        }),
      );
      setTitle('');
      setDecisions('');
      onCreated();
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          <Txt variant="title">{t('mashoora.title')}</Txt>
          <Field label={t('task.title')} value={title} onChangeText={setTitle} />
          <Chips
            options={['weekly', 'annual', 'special'].map((v) => ({ value: v, label: t(`mashoora.type.${v}`) }))}
            value={meetingType}
            onChange={setMeetingType}
          />
          <Field label={t('task.dueDate')} value={meetingDate} onChangeText={setMeetingDate} autoCapitalize="none" />
          <Field label={t('mashoora.decisions')} value={decisions} onChangeText={setDecisions} multiline />
          <Button title={t('common.save')} icon="checkmark-circle-outline" loading={saving} onPress={save} />
          <Button title={t('common.cancel')} variant="ghost" onPress={onClose} disabled={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function Mashoora() {
  const { t } = useI18n();
  const { user, caps } = useAuth();
  const [type, setType] = useState('all');
  const [adding, setAdding] = useState(false);
  const enabled = !!user && caps.isEmployee;
  const q = useAsync(() => loadMeetings(type), [type], { enabled });
  const live = useLiveReload(['mashoora_meetings', 'tasks', 'duty_assignments'], undefined, q.reload, enabled);

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
      <Row style={styles.between}>
        <Chips
          options={['all', 'weekly', 'annual', 'special'].map((v) => ({ value: v, label: v === 'all' ? t('mashoora.allTypes') : t(`mashoora.type.${v}`) }))}
          value={type}
          onChange={setType}
        />
        {caps.isGovernance ? <Button small variant="gold" icon="add-outline" title={t('common.add')} onPress={() => setAdding(true)} /> : null}
      </Row>
      {!meetings.length ? <EmptyState message={t('mashoora.none')} icon="people-outline" /> : null}
      {meetings.map((m) => (
        <Meeting
          key={m.id}
          m={m}
          tasks={tasks.filter((x) => x.meeting_id === m.id)}
          duties={duties.filter((x) => x.meeting_id === m.id)}
        />
      ))}
      <AddMeetingModal
        visible={adding}
        onClose={() => setAdding(false)}
        onCreated={() => {
          setAdding(false);
          q.reload();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between' },
  flex: { flex: 1 },
  decisions: { lineHeight: 22 },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalContent: { padding: space.lg, paddingTop: 48, gap: space.md, paddingBottom: 40 },
});
