import { useTranslation } from 'react-i18next';
import { tx } from '../../lib/tx';

/** One numeric field for a 6-digit one-time code (works with SMS/OS autofill). */
export default function CodeInput({ value, onChange, autoFocus, disabled, id = 'otp-code' }) {
  useTranslation();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-ink-text-secondary">
        {tx('رمز التحقق', 'Verification code')}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        dir="ltr"
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="••••••"
        className="w-full h-14 rounded-[12px] border border-sand-border bg-paper-white text-center font-mono text-2xl tracking-[0.6em] text-ink-green-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/40 focus:border-emerald-700 disabled:opacity-60"
      />
    </div>
  );
}
