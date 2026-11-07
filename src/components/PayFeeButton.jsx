import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { payFeeOnline } from '../lib/paymentsApi';
import { tx } from '../lib/tx';

const PayFeeButton = ({ fee, className = '' }) => {
  useTranslation(); // subscribe: re-render on language change
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
          ? (tx('جاري التوجيه إلى PayHere...', 'Redirecting to PayHere...'))
          : tx('ادفع LKR {amount} عبر الإنترنت', 'Pay LKR {amount} online').replace('{amount}', remaining.toLocaleString())}
      </button>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
};

export default PayFeeButton;
