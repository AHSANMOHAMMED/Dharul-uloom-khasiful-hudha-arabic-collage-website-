import { useNavigate } from 'react-router-dom';
import { tx } from '../../lib/tx';

/**
 * Standard tab header: title, optional Back, optional Print/Export actions.
 */
export default function PortalTabChrome({
  title_en,
  title_ar,
  subtitle_en,
  subtitle_ar,
  showBack = true,
  onBack,
  onPrint,
  onExport,
  children,
}) {
  const navigate = useNavigate();
  const goBack = () => {
    if (onBack) onBack();
    else if (window.history.length > 1) navigate(-1);
    else navigate('/dashboard');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {showBack && (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E8E1D0] bg-white text-[11px] font-semibold text-[#0B3B2E] hover:bg-[#FBF8F0]"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                {tx('رجوع', 'Back')}
              </button>
            )}
            <h2 className="font-serif text-lg sm:text-xl font-bold text-[#0B3B2E]">
              {tx(title_ar, title_en)}
            </h2>
          </div>
          {(subtitle_en || subtitle_ar) && (
            <p className="text-xs text-[#4A5E56] mt-1">{tx(subtitle_ar, subtitle_en)}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B3B2E] text-white text-xs font-semibold hover:bg-[#11694A]"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              {tx('طباعة', 'Print')}
            </button>
          )}
          {onExport && (
            <button
              type="button"
              onClick={onExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8E1D0] bg-white text-xs font-semibold text-[#0B3B2E] hover:bg-[#FBF8F0]"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              {tx('تصدير', 'Export')}
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
