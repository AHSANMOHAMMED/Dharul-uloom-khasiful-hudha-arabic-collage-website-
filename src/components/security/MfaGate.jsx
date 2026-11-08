import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import KhatamPattern from '../KhatamPattern';
import { tx } from '../../lib/tx';
import MfaChallenge from './MfaChallenge';
import MfaEnroll from './MfaEnroll';

/**
 * Wraps authenticated workspaces. The database already refuses privileged
 * data to a session that owes 2FA; this replaces the resulting empty screens
 * with the step the user actually needs to take.
 */
export default function MfaGate({ children }) {
  useTranslation();
  const { mfaChallengeNeeded, mfaSetupNeeded } = useAuth();

  if (!mfaChallengeNeeded && !mfaSetupNeeded) return children;

  return (
    <div className="min-h-[80vh] bg-parchment-50 flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <KhatamPattern className="opacity-[0.04]" strokeColor="#0B3B2E" id="mfa-gate-khatam" />
      <div className="relative z-10 w-full max-w-md rounded-[14px] bg-paper-white border border-sand-border shadow-manuscript-md p-6 sm:p-8">
        {mfaChallengeNeeded ? (
          <MfaChallenge />
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[28px] text-brass-gold-500" aria-hidden>{'encrypted'}</span>
              <div>
                <h2 className="font-serif text-xl font-semibold text-ink-green-900">
                  {tx('مطلوب إعداد التحقق بخطوتين', 'Set up two-step verification')}
                </h2>
                <p className="text-sm text-ink-text-secondary mt-1">
                  {tx(
                    'تشترط الكلية التحقق بخطوتين للحسابات التي تصل إلى المالية والامتحانات وشؤون الموظفين. يستغرق الإعداد دقيقة واحدة.',
                    'The college requires two-step verification for accounts with access to finance, exams or staff records. Setup takes about a minute.'
                  )}
                </p>
              </div>
            </div>
            <MfaEnroll />
          </div>
        )}
      </div>
    </div>
  );
}
