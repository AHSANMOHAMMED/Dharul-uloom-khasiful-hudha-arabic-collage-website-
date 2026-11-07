import { Text, StyleSheet } from 'react-native';
import { useI18n } from '../lib/i18n';
import { colors } from '../lib/theme';

// Text that follows the selected language direction.
export default function Txt({ style, variant = 'body', center, children, ...rest }) {
  const { textAlign } = useI18n();
  return (
    <Text style={[styles.base, styles[variant], center ? styles.center : textAlign, style]} {...rest}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { color: colors.text, fontSize: 15 },
  body: {},
  title: { fontSize: 20, fontWeight: '700', color: colors.primaryDark },
  h2: { fontSize: 17, fontWeight: '700', color: colors.primaryDark },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted },
  strong: { fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13 },
  small: { color: colors.muted, fontSize: 12 },
  center: { textAlign: 'center' },
});
