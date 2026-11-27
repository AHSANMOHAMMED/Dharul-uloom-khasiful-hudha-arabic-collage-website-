import { useNavigate } from 'react-router-dom';
import { tx } from '../../lib/tx';
import Icon from '../Icon';

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
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0B3B2E]"
              >
                <Icon name="arrow_back" className="text-[16px] rtl:rotate-180" />
                {tx('رجوع', 'Back')}
              </button>
            )}
            <h2 className="font-sans text-lg sm:text-xl font-semibold text-slate-900">
              {tx(title_ar, title_en)}
            </h2>
          </div>
          {(subtitle_en || subtitle_ar) && (
            <p className="text-xs text-slate-500 mt-1">{tx(subtitle_ar, subtitle_en)}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0B3B2E] text-white text-xs font-semibold hover:bg-[#11694A]"
            >
              <Icon name="print" className="text-[16px]" />
              {tx('طباعة', 'Print')}
            </button>
          )}
          {onExport && (
            <button
              type="button"
              onClick={onExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0B3B2E]"
            >
              <Icon name="download" className="text-[16px]" />
              {tx('تصدير', 'Export')}
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
