import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../lib/i18n';
import { formatDateTime } from '../lib/format';
import { dutyName } from '../lib/governance';
import { ASSIGNEE_STATUS_TONE, CATEGORY_ICON, labelOr } from '../lib/activities';
import { colors, radius } from '../lib/theme';
import Card from './Card';
import Txt from './Txt';
import { Badge } from './Badge';
import LiveIndicator from './LiveIndicator';

/** Staff Home: upcoming activities + active duties from my_responsibilities(). */
export default function ResponsibilitiesCard({ data, live, max = 3 }) {
  const { t, lang, row, chevron } = useI18n();
  if (!data) return null;
  const activities = (data.activities || []).slice(0, max);
  const more = (data.activities || []).length - activities.length;
  const duties = data.duties || [];
  const waiting = (data.activities || []).filter((a) => a.my_status === 'assigned').length;

  return (
    <Card accent={colors.primary}>
      <Pressable onPress={() => router.push('/responsibilities')} style={[row, styles.head]} accessibilityRole="button">
        <Ionicons name="flag-outline" size={18} color={colors.primary} />
        <Txt variant="h2" style={styles.flex}>{t('resp.title')}</Txt>
        <LiveIndicator live={live} />
        <Ionicons name={chevron} size={18} color={colors.muted} />
      </Pressable>
      {waiting ? <Badge label={t('resp.waitingN', { n: waiting })} tone="warning" /> : null}

      {!activities.length && !duties.length ? <Txt variant="muted">{t('resp.nothing')}</Txt> : null}
      {activities.map((a) => (
        <Pressable key={a.activity_id} onPress={() => router.push(`/activity/${a.activity_id}`)} style={[row, styles.item]}>
          <View style={styles.icon}>
            <Ionicons name={CATEGORY_ICON[a.category] || 'flag-outline'} size={16} color={colors.primaryDark} />
          </View>
          <View style={styles.flex}>
            <Txt variant="strong" numberOfLines={1}>{a.title}</Txt>
            <Txt variant="small" numberOfLines={1}>
              {[formatDateTime(a.starts_at), a.location, labelOr(t, `activity.role.${a.role}`, a.role)].filter(Boolean).join(' · ')}
            </Txt>
          </View>
          <Badge label={labelOr(t, `activity.my.${a.my_status}`, a.my_status)} tone={ASSIGNEE_STATUS_TONE[a.my_status] || 'neutral'} />
        </Pressable>
      ))}
      {more > 0 ? <Txt variant="small">{t('resp.moreN', { n: more })}</Txt> : null}

      {duties.length ? (
        <View style={[row, styles.duties]}>
          {duties.map((d) => (
            <Badge key={d.assignment_id} label={`${dutyName(d, lang)}${d.is_lead ? ` · ${t('resp.lead')}` : ''}`} tone="gold" />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  item: { alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  icon: { width: 30, height: 30, borderRadius: radius.lg, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' },
  duties: { flexWrap: 'wrap', gap: 6 },
});
