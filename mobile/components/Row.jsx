import { View, StyleSheet } from 'react-native';
import { useI18n } from '../lib/i18n';
import Txt from './Txt';

/** Direction-aware horizontal row. */
export function Row({ children, style, gap = 8 }) {
  const { row } = useI18n();
  return <View style={[styles.row, row, { gap }, style]}>{children}</View>;
}

/** label …… value line used in statements. */
export function KeyValue({ label, value, strong }) {
  return (
    <Row style={styles.kv}>
      <Txt variant={strong ? 'strong' : 'muted'} style={styles.flex}>{label}</Txt>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Txt variant={strong ? 'strong' : 'body'}>{String(value)}</Txt>
      ) : (
        value
      )}
    </Row>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center' },
  kv: { justifyContent: 'space-between' },
  flex: { flex: 1 },
});
