import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import KhatamPattern from '../components/KhatamPattern';
import { waitForPayment } from '../lib/paymentsApi';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import Icon from '../components/Icon';
import { tx } from '../lib/tx';

export default function PaymentSuccess() {
  useTranslation();
  const [params] = useSearchParams();
  const orderId = params.get('order_id');
  const fromApp = params.get('app') === '1';
  const appLink = `kashifulhudha://payment-success${orderId ? `?order_id=${encodeURIComponent(orderId)}` : ''}`;

  const [state, setState] = useState('checking'); // checking | paid | processing | failed
  const [txn, setTxn] = useState(null);
  const cancelled = useRef(false);

  // Payments started in the mobile app return here from PayHere; hand control
  // back to the app via its deep link (in-app browser session closes on it).
  useEffect(() => {
    if (fromApp) window.location.replace(appLink);
  }, [fromApp, appLink]);

  const poll = useCallback(async () => {
    if (fromApp) return;
    if (!orderId || !isSupabaseConfigured) {
      setState('processing');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setState('processing');
      return;
    }
    setState('checking');
    const res = await waitForPayment(orderId, { isCancelled: () => cancelled.current });
    if (cancelled.current) return;
    setTxn(res.txn);
    if (res.status === 'paid') setState('paid');
    else if (res.status === 'failed' || res.status === 'cancelled') setState('failed');
    else setState('processing');
  }, [orderId, fromApp]);

  useEffect(() => {
    cancelled.current = false;
    poll();
    return () => {
      cancelled.current = true;
    };
  }, [poll]);

  const handlePrint = () => {
    window.print();
  };

  const statusLabel =
    state === 'paid'
      ? tx('تم التأكيد', 'Confirmed')
      : state === 'failed'
        ? tx('فشل الدفع', 'Failed')
        : state === 'checking'
          ? tx('جارٍ التأكيد…', 'Confirming…')
          : tx('بانتظار تأكيد PayHere', 'Awaiting PayHere confirmation');

  const heading =
    state === 'paid'
      ? tx('تم استلام الدفع بنجاح', 'Payment Received Successfully')
      : state === 'failed'
        ? tx('لم تكتمل عملية الدفع', 'Payment was not completed')
        : tx('جارٍ تأكيد الدفع', 'Confirming your payment');

  const body =
    state === 'paid'
      ? tx('شكراً لك. تم تحديث رسومك.', 'Thank you. Your fee balance has been updated.')
      : state === 'failed'
        ? tx('لم يؤكد PayHere هذا الدفع. يمكنك المحاولة مرة أخرى من لوحة التحكم.', 'PayHere did not confirm this payment. You can try again from the dashboard.')
        : tx(
          'شكراً لك. سيتم تحديث حالة الرسوم بعد تأكيد PayHere.',
          'Thank you. Your fee balance will update once PayHere confirms the payment.',
        );

  const crestIcon = state === 'paid' ? 'check_circle' : state === 'failed' ? 'cancel' : 'hourglass_top';
  const crestTone =
    state === 'paid'
      ? 'bg-mint-wash-100 text-emerald-700 border-emerald-700/20'
      : state === 'failed'
        ? 'bg-red-50 text-red-700 border-red-700/20'
        : 'bg-amber-50 text-amber-800 border-amber-700/20';

  return (
    <div className="min-h-screen bg-parchment-50 flex items-center justify-center p-6 relative overflow-hidden">
      <KhatamPattern className="opacity-[0.05]" strokeColor="#0B3B2E" id="pay-success-khatam" />

      <div className="relative z-10 max-w-md w-full rounded-[14px] bg-paper-white border border-sand-border p-8 sm:p-10 shadow-manuscript-md text-center space-y-6">
        <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center border ${crestTone}`}>
          <Icon name={crestIcon} className="text-3xl" />
        </div>

        <div>
          <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-mint-wash-100 px-3 py-1 rounded-full mb-2">
            {statusLabel}
          </span>
          <h1 className="font-serif text-2xl font-bold text-ink-green-900">{heading}</h1>
          <p className="text-ink-text-secondary text-sm mt-2 leading-relaxed">{body}</p>
        </div>

        <div className="rounded-[10px] bg-parchment-50 border border-sand-border p-4 text-xs space-y-2 text-start">
          <div className="flex justify-between py-1 border-b border-sand-border/60">
            <span className="text-ink-text-muted">{tx('رقم المعاملة', 'Reference / Order')}</span>
            <span className="font-mono font-semibold text-ink-green-900">{orderId || '—'}</span>
          </div>
          {txn?.amount != null && (
            <div className="flex justify-between py-1 border-b border-sand-border/60">
              <span className="text-ink-text-muted">{tx('المبلغ', 'Amount')}</span>
              <span className="text-ink-text-primary tabular-nums">
                {txn.currency || 'LKR'} {Number(txn.amount).toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between py-1 border-b border-sand-border/60">
            <span className="text-ink-text-muted">{tx('التاريخ', 'Date')}</span>
            <span className="text-ink-text-primary tabular-nums">{new Date().toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-sand-border/60">
            <span className="text-ink-text-muted">{tx('بوابة الدفع', 'Gateway')}</span>
            <span className="text-ink-text-primary">{tx('PayHere', 'PayHere')}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-ink-text-muted">{tx('الحالة', 'Status')}</span>
            <span className={`font-semibold ${state === 'failed' ? 'text-red-700' : 'text-emerald-700'}`}>{statusLabel}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          {fromApp && (
            <a
              href={appLink}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-[10px] bg-emerald-700 text-white font-medium text-sm hover:bg-ink-green-900 transition-colors shadow-xs"
            >
              <Icon name="smartphone" className="text-[18px]" />
              <span>{tx('العودة إلى التطبيق', 'Return to the app')}</span>
            </a>
          )}

          {state === 'processing' && !fromApp && (
            <button
              type="button"
              onClick={poll}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-[10px] border border-sand-border bg-paper-white text-ink-text-primary font-medium text-sm hover:bg-parchment-50 transition-colors"
            >
              <Icon name="refresh" className="text-[18px]" />
              <span>{tx('تحقق مرة أخرى', 'Check again')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-[10px] bg-emerald-700 text-white font-medium text-sm hover:bg-ink-green-900 transition-colors shadow-xs"
          >
            <Icon name="print" className="text-[18px]" />
            <span>{tx('طباعة هذه الصفحة', 'Print this page')}</span>
          </button>

          <Link
            to="/dashboard"
            className="w-full flex items-center justify-center gap-2 h-11 rounded-[10px] border border-sand-border bg-paper-white text-ink-text-primary font-medium text-sm hover:bg-parchment-50 transition-colors"
          >
            <Icon name="dashboard" className="text-[18px]" />
            <span>{tx('العودة للوحة التحكم', 'Back to dashboard')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
