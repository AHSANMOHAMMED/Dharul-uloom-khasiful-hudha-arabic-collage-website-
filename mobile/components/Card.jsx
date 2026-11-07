import { View, Pressable, StyleSheet } from 'react-native';
import { colors, radius, space } from '../lib/theme';

export default function Card({ children, style, onPress, accent }) {
  const content = [styles.card, accent ? { borderTopWidth: 3, borderTopColor: accent } : null, style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [content, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={content}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },
  pressed: { opacity: 0.85 },
});
