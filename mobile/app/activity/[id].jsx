import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useAsync } from '../../lib/useAsync';
import { useLiveTable, useLiveReload } from '../../lib/live';
import { useI18n } from '../../lib/i18n';
import { formatDateTime } from '../../lib/format';
import { staffRoles } from '../../lib/roles';
import {
  ACTIVITY_ROLES, ACTIVITY_STATUS_TONE, ASSIGNEE_STATUS_TONE, assignActivityStaff, labelOr, removeActivityStaff, respondActivity,
} from '../../lib/activities';
import { promptProps } from '../../lib/useResponsibilities';
import { colors, space } from '../../lib/theme';
import {
  Screen, Card, Txt, Button, Badge, SectionHeader, Row, KeyValue, EmptyState, ListItem, LiveIndicator, Chips, Field, PromptModal, Loading,
} from '../../components';

const ASSIGNEE_COLUMNS =
  'id, profile_id, role, responsibilities, status, response_note, responded_at, ' +
  'person:profiles!activity_assignees_profile_id_fkey(full_name, account_type, assigned_tutor_role, extra_roles)';

function personRoles(t, p) {
  if (!p) return '';
  const roles = staffRoles({ ...p });
  const base = t(`account.${p.account_type || 'staff'}`);
  return [base, ...roles.map((r) => labelOr(t, `role.${r}`, r))].join(' · ');
}

/** Employee picker + role / responsibilities for each person, then assign_activity_staff. */
function AddPeopleModal({ visible, activityId, assignedIds, initial, onClose, onSaved }) {
  const { t } = useI18n();
  const [term, setTerm] = useState('');
  const [staged, setStaged] = useState(initial || []);
  const [saving, setSaving] = useState(false);

  const emp = useAsync(
    () =>
      must(
        supabase
          .from('profiles')
          .select('id, full_name, account_type, assigned_tutor_role, extra_roles')
          .in('account_type', ['tutor', 'staff'])
          .eq('is_approved', true)
          .order('full_name')
          .limit(500),
      ),
    [visible],
    { enabled: visible, reloadOnFocus: false },
  );

  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setStaged(initial || []);
  }

  const stagedIds = new Set(staged.map((s) => s.profile_id));
  const needle = term.trim().toLowerCase();
  const candidates = (emp.data || [])
    .filter((p) => !stagedIds.has(p.id))
    .filter((p) => !needle || (p.full_name || '').toLowerCase().includes(needle))
    .slice(0, 30);

  const update = (pid, patch) => setStaged((list) => list.map((s) => (s.profile_id === pid ? { ...s, ...patch } : s)));

  const save = async () => {
    if (!staged.length) {
      Alert.alert(t('activity.addPeople'), t('activity.pickSomeone'));
      return;
    }
    setSaving(true);
    try {
      const n = await assignActivityStaff(
        activityId,
        staged.map((s) => ({ profile_id: s.profile_id, role: s.role, responsibilities: s.responsibilities.trim() || null })),
      );
      Alert.alert(t('common.success'), t('activity.assignedN', { n: n ?? staged.length }));
      setStaged([]);
      setTerm('');
      onSaved?.();
      onClose?.();
    } catch (e) {
      Alert.alert(t('common.error'), e?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
          <Txt variant="title">{t('activity.addPeople')}</Txt>
          <Txt variant="muted">{t('activity.addPeopleHint')}</Txt>

          {staged.map((s) => (
            <Card key={s.profile_id} accent={colors.gold}>
              <Row style={styles.between}>
                <Txt variant="strong" style={styles.flex}>{s.name}</Txt>
                <Button small variant="ghost" icon="close-outline" title={t('activity.unstage')} onPress={() => setStaged((l) => l.filter((x) => x.profile_id !== s.profile_id))} />
              </Row>
              <Txt variant="label">{t('activity.role')}</Txt>
              <Chips
                options={ACTIVITY_ROLES.map((r) => ({ value: r, label: t(`activity.role.${r}`) }))}
                value={s.role}
                onChange={(role) => update(s.profile_id, { role })}
              />
              <Field
                label={t('activity.responsibilities')}
                placeholder={t('activity.responsibilitiesPlaceholder')}
                value={s.responsibilities}
                onChangeText={(v) => update(s.profile_id, { responsibilities: v })}
                multiline
                inputStyle={styles.respInput}
              />
            </Card>
          ))}

          <Field label={t('activity.searchStaff')} placeholder={t('activity.searchStaffPlaceholder')} value={term} onChangeText={setTerm} />
          {emp.loading ? <Loading inline /> : null}
          {emp.error ? <Txt style={styles.err}>{emp.error}</Txt> : null}
          {emp.data && !candidates.length ? <Txt variant="muted">{t('activity.noStaff')}</Txt> : null}
          {candidates.map((p) => (
            <ListItem
              key={p.id}
              icon={assignedIds.has(p.id) ? 'create-outline' : 'person-add-outline'}
              title={p.full_name}
              subtitle={personRoles(t, p)}
              meta={assignedIds.has(p.id) ? t('activity.alreadyInTeam') : undefined}
              onPress={() => setStaged((l) => [...l, { profile_id: p.id, name: p.full_name, role: 'member', responsibilities: '' }])}
            />
          ))}
        </ScrollView>
        <View style={styles.modalFooter}>
          <Row>
            <Button style={styles.flex} variant="outline" title={t('common.cancel')} disabled={saving} onPress={onClose} />
            <Button
              style={styles.flex}
              title={t('activity.assignN', { n: staged.length })}
              icon="people-outline"
              loading={saving}
              disabled={!staged.length}
              onPress={save}
            />
          </Row>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ActivityDetail() {
  const { id } = useLocalSearchParams();
  const activityId = id ? String(id) : null;
  const { t } = useI18n();
  const { user, caps } = useAuth();
  const [adding, setAdding] = useState(false);
  const [initial, setInitial] = useState([]);
  const [prompt, setPrompt] = useState(null);
  const [busy, setBusy] = useState(null);

  const q = useAsync(
    async () => {
      const [activity, team] = await Promise.all([
        must(supabase.from('activities').select('*').eq('id', activityId).maybeSingle()),
        must(supabase.from('activity_assignees').select(ASSIGNEE_COLUMNS).eq('activity_id', activityId).order('created_at')),
      ]);
      return { activity, team: team || [] };
    },
    [activityId],
    { enabled: !!activityId && caps.isEmployee },
  );
  const liveTeam = useLiveReload(['activity_assignees'], activityId ? `activity_id=eq.${activityId}` : undefined, q.reload, !!activityId);
  const { live: liveAct } = useLiveTable({
    table: 'activities',
    filter: activityId ? `id=eq.${activityId}` : undefined,
    enabled: !!activityId,
    onChange: () => q.reload(),
  });

  const team = useMemo(() => q.data?.team || [], [q.data]);
  const assignedIds = useMemo(() => new Set(team.map((m) => m.profile_id)), [team]);

  if (!caps.isEmployee) {
    return (
      <Screen>
        <EmptyState message={t('admin.forbidden')} icon="lock-closed-outline" />
      </Screen>
    );
  }

  const a = q.data?.activity;
  const me = team.find((m) => m.profile_id === user?.id);

  const respond = async (status, note) => {
    setBusy(status);
    try {
      await respondActivity(activityId, status, note);
      q.reload();
    } finally {
      setBusy(null);
    }
  };

  const onRespond = (status) => {
    if (status === 'accepted') respond(status).catch((e) => Alert.alert(t('common.error'), e?.message || t('common.error')));
    else setPrompt({ activityId, status });
  };

  const remove = (m) => {
    Alert.alert(t('activity.remove'), t('activity.removeConfirm', { name: m.person?.full_name || '' }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('activity.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await removeActivityStaff(activityId, m.profile_id);
            q.reload();
          } catch (e) {
            Alert.alert(t('common.error'), e?.message || t('common.error'));
          }
        },
      },
    ]);
  };

  const openAdd = (pre = []) => {
    setInitial(pre);
    setAdding(true);
  };

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Stack.Screen options={{ title: a?.title || t('activity.title') }} />
      {!q.loading && !q.error && !a ? <EmptyState message={t('activity.notFound')} icon="calendar-outline" /> : null}
      {a ? (
        <>
          <Card accent={colors.gold}>
            <Row style={styles.between}>
              <Txt variant="h2" style={styles.flex}>{a.title}</Txt>
              <Badge label={labelOr(t, `activity.status.${a.status}`, a.status)} tone={ACTIVITY_STATUS_TONE[a.status] || 'neutral'} />
            </Row>
            <LiveIndicator live={liveTeam && liveAct} />
            <KeyValue label={t('activity.category')} value={labelOr(t, `activity.category.${a.category}`, a.category)} />
            <KeyValue label={t('activity.starts')} value={formatDateTime(a.starts_at)} />
            {a.ends_at ? <KeyValue label={t('activity.ends')} value={formatDateTime(a.ends_at)} /> : null}
            {a.location ? <KeyValue label={t('activity.where')} value={a.location} /> : null}
            {a.description ? <Txt>{a.description}</Txt> : null}
          </Card>

          {me ? (
            <Card accent={colors.primary}>
              <Txt variant="label">{t('activity.myPart')}</Txt>
              <Row>
                <Badge label={labelOr(t, `activity.role.${me.role}`, me.role)} tone={me.role === 'lead' ? 'gold' : 'info'} />
                <Badge label={labelOr(t, `activity.my.${me.status}`, me.status)} tone={ASSIGNEE_STATUS_TONE[me.status] || 'neutral'} />
              </Row>
              {me.responsibilities ? <Txt>{me.responsibilities}</Txt> : null}
              {me.status !== 'done' ? (
                <Row style={styles.wrap}>
                  {me.status === 'assigned' || me.status === 'declined' ? (
                    <Button small icon="checkmark-outline" title={t('activity.accept')} loading={busy === 'accepted'} disabled={!!busy} onPress={() => onRespond('accepted')} />
                  ) : null}
                  {me.status === 'accepted' ? (
                    <Button small icon="checkmark-done-outline" title={t('activity.markDone')} loading={busy === 'done'} disabled={!!busy} onPress={() => onRespond('done')} />
                  ) : null}
                  {me.status !== 'declined' ? (
                    <Button small variant="outline" icon="close-outline" title={t('activity.decline')} disabled={!!busy} onPress={() => onRespond('declined')} />
                  ) : null}
                </Row>
              ) : null}
            </Card>
          ) : null}

          <SectionHeader title={t('activity.teamN', { n: team.length })} />
          {caps.isGovernance ? <Button title={t('activity.addPeople')} icon="person-add-outline" variant="gold" onPress={() => openAdd([])} /> : null}
          {!team.length ? <EmptyState message={t('activity.noTeam')} icon="people-outline" /> : null}
          {team.map((m) => (
            <ListItem
              key={m.id}
              icon={m.role === 'lead' ? 'star-outline' : 'person-outline'}
              iconColor={m.role === 'lead' ? colors.gold : colors.primary}
              title={m.person?.full_name || '—'}
              subtitle={labelOr(t, `activity.role.${m.role}`, m.role)}
              meta={[m.responsibilities, m.response_note ? `${t('activity.note')}: ${m.response_note}` : null].filter(Boolean).join('\n') || undefined}
              right={<Badge label={labelOr(t, `activity.my.${m.status}`, m.status)} tone={ASSIGNEE_STATUS_TONE[m.status] || 'neutral'} />}
            >
              {caps.isGovernance ? (
                <Row>
                  <Button
                    small
                    variant="outline"
                    icon="create-outline"
                    title={t('activity.edit')}
                    onPress={() =>
                      openAdd([{ profile_id: m.profile_id, name: m.person?.full_name || '', role: m.role, responsibilities: m.responsibilities || '' }])
                    }
                  />
                  <Button small variant="ghost" icon="trash-outline" title={t('activity.remove')} onPress={() => remove(m)} />
                </Row>
              ) : null}
            </ListItem>
          ))}
        </>
      ) : null}

      {caps.isGovernance ? (
        <AddPeopleModal
          visible={adding}
          activityId={activityId}
          assignedIds={assignedIds}
          initial={initial}
          onClose={() => setAdding(false)}
          onSaved={q.reload}
        />
      ) : null}
      <PromptModal
        visible={!!prompt}
        {...promptProps(t, prompt)}
        onClose={() => setPrompt(null)}
        onSubmit={(note) => respond(prompt.status, note)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between', alignItems: 'center' },
  flex: { flex: 1 },
  wrap: { flexWrap: 'wrap' },
  err: { color: colors.danger },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalContent: { padding: space.lg, gap: space.md, paddingTop: 48, paddingBottom: 24 },
  modalFooter: { padding: space.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  respInput: { minHeight: 70 },
});
