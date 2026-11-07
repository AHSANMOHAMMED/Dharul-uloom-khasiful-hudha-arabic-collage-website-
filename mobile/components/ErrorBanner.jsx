import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import Txt from './Txt';

export default function ErrorBanner({ message, onRetry }) {
  const { t, row } = useI18n();
  if (!message) return null;
  return (
    <View style={[styles.wrap, row]}>
      <Ionicons name="alert-circle" size={20} color={colors.danger} />
      <Txt style={styles.text}>{message}</Txt>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Txt style={styles.retry}>{t('common.retry')}</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  text: { flex: 1, color: colors.danger, fontSize: 13 },
  retry: { color: colors.danger, fontWeight: '700' },
});
