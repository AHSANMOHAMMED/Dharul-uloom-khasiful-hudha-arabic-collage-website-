import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';
import Txt from './Txt';

export default function EmptyState({ message, icon = 'file-tray-outline', action }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={36} color={colors.muted} />
      <Txt variant="muted" center>{message}</Txt>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 10 },
});
