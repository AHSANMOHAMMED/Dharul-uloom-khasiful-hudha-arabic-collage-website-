import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import KhatamPattern from '../components/KhatamPattern';
import { tx } from '../lib/tx';

export default function PaymentSuccess() {
  useTranslation();
  const [params] = useSearchParams();
  const orderId = params.get('order_id') || `TXN-KH-${Math.floor(100000 + Math.random() * 900000)}`;
  const fromApp = params.get('app') === '1';
  const appLink = `kashifulhudha://payment-success${orderId ? `?order_id=${encodeURIComponent(orderId)}` : ''}`;

  useEffect(() => {
    if (fromApp) window.location.replace(appLink);
  }, [fromApp, appLink]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-parchment-50 flex items-center justify-center p-6 relative overflow-hidden">
      <KhatamPattern className="opacity-[0.05]" strokeColor="#0B3B2E" id="pay-success-khatam" />

      <div className="relative z-10 max-w-md w-full rounded-[14px] bg-paper-white border border-sand-border p-8 sm:p-10 shadow-manuscript-md text-center space-y-6">
        
        {/* Status Crest */}
        <div className="w-16 h-16 rounded-full bg-mint-wash-100 text-emerald-700 mx-auto flex items-center justify-center border border-emerald-700/20">
          <span className="material-symbols-outlined text-3xl">check_circle</span>
        </div>

        <div>
          <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-mint-wash-100 px-3 py-1 rounded-full mb-2">
            {tx('تم الدفع بنجاح', 'Payment Confirmed')}
          </span>
          <h1 className="font-serif text-2xl font-bold text-ink-green-900">
            {tx('تم استلام الدفع بنجاح', 'Payment Received Successfully')}
          </h1>
          <p className="text-ink-text-secondary text-sm mt-2 leading-relaxed">
            {tx(
              'شكراً لك. سيتم تحديث رصيد الرسوم فور تأكيد PayHere.',
              'Thank you for your contribution. Your institutional records and fee balances have been updated.'
            )}
          </p>
        </div>

        {/* Transaction Slip Details */}
        <div className="rounded-[10px] bg-parchment-50 border border-sand-border p-4 text-xs space-y-2 text-left">
          <div className="flex justify-between py-1 border-b border-sand-border/60">
            <span className="text-ink-text-muted">{tx('رقم المعاملة', 'Reference / Order')}</span>
            <span className="font-mono font-semibold text-ink-green-900">{orderId}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-sand-border/60">
            <span className="text-ink-text-muted">{tx('التاريخ', 'Date')}</span>
            <span className="text-ink-text-primary tabular-nums">{new Date().toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-sand-border/60">
            <span className="text-ink-text-muted">{tx('بوابة الدفع', 'Gateway')}</span>
            <span className="text-ink-text-primary">PayHere Official</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-ink-text-muted">{tx('الحالة', 'Status')}</span>
            <span className="font-semibold text-emerald-700">{tx('مكتمل', 'Completed')}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 pt-2">
          {fromApp && (
            <a
              href={appLink}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-[10px] bg-emerald-700 text-white font-medium text-sm hover:bg-ink-green-900 transition-colors shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">smartphone</span>
              <span>{tx('العودة إلى التطبيق', 'Return to Mobile App')}</span>
            </a>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-[10px] bg-emerald-700 text-white font-medium text-sm hover:bg-ink-green-900 transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            <span>{tx('طباعة الإيصال', 'Print Official Receipt')}</span>
          </button>

          <Link
            to="/dashboard"
            className="w-full flex items-center justify-center gap-2 h-11 rounded-[10px] border border-sand-border bg-paper-white text-ink-text-primary font-medium text-sm hover:bg-parchment-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">dashboard</span>
            <span>{tx('العودة للوحة التحكم', 'Back to Portal')}</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
