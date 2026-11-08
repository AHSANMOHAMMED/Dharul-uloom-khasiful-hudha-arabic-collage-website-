import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import KhatamPattern from '../components/KhatamPattern';
import { tx } from '../lib/tx';

export default function PaymentCancel() {
  useTranslation();
  const [params] = useSearchParams();
  const orderId = params.get('order_id');
  const fromApp = params.get('app') === '1';
  const appLink = `kashifulhudha://payment-cancel${orderId ? `?order_id=${encodeURIComponent(orderId)}` : ''}`;

  useEffect(() => {
    if (fromApp) window.location.replace(appLink);
  }, [fromApp, appLink]);

  return (
    <div className="min-h-screen bg-parchment-50 flex items-center justify-center p-6 relative overflow-hidden">
      <KhatamPattern className="opacity-[0.05]" strokeColor="#0B3B2E" id="pay-cancel-khatam" />

      <div className="relative z-10 max-w-md w-full rounded-[14px] bg-paper-white border border-sand-border p-8 sm:p-10 shadow-manuscript-md text-center space-y-6">
        
        {/* Status Crest */}
        <div className="w-16 h-16 rounded-full bg-gold-wash-100 text-feedback-warning mx-auto flex items-center justify-center border border-brass-gold-500/30">
          <span className="material-symbols-outlined text-3xl">{'cancel'}</span>
        </div>

        <div>
          <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-feedback-warning bg-gold-wash-100 px-3 py-1 rounded-full mb-2">
            {tx('تم إلغاء المعاملة', 'Transaction Cancelled')}
          </span>
          <h1 className="font-serif text-2xl font-bold text-ink-green-900">
            {tx('تم إلغاء عملية الدفع', 'Payment Process Cancelled')}
          </h1>
          <p className="text-ink-text-secondary text-sm mt-2 leading-relaxed">
            {tx(
              'لم يتم خصم أي مبالغ. يمكنك المحاولة مجدداً في أي وقت عبر بوابتك الإلكترونية.',
              'No funds were deducted. You may retry your institutional fee settlement at any time from your student or parent portal.'
            )}
          </p>
        </div>

        {orderId && (
          <div className="rounded-[10px] bg-parchment-50 border border-sand-border p-3 text-xs flex justify-between items-center text-left">
            <span className="text-ink-text-muted">{tx('الرقم المرجعي', 'Order Ref')}</span>
            <span className="font-mono font-semibold text-ink-text-primary">{orderId}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 pt-2">
          {fromApp && (
            <a
              href={appLink}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-[10px] bg-emerald-700 text-white font-medium text-sm hover:bg-ink-green-900 transition-colors shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">{'smartphone'}</span>
              <span>{tx('العودة إلى التطبيق', 'Return to Mobile App')}</span>
            </a>
          )}

          <Link
            to="/dashboard"
            className="w-full flex items-center justify-center gap-2 h-11 rounded-[10px] bg-emerald-700 text-white font-medium text-sm hover:bg-ink-green-900 transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">{'refresh'}</span>
            <span>{tx('المحاولة مجدداً في البوابة', 'Retry from Portal')}</span>
          </Link>

          <Link
            to="/contact"
            className="w-full flex items-center justify-center gap-2 h-11 rounded-[10px] border border-sand-border bg-paper-white text-ink-text-primary font-medium text-sm hover:bg-parchment-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">{'help_outline'}</span>
            <span>{tx('المساعدة والدعم المالي', 'Need Financial Help? Contact Us')}</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
