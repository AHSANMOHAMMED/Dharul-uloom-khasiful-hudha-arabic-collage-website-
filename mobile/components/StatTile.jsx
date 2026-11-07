import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../lib/theme';
import Txt from './Txt';

export default function StatTile({ label, value, icon, tone = colors.primary, sub, onPress }) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={styles.tile}>
      {icon ? <Ionicons name={icon} size={20} color={tone} /> : null}
      <Txt style={[styles.value, { color: tone }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
      <Txt variant="small" numberOfLines={2}>{label}</Txt>
      {sub ? <Txt variant="small" numberOfLines={1}>{sub}</Txt> : null}
    </Wrapper>
  );
}

export function TileGrid({ children }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  value: { fontSize: 20, fontWeight: '800' },
});
