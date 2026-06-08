import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const PaymentCancel = () => {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [params] = useSearchParams();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center space-y-4">
        <div className="text-5xl">⚠️</div>
        <h1 className="text-2xl font-bold text-amber-600">
          {ar ? 'تم إلغاء الدفع' : 'Payment Cancelled'}
        </h1>
        <p className="text-gray-600 text-sm">
          {ar ? 'لم تكتمل عملية الدفع. يمكنك المحاولة مرة أخرى من لوحة التحكم.' : 'Payment was not completed. You can try again from your dashboard.'}
        </p>
        {params.get('order_id') && (
          <p className="text-xs text-gray-400 font-mono">Order: {params.get('order_id')}</p>
        )}
        <Link to="/dashboard" className="inline-block mt-4 px-6 py-2 bg-gray-800 text-white rounded-lg font-semibold">
          {ar ? 'العودة للوحة التحكم' : 'Back to dashboard'}
        </Link>
      </div>
    </div>
  );
};

export default PaymentCancel;
