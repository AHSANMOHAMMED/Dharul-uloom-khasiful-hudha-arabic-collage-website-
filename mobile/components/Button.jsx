import { Pressable, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../lib/theme';
import { useI18n } from '../lib/i18n';

const VARIANTS = {
  primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
  dark: { bg: colors.primaryDark, fg: colors.white, border: colors.primaryDark },
  gold: { bg: colors.gold, fg: colors.primaryDark, border: colors.gold },
  outline: { bg: 'transparent', fg: colors.primary, border: colors.primary },
  danger: { bg: colors.danger, fg: colors.white, border: colors.danger },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  muted: { bg: '#334155', fg: colors.white, border: '#334155' },
};

export default function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, icon, small, style }) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const { row } = useI18n();
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        small && styles.small,
        { backgroundColor: v.bg, borderColor: v.border },
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      <View style={[styles.inner, row]}>
        {loading ? (
          <ActivityIndicator color={v.fg} size="small" />
        ) : icon ? (
          <Ionicons name={icon} size={small ? 16 : 18} color={v.fg} />
        ) : null}
        <Text style={[styles.text, small && styles.smallText, { color: v.fg }]}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { paddingVertical: 13, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center' },
  small: { paddingVertical: 7, paddingHorizontal: 12 },
  inner: { alignItems: 'center', gap: 8 },
  text: { fontWeight: '700', fontSize: 15 },
  smallText: { fontSize: 13 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
});
