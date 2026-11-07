import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { markOrderHandled, waitForPayment, receiptForTxn } from '../lib/payments';
import { formatDateTime } from '../lib/format';
import { colors } from '../lib/theme';
import { Screen, Card, Txt, Button, Loading, KeyValue, useMoney, EmptyState } from '../components';

export default function PaymentSuccess() {
  const { order_id: orderId } = useLocalSearchParams();
  const { t } = useI18n();
  const money = useMoney();
  const { session, loading: authLoading } = useAuth();
  const [state, setState] = useState('checking'); // checking | paid | processing | failed
  const [txn, setTxn] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const cancelled = useRef(false);

  markOrderHandled(orderId);

  const poll = useCallback(async () => {
    if (!orderId || !session) {
      setState('processing');
      return;
    }
    setState('checking');
    const res = await waitForPayment(String(orderId), { isCancelled: () => cancelled.current });
    if (cancelled.current) return;
    setTxn(res.txn);
    if (res.status === 'paid') {
      setState('paid');
      setReceipt(await receiptForTxn(res.txn?.id));
    } else if (res.status === 'failed' || res.status === 'cancelled') setState('failed');
    else setState('processing');
  }, [orderId, session]);

  useEffect(() => {
    cancelled.current = false;
    if (!authLoading) poll();
    return () => {
      cancelled.current = true;
    };
  }, [authLoading, poll]);

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (state === 'checking') return <Loading label={t('payment.checking')} />;

  return (
    <Screen>
      <Card accent={state === 'paid' ? colors.primary : state === 'failed' ? colors.danger : colors.gold}>
        <EmptyState
          icon={state === 'paid' ? 'checkmark-circle' : state === 'failed' ? 'close-circle' : 'time-outline'}
          message=""
        />
        <Txt variant="title" center>
          {state === 'paid' ? t('payment.confirmed') : state === 'failed' ? t('payment.failed') : t('payment.successTitle')}
        </Txt>
        {state === 'processing' ? <Txt variant="muted" center>{session ? t('payment.processing') : t('auth.signInRequired')}</Txt> : null}
        {orderId ? <KeyValue label={t('payment.order')} value={String(orderId)} /> : null}
        {txn ? <KeyValue label={t('payment.amount')} value={money(txn.amount, txn.currency)} strong /> : null}
        {receipt ? (
          <>
            <KeyValue label={t('payment.receiptNo')} value={receipt.receipt_no} strong />
            <KeyValue label={t('common.date')} value={formatDateTime(receipt.paid_at)} />
          </>
        ) : null}
      </Card>
      {state === 'processing' && session ? <Button title={t('payment.refresh')} icon="refresh-outline" variant="outline" onPress={poll} /> : null}
      <Button title={session ? t('payment.back') : t('auth.signIn')} onPress={session ? back : () => router.replace('/login')} />
    </Screen>
  );
}
