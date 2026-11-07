import { View, StyleSheet } from 'react-native';
import { useI18n } from '../lib/i18n';
import { colors } from '../lib/theme';
import Txt from './Txt';

/** Small "Live" pill shown while a Realtime channel is SUBSCRIBED. */
export default function LiveIndicator({ live, style }) {
  const { t, row } = useI18n();
  if (!live) return null;
  return (
    <View style={[styles.pill, row, style]} accessibilityLabel={t('live.indicator')}>
      <View style={styles.dot} />
      <Txt style={styles.text}>{t('live.indicator')}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a' },
  text: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
});
