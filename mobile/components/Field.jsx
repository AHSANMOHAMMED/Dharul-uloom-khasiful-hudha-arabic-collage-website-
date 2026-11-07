import { View, TextInput, StyleSheet } from 'react-native';
import { colors, radius } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import Txt from './Txt';

export default function Field({ label, hint, multiline, style, inputStyle, ...props }) {
  const { textAlign } = useI18n();
  return (
    <View style={[styles.wrap, style]}>
      {label ? <Txt variant="label">{label}</Txt> : null}
      <TextInput
        placeholderTextColor="#94a3b8"
        style={[styles.input, textAlign, multiline && styles.multi, inputStyle]}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...props}
      />
      {hint ? <Txt variant="small">{hint}</Txt> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
  },
  multi: { minHeight: 110 },
});
