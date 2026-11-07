import { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useAsync } from '../lib/useAsync';
import { useLiveReload } from '../lib/live';
import { useI18n } from '../lib/i18n';
import { formatDate, isISODate } from '../lib/format';
import { colors, radius, space } from '../lib/theme';
import {
  TASK_COLUMNS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  PRIORITY_TONE,
  canMoveTask,
  dutyName,
  isOverdue,
  moveTask,
  nextStatus,
  prevStatus,
} from '../lib/governance';
import { Badge, Button, Card, Chips, EmptyState, ErrorBanner, Field, LiveIndicator, Loading, Row, Txt } from '../components';

/** One task card on the board. */
function TaskCard({ task, showAssignee, busy, onMove }) {
  const { t, lang } = useI18n();
  const { user, caps } = useAuth();
  const prev = prevStatus(task.status);
  const next = nextStatus(task.status);
  const canBack = prev && canMoveTask(task, prev, user?.id, caps);
  const canForward = next && canMoveTask(task, next, user?.id, caps);
  const waitingReview = task.status === 'review' && !canForward && task.assignee_id === user?.id;
  const overdue = isOverdue(task);
  const duty = dutyName(task.duty, lang);

  return (
    <Card onPress={() => router.push(`/task/${task.id}`)} accent={overdue ? colors.danger : undefined}>
      <Txt variant="strong" numberOfLines={3}>{task.title}</Txt>
      <Row style={styles.wrap}>
        <Badge label={t(`task.priority.${task.priority}`)} tone={PRIORITY_TONE[task.priority] || 'neutral'} />
        {task.due_date ? (
          <Txt variant="small" style={overdue ? styles.overdue : null}>
            {overdue ? t('task.overdueOn', { date: formatDate(task.due_date) }) : t('task.dueOn', { date: formatDate(task.due_date) })}
          </Txt>
        ) : null}
      </Row>
      {duty ? <Txt variant="small">{t('task.dutyLine', { duty })}</Txt> : null}
      {task.meeting ? <Txt variant="small">{t('task.meetingLine', { title: task.meeting.title, date: formatDate(task.meeting.meeting_date) })}</Txt> : null}
      {showAssignee ? (
        <Txt variant="small">{t('task.assigneeLine', { name: task.assignee?.full_name || t('task.unassigned') })}</Txt>
      ) : null}
      {waitingReview ? <Txt variant="small" style={styles.review}>{t('task.awaitingReview')}</Txt> : null}
      {canBack || canForward ? (
        <Row>
          {canBack ? (
            <Button
              small
              variant="outline"
              icon={lang === 'ar' ? 'arrow-forward' : 'arrow-back'}
              title={t(`task.status.${prev}`)}
              disabled={busy}
              onPress={() => onMove(task, prev)}
              style={styles.flex}
            />
          ) : null}
          {canForward ? (
            <Button
              small
              icon={lang === 'ar' ? 'arrow-back' : 'arrow-forward'}
              title={t(`task.status.${next}`)}
              loading={busy}
              disabled={busy}
              onPress={() => onMove(task, next)}
              style={styles.flex}
            />
          ) : null}
        </Row>
      ) : null}
    </Card>
  );
}

/** "Add my own task" form (tasks for others are assigned at the mashoora / by managers). */
function AddTaskModal({ visible, onClose, onCreated }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [due, setDue] = useState('');
  const [dutyId, setDutyId] = useState(null);
  const [saving, setSaving] = useState(false);

  const duties = useAsync(
    () =>
      must(
        supabase
          .from('duty_assignments')
          .select('id, duty:duty_roles(id, code, name_en, name_ar, name_ta)')
          .eq('assignee_id', user.id)
          .eq('status', 'active'),
      ),
    [user?.id, visible],
    { enabled: !!user && visible, reloadOnFocus: false },
  );

  const reset = () => {
    setTitle('');
    setDescription('');
    setPriority('normal');
    setDue('');
    setDutyId(null);
  };

  const save = async () => {
    if (!title.trim()) return Alert.alert(t('common.error'), t('task.titleRequired'));
    if (due.trim() && !isISODate(due.trim())) return Alert.alert(t('common.error'), t('common.invalidDate'));
    setSaving(true);
    try {
      await must(
        supabase.from('tasks').insert({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          due_date: due.trim() || null,
          duty_role_id: dutyId,
          assignee_id: user.id,
        }),
      );
      reset();
      onCreated();
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  const myDuties = (duties.data || []).map((a) => a.duty).filter(Boolean);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          <Txt variant="title">{t('task.addOwn')}</Txt>
          <Txt variant="muted">{t('task.addOwnHint')}</Txt>
          <Field label={t('task.title')} value={title} onChangeText={setTitle} placeholder={t('task.titlePlaceholder')} />
          <Field label={t('task.description')} value={description} onChangeText={setDescription} multiline />
          <Txt variant="label">{t('task.priority')}</Txt>
          <Chips options={TASK_PRIORITIES.map((p) => ({ value: p, label: t(`task.priority.${p}`) }))} value={priority} onChange={setPriority} />
          <Field
            label={t('task.dueDate')}
            value={due}
            onChangeText={setDue}
            placeholder={t('common.dateHint')}
            autoCapitalize="none"
            hint={t('common.optional')}
          />
          {myDuties.length ? (
            <>
              <Txt variant="label">{t('task.duty')}</Txt>
              <Chips
                options={[{ value: null, label: t('task.noDuty') }, ...myDuties.map((d) => ({ value: d.id, label: dutyName(d, lang) }))]}
                value={dutyId}
                onChange={setDutyId}
              />
            </>
          ) : null}
          <Button title={t('task.create')} icon="add-circle-outline" loading={saving} onPress={save} />
          <Button title={t('common.cancel')} variant="ghost" onPress={onClose} disabled={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function TasksBoard() {
  const { t, row } = useI18n();
  const { user, caps } = useAuth();
  const { width } = useWindowDimensions();
  const [scope, setScope] = useState('mine');
  const [col, setCol] = useState('todo');
  const [busyId, setBusyId] = useState(null);
  const [adding, setAdding] = useState(false);
  const pager = useRef(null);
  const enabled = !!user && caps.isEmployee;

  const q = useAsync(
    () => {
      let query = supabase
        .from('tasks')
        .select(TASK_COLUMNS)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(500);
      if (scope === 'mine') query = query.eq('assignee_id', user.id);
      return must(query);
    },
    [scope, user?.id],
    { enabled },
  );
  const live = useLiveReload(['tasks'], scope === 'mine' && user ? `assignee_id=eq.${user.id}` : undefined, q.reload, enabled);

  if (!caps.isEmployee) {
    return (
      <View style={styles.screen}>
        <EmptyState message={t('admin.forbidden')} icon="lock-closed-outline" />
      </View>
    );
  }

  // Columns in visual (left → right) order, so swiping matches the segment bar in RTL too.
  const flip = row.flexDirection === 'row-reverse';
  const pages = flip ? [...TASK_STATUSES].reverse() : TASK_STATUSES;
  const tasks = q.data || [];
  const byStatus = Object.fromEntries(TASK_STATUSES.map((s) => [s, tasks.filter((x) => x.status === s)]));

  const goTo = (status) => {
    setCol(status);
    pager.current?.scrollTo({ x: pages.indexOf(status) * width, animated: true });
  };

  const onMove = async (task, to) => {
    setBusyId(task.id);
    try {
      await moveTask(task.id, to);
      q.setData((list) => (list || []).map((x) => (x.id === task.id ? { ...x, status: to } : x)));
      q.reload();
    } catch (e) {
      Alert.alert(t('common.error'), e.code === 'not_allowed' ? t('task.notAllowed') : e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Row style={styles.between}>
          <Chips
            options={[
              { value: 'mine', label: t('task.mine') },
              { value: 'all', label: t('task.all') },
            ]}
            value={scope}
            onChange={setScope}
          />
          <LiveIndicator live={live} />
        </Row>
        <View style={[styles.segments, row]}>
          {TASK_STATUSES.map((s) => {
            const active = s === col;
            return (
              <Pressable
                key={s}
                onPress={() => goTo(s)}
                style={[styles.segment, active && styles.segmentActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Txt center numberOfLines={1} style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {t(`task.status.${s}`)}
                </Txt>
                <Txt center style={[styles.segmentCount, active && styles.segmentTextActive]}>{String(byStatus[s].length)}</Txt>
              </Pressable>
            );
          })}
        </View>
        <Button small variant="gold" icon="add-outline" title={t('task.addOwn')} onPress={() => setAdding(true)} />
        {q.error ? <ErrorBanner message={q.error} onRetry={q.refresh} /> : null}
      </View>

      {q.loading ? (
        <Loading />
      ) : (
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: pages.indexOf(col) * width, y: 0 }}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / width);
            if (pages[idx]) setCol(pages[idx]);
          }}
        >
          {pages.map((s) => (
            <ScrollView
              key={s}
              style={{ width }}
              contentContainerStyle={styles.page}
              refreshControl={
                <RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.primary} colors={[colors.primary]} />
              }
            >
              {!byStatus[s].length ? <EmptyState message={t('task.emptyColumn')} icon="checkmark-done-outline" /> : null}
              {byStatus[s].map((task) => (
                <TaskCard key={task.id} task={task} showAssignee={scope === 'all'} busy={busyId === task.id} onMove={onMove} />
              ))}
            </ScrollView>
          ))}
        </ScrollView>
      )}

      <AddTaskModal
        visible={adding}
        onClose={() => setAdding(false)}
        onCreated={() => {
          setAdding(false);
          goTo('todo');
          q.reload();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { padding: space.lg, paddingBottom: space.sm, gap: space.sm },
  between: { justifyContent: 'space-between' },
  segments: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 3,
  },
  segment: { flex: 1, paddingVertical: 6, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 12, fontWeight: '700', color: colors.text },
  segmentCount: { fontSize: 11, color: colors.muted, fontWeight: '700' },
  segmentTextActive: { color: colors.white },
  page: { padding: space.lg, paddingTop: space.sm, gap: space.md, paddingBottom: 40 },
  wrap: { flexWrap: 'wrap' },
  flex: { flex: 1 },
  overdue: { color: colors.danger, fontWeight: '700' },
  review: { color: colors.warning, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalContent: { padding: space.lg, paddingTop: 48, gap: space.md, paddingBottom: 40 },
});
