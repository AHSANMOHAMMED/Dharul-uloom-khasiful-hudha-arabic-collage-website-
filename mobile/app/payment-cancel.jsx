import { router, useLocalSearchParams } from 'expo-router';
import { useI18n } from '../lib/i18n';
import { markOrderHandled } from '../lib/payments';
import { colors } from '../lib/theme';
import { Screen, Card, Txt, Button, EmptyState, KeyValue } from '../components';

export default function PaymentCancel() {
  const { order_id: orderId } = useLocalSearchParams();
  const { t } = useI18n();
  markOrderHandled(orderId);
  return (
    <Screen>
      <Card accent={colors.danger}>
        <EmptyState icon="close-circle-outline" message="" />
        <Txt variant="title" center>{t('payment.cancelTitle')}</Txt>
        <Txt variant="muted" center>{t('payment.cancelBody')}</Txt>
        {orderId ? <KeyValue label={t('payment.order')} value={String(orderId)} /> : null}
      </Card>
      <Button title={t('payment.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}
