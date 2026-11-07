import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tx } from '../lib/tx';

const PaymentSuccess = () => {
  useTranslation(); // subscribe: re-render on language change
  const [params] = useSearchParams();
  const orderId = params.get('order_id');
  const fromApp = params.get('app') === '1';
  const appLink = `kashifulhudha://payment-success${orderId ? `?order_id=${encodeURIComponent(orderId)}` : ''}`;

  // Payments started in the mobile app return here from PayHere; hand control
  // back to the app via its deep link (in-app browser session closes on it).
  useEffect(() => {
    if (fromApp) window.location.replace(appLink);
  }, [fromApp, appLink]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center space-y-4">
        <div className="text-5xl">✅</div>
        <h1 className="text-2xl font-bold text-islamic-green">
          {tx('تم استلام الدفع', 'Payment Received')}
        </h1>
        <p className="text-gray-600 text-sm">
          {tx('شكراً لك. سيتم تحديث حالة الرسوم بعد تأكيد PayHere.', 'Thank you. Your fee balance will update once PayHere confirms the payment.')}
        </p>
        {orderId && <p className="text-xs text-gray-400 font-mono">{tx('الطلب', 'Order')}: {orderId}</p>}
        {fromApp && (
          <a href={appLink} className="block mt-2 px-6 py-2 bg-emerald-700 text-white rounded-lg font-semibold">
            {tx('العودة إلى التطبيق', 'Return to the app')}
          </a>
        )}
        <Link to="/dashboard" className="inline-block mt-4 px-6 py-2 bg-islamic-green text-white rounded-lg font-semibold">
          {tx('العودة للوحة التحكم', 'Back to dashboard')}
        </Link>
      </div>
    </div>
  );
};

export default PaymentSuccess;
