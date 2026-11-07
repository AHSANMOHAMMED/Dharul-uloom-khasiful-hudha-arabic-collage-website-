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
        className="w-full py-2.5 mt-3 bg-[#11694A] hover:bg-[#0B3B2E] text-white font-sans font-bold rounded-xl text-xs sm:text-sm transition shadow-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        {loading
          ? (ar ? 'جاري التوجيه إلى بوابة PayHere...' : 'Redirecting to PayHere gateway...')
          : (ar ? `سداد LKR ${remaining.toLocaleString()} عبر الإنترنت` : `Pay LKR ${remaining.toLocaleString()} online`)}
      </button>
      {error && <p className="text-xs text-[#B91C1C] mt-2 text-center">{error}</p>}
    </div>
  );
};

export default PayFeeButton;
