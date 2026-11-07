import { View, Pressable, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import Txt from './Txt';

export default function SectionHeader({ title, actionLabel, onAction }) {
  const { row } = useI18n();
  return (
    <View style={[styles.wrap, row]}>
      <View style={styles.bar} />
      <Txt variant="h2" style={styles.title}>{title}</Txt>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Txt style={styles.action}>{actionLabel}</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8, marginTop: 8 },
  bar: { width: 4, height: 18, borderRadius: 2, backgroundColor: colors.gold },
  title: { flex: 1 },
  action: { color: colors.primary, fontWeight: '700', fontSize: 13 },
});
