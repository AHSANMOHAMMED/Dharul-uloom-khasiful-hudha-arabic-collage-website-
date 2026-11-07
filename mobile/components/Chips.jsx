import { View, Pressable, Text, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';
import { useI18n } from '../lib/i18n';

/** Single-select chip row. options: [{ value, label }] */
export default function Chips({ options, value, onChange, wrap = true }) {
  const { row } = useI18n();
  return (
    <View style={[styles.row, row, wrap && styles.wrap]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[styles.chip, active && styles.active]}
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.text, active && styles.activeText]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8 },
  wrap: { flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { color: colors.text, fontWeight: '600', fontSize: 13 },
  activeText: { color: colors.white },
});
