import { Text } from 'react-native';
import { colors } from '../lib/theme';
import { formatAmount } from '../lib/format';
import { useI18n } from '../lib/i18n';

export function useMoney() {
  const { t } = useI18n();
  return (amount, currency) => `${currency && currency !== 'LKR' ? currency : t('money.currency')} ${formatAmount(amount)}`;
}

export default function Money({ amount, currency, style, tone }) {
  const fmt = useMoney();
  const color = tone === 'danger' ? colors.danger : tone === 'success' ? colors.primary : colors.text;
  return <Text style={[{ fontWeight: '700', color, fontVariant: ['tabular-nums'] }, style]}>{fmt(amount, currency)}</Text>;
}
