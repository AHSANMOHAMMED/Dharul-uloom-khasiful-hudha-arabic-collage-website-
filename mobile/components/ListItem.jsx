import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import Txt from './Txt';

export default function ListItem({ title, subtitle, meta, right, icon, iconColor, onPress, unread, children }) {
  const { row, chevron } = useI18n();
  const base = [styles.item, unread && styles.unread];
  const Wrapper = onPress ? Pressable : View;
  const wrapperProps = onPress
    ? { onPress, style: ({ pressed }) => [...base, pressed && styles.pressed] }
    : { style: base };
  return (
    <Wrapper {...wrapperProps}>
      <View style={[styles.row, row]}>
        {icon ? (
          <View style={[styles.icon, { backgroundColor: (iconColor || colors.primary) + '1a' }]}>
            <Ionicons name={icon} size={20} color={iconColor || colors.primary} />
          </View>
        ) : null}
        <View style={styles.body}>
          {title ? <Txt variant="strong" numberOfLines={2}>{title}</Txt> : null}
          {subtitle ? <Txt variant="muted">{subtitle}</Txt> : null}
          {meta ? <Txt variant="small">{meta}</Txt> : null}
        </View>
        {right}
        {onPress && !right ? <Ionicons name={chevron} size={18} color={colors.muted} /> : null}
      </View>
      {children}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.sm,
  },
  unread: { borderColor: colors.primary, backgroundColor: '#f0fdf4' },
  row: { alignItems: 'center', gap: space.md },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  pressed: { opacity: 0.85 },
});
