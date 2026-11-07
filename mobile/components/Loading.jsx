import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';
import { useI18n } from '../lib/i18n';
import Txt from './Txt';

export default function Loading({ label, inline }) {
  const { t } = useI18n();
  return (
    <View style={inline ? styles.inline : styles.wrap}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Txt variant="muted" center>{label || t('common.loading')}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.bg },
  inline: { alignItems: 'center', paddingVertical: 24, gap: 8 },
});
