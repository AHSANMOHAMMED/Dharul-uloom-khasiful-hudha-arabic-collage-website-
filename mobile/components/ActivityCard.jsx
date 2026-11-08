import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../lib/i18n';
import { formatDateTime } from '../lib/format';
import { ASSIGNEE_STATUS_TONE, CATEGORY_ICON, labelOr } from '../lib/activities';
import { colors } from '../lib/theme';
import Card from './Card';
import Txt from './Txt';
import Button from './Button';
import { Badge } from './Badge';
import { Row } from './Row';

/**
 * One activity from my_responsibilities().activities:
 * { activity_id, title, category, starts_at, ends_at, location, status, role, responsibilities, my_status, team[] }
 * onRespond(status) is called with 'accepted' | 'declined' | 'done'.
 */
export default function ActivityCard({ a, onRespond, busy, compact, onPress }) {
  const { t, row } = useI18n();
  const mine = a.my_status;
  const when = [formatDateTime(a.starts_at), a.ends_at ? formatDateTime(a.ends_at) : null].filter(Boolean).join(' → ');
  const team = a.team || [];

  return (
    <Card onPress={onPress} accent={mine === 'assigned' ? colors.gold : mine === 'done' ? colors.primary : colors.info}>
      <View style={[row, styles.head]}>
        <View style={styles.icon}>
          <Ionicons name={CATEGORY_ICON[a.category] || 'flag-outline'} size={18} color={colors.primaryDark} />
        </View>
        <View style={styles.flex}>
          <Txt variant="strong" numberOfLines={2}>{a.title}</Txt>
          <Txt variant="small">{labelOr(t, `activity.category.${a.category}`, a.category)}</Txt>
        </View>
        {mine ? <Badge label={labelOr(t, `activity.my.${mine}`, mine)} tone={ASSIGNEE_STATUS_TONE[mine] || 'neutral'} /> : null}
      </View>

      <Txt variant="muted">{`${t('activity.when')}: ${when}`}</Txt>
      {a.location ? <Txt variant="muted">{`${t('activity.where')}: ${a.location}`}</Txt> : null}
      {a.role ? (
        <Row>
          <Txt variant="label">{t('activity.myRole')}</Txt>
          <Badge label={labelOr(t, `activity.role.${a.role}`, a.role)} tone={a.role === 'lead' ? 'gold' : 'info'} />
        </Row>
      ) : null}
      {a.responsibilities ? <Txt>{`${t('activity.myResponsibilities')}: ${a.responsibilities}`}</Txt> : null}

      {!compact && team.length ? (
        <View style={styles.team}>
          <Txt variant="label">{t('activity.teamN', { n: team.length })}</Txt>
          {team.map((m, i) => (
            <Row key={`${m.name}-${i}`} style={styles.between}>
              <Txt style={styles.flex} numberOfLines={1}>{`${m.name} · ${labelOr(t, `activity.role.${m.role}`, m.role)}`}</Txt>
              <Badge label={labelOr(t, `activity.my.${m.status}`, m.status)} tone={ASSIGNEE_STATUS_TONE[m.status] || 'neutral'} />
            </Row>
          ))}
        </View>
      ) : null}

      {onRespond && mine && mine !== 'done' ? (
        <Row style={styles.actions}>
          {mine === 'assigned' ? (
            <Button small icon="checkmark-outline" title={t('activity.accept')} loading={busy === 'accepted'} disabled={!!busy} onPress={() => onRespond('accepted')} />
          ) : null}
          {mine === 'accepted' ? (
            <Button small icon="checkmark-done-outline" title={t('activity.markDone')} loading={busy === 'done'} disabled={!!busy} onPress={() => onRespond('done')} />
          ) : null}
          <Button small variant="outline" icon="close-outline" title={t('activity.decline')} disabled={!!busy} onPress={() => onRespond('declined')} />
        </Row>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  between: { justifyContent: 'space-between' },
  team: { gap: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border },
  actions: { flexWrap: 'wrap' },
});
