import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, setLanguage, tx } from '../lib/tx';

/** EN / العربية / தமிழ் selector (Tamil dictionary loads on demand). */
export default function LanguageSelect({ className = '' }) {
  const { i18n } = useTranslation();
  return (
    <select
      aria-label={tx('اللغة (Language)', 'Language')}
      value={SUPPORTED_LANGUAGES.some((l) => l.code === i18n.language) ? i18n.language : 'en'}
      onChange={(e) => setLanguage(e.target.value)}
      className={`px-2.5 py-1.5 rounded-lg bg-white text-[#0B3B2E] font-semibold text-xs border border-[#E8E1D0] hover:bg-[#FBF8F0] focus:border-[#11694A] focus:outline-none transition-colors cursor-pointer ${className}`}
    >
      {SUPPORTED_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
