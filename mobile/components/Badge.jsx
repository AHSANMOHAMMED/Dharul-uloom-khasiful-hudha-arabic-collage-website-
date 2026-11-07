import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';
import { useI18n } from '../lib/i18n';

const TONES = {
  success: { bg: colors.primaryLight, fg: colors.primaryDark },
  warning: { bg: colors.warningLight, fg: colors.warning },
  danger: { bg: colors.dangerLight, fg: colors.danger },
  info: { bg: colors.infoLight, fg: colors.info },
  gold: { bg: colors.goldLight, fg: '#8a6a00' },
  neutral: { bg: '#f1f5f9', fg: '#475569' },
};

const STATUS_TONE = {
  completed: 'success', paid: 'success', approved: 'success', present: 'success', issued: 'success',
  active: 'success', resolved: 'success', posted: 'success',
  partial: 'warning', pending: 'warning', late: 'warning', half_day: 'warning', moderate: 'warning', escalated: 'warning',
  unpaid: 'danger', overdue: 'danger', rejected: 'danger', absent: 'danger', failed: 'danger', revoked: 'danger', major: 'danger',
  open: 'danger',
  excused: 'info', leave: 'info', holiday: 'info', minor: 'info',
  cancelled: 'neutral', ended: 'neutral', reversed: 'neutral', draft: 'neutral',
};

export function Badge({ label, tone = 'neutral', style }) {
  const c = TONES[tone] || TONES.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, style]}>
      <Text style={[styles.text, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ status, style }) {
  const { t } = useI18n();
  if (!status) return null;
  return <Badge label={t(`status.${status}`)} tone={STATUS_TONE[status] || 'neutral'} style={style} />;
}

export default Badge;

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '700' },
});
