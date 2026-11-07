import { useState } from 'react';
import { Alert, View, Pressable, StyleSheet, Text } from 'react-native';
import { supabase, must } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { toISODate, addDays, isISODate } from '../../lib/format';
import { colors } from '../../lib/theme';
import { Screen, Card, Txt, Chips, Field, Button, Row, EmptyState, Loading } from '../../components';

const CLASSES = [1, 2, 3, 4, 5, 6, 7];
const STATUSES = ['present', 'absent', 'late', 'excused'];
const STATUS_COLOR = { present: colors.primary, absent: colors.danger, late: colors.warning, excused: colors.info };

export default function MarkAttendance() {
  const { t, row } = useI18n();
  const { user, caps } = useAuth();
  const [cls, setCls] = useState(1);
  const [date, setDate] = useState(toISODate());
  const [sheet, setSheet] = useState(null);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!caps.canMarkAttendance) {
    return (
      <Screen>
        <EmptyState message={t('attendance.notAllowed')} icon="lock-closed-outline" />
      </Screen>
    );
  }

  const load = async (c = cls, d = date) => {
    if (!isISODate(d)) return Alert.alert(t('common.error'), t('common.invalidDate'));
    setLoading(true);
    try {
      const rows = await must(supabase.rpc('class_attendance_sheet', { p_class: c, p_date: d }));
      setSheet(rows);
      setMarks(Object.fromEntries(rows.filter((r) => r.status).map((r) => [r.student_id, r.status])));
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setLoading(false);
    }
  };

  const shiftDay = (n) => {
    const d = addDays(isISODate(date) ? date : toISODate(), n);
    setDate(d);
    if (sheet) load(cls, d);
  };

  const save = async () => {
    const rows = Object.entries(marks).map(([student_id, status]) => ({ student_id, date, status, marked_by: user.id }));
    if (!rows.length) return;
    setSaving(true);
    try {
      await must(supabase.from('attendance').upsert(rows, { onConflict: 'student_id,date' }));
      Alert.alert(t('common.success'), t('attendance.saved', { n: rows.length }));
      load();
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen onRefresh={sheet ? () => load() : undefined} refreshing={false}>
      <Card>
        <Txt variant="label">{t('attendance.pickClass')}</Txt>
        <Chips
          options={CLASSES.map((c) => ({ value: c, label: t('common.classN', { n: c }) }))}
          value={cls}
          onChange={(c) => {
            setCls(c);
            setSheet(null);
          }}
        />
        <Field label={t('common.date')} value={date} onChangeText={setDate} placeholder={t('common.dateHint')} autoCapitalize="none" />
        <Row>
          <Button small variant="outline" icon="chevron-back" title={t('attendance.prevDay')} onPress={() => shiftDay(-1)} />
          <Button small variant="outline" title={t('common.today')} onPress={() => { setDate(toISODate()); if (sheet) load(cls, toISODate()); }} />
          <Button small variant="outline" icon="chevron-forward" title={t('attendance.nextDay')} onPress={() => shiftDay(1)} />
        </Row>
        <Button title={t('attendance.load')} icon="list-outline" onPress={() => load()} loading={loading} />
      </Card>

      {loading ? <Loading inline /> : null}
      {sheet && !loading ? (
        <>
          {!sheet.length ? <EmptyState message={t('attendance.noStudents')} icon="people-outline" /> : null}
          {sheet.length ? (
            <Button
              small
              variant="outline"
              icon="checkmark-done-outline"
              title={t('attendance.allPresent')}
              onPress={() => setMarks(Object.fromEntries(sheet.map((s) => [s.student_id, 'present'])))}
            />
          ) : null}
          {sheet.map((s) => {
            const current = marks[s.student_id];
            return (
              <Card key={s.student_id}>
                <Txt variant="strong">{s.full_name}</Txt>
                <Txt variant="small">{s.index_number || ''} {current ? '' : `· ${t('attendance.unmarked')}`}</Txt>
                <View style={[styles.statuses, row]}>
                  {STATUSES.map((st) => {
                    const active = current === st;
                    return (
                      <Pressable
                        key={st}
                        onPress={() => setMarks({ ...marks, [s.student_id]: st })}
                        style={[styles.pill, { borderColor: STATUS_COLOR[st] }, active && { backgroundColor: STATUS_COLOR[st] }]}
                      >
                        <Text style={[styles.pillText, { color: active ? colors.white : STATUS_COLOR[st] }]}>{t(`status.${st}`)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            );
          })}
          {sheet.length ? (
            <Button title={t('common.save')} icon="save-outline" loading={saving} disabled={!Object.keys(marks).length} onPress={save} />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  statuses: { gap: 6, flexWrap: 'wrap' },
  pill: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { fontWeight: '700', fontSize: 12 },
});
