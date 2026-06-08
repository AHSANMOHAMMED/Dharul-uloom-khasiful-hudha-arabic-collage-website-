import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const PaymentSuccess = () => {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [params] = useSearchParams();
  const orderId = params.get('order_id');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center space-y-4">
        <div className="text-5xl">✅</div>
        <h1 className="text-2xl font-bold text-islamic-green">
          {ar ? 'تم استلام الدفع' : 'Payment Received'}
        </h1>
        <p className="text-gray-600 text-sm">
          {ar
            ? 'شكراً لك. سيتم تحديث حالة الرسوم بعد تأكيد PayHere.'
            : 'Thank you. Your fee balance will update once PayHere confirms the payment.'}
        </p>
        {orderId && <p className="text-xs text-gray-400 font-mono">Order: {orderId}</p>}
        <Link to="/dashboard" className="inline-block mt-4 px-6 py-2 bg-islamic-green text-white rounded-lg font-semibold">
          {ar ? 'العودة للوحة التحكم' : 'Back to dashboard'}
        </Link>
      </div>
    </div>
  );
};

export default PaymentSuccess;
