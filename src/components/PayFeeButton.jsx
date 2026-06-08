import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { payFeeOnline } from '../lib/paymentsApi';

const PayFeeButton = ({ fee, className = '' }) => {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!fee || fee.status === 'completed') return null;

  const remaining = Number(fee.total_due) - Number(fee.paid_amount);
  if (remaining <= 0) return null;

  const handlePay = async () => {
    setError('');
    setLoading(true);
    try {
      await payFeeOnline(fee.id);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className="w-full py-3 mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition disabled:opacity-50"
      >
        {loading
          ? (ar ? 'جاري التوجيه إلى PayHere...' : 'Redirecting to PayHere...')
          : (ar ? `ادفع LKR ${remaining.toLocaleString()} عبر الإنترنت` : `Pay LKR ${remaining.toLocaleString()} online`)}
      </button>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
};

export default PayFeeButton;
