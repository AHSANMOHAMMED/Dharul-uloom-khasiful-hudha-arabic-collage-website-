import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLang } from '../../components/erp/ui';
import { formatDate, rpc } from '../../lib/erp/rpc';
import { CERTIFICATE_TYPES, labelOf } from '../../lib/erp/campusApi';
import KhatamPattern from '../../components/KhatamPattern';
import { tx } from '../../lib/tx';

/** Public certificate verification (no login). Calls verify_certificate (anon). */
export default function VerifyCertificate() {
  const { t, ar } = useLang();
  const { code: routeCode } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(routeCode || '');
  const [state, setState] = useState({ loading: false, result: null, error: null });

  const verify = useCallback(async (value) => {
    const c = String(value || '').trim();
    if (!c) return;
    setState({ loading: true, result: null, error: null });
    try {
      const result = await rpc('verify_certificate', { p_code: c });
      setState({ loading: false, result, error: null });
    } catch (error) {
      setState({ loading: false, result: null, error });
    }
  }, []);

  useEffect(() => {
    if (routeCode) {
      setCode(routeCode);
      verify(routeCode);
    }
  }, [routeCode, verify]);

  const submit = (e) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) return;
    if (c === (routeCode || '').toUpperCase()) verify(c);
    else navigate(`/verify/${encodeURIComponent(c)}`);
  };

  const r = state.result;
  const found = r && r.status !== 'not_found';

  return (
    <div className="min-h-screen bg-parchment-50 pt-24 pb-16 px-4 relative overflow-hidden" dir={tx('rtl', 'ltr')}>
      <KhatamPattern className="opacity-[0.04]" strokeColor="#0B3B2E" id="verify-cert-khatam" />

      <div className="max-w-xl mx-auto space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 block">
            {tx('السجل الأكاديمي المعتمد', 'Official Sanad Registry')}
          </span>
          <h1 className="text-3xl font-serif font-bold text-ink-green-900">
            {t('Certificate verification', 'التحقق من صحة الشهادة والسند')}
          </h1>
          <p className="text-ink-text-secondary text-xs sm:text-sm max-w-md mx-auto">
            {t('Enter the verification code printed on the certificate.', 'أدخل رمز التحقق المطبوع على الشهادة للتأكد من موثوقيتها الأكاديمية.')}
          </p>
        </div>

        <form onSubmit={submit} className="bg-paper-white rounded-[14px] shadow-manuscript-sm border border-sand-border p-5 flex flex-col sm:flex-row gap-3">
          <label className="sr-only" htmlFor="verify-code">{t('Verification code', 'رمز التحقق')}</label>
          <input
            id="verify-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="A1B2C3D4E5F6"
            className="flex-1 rounded-[10px] border border-sand-border bg-parchment-50 px-4 py-2.5 font-mono uppercase tracking-wider text-ink-text-primary focus:outline-none focus:border-emerald-700 text-sm"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={state.loading || !code.trim()}
            className="rounded-[10px] bg-emerald-700 hover:bg-emerald-500 text-white font-medium px-6 py-2.5 disabled:opacity-50 text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">{'verified'}</span>
            <span>{state.loading ? t('Checking…', 'جارٍ التحقق…') : t('Verify', 'تحقق الآن')}</span>
          </button>
        </form>

        {state.error && (
          <div className="rounded-[14px] border border-feedback-danger/30 bg-feedback-danger/10 text-feedback-danger p-4 text-xs font-medium">
            {state.error.message || String(state.error)}
          </div>
        )}

        {r && !found && (
          <div className="rounded-[14px] border border-sand-border bg-paper-white p-6 text-center space-y-2 shadow-manuscript-sm">
            <span className="material-symbols-outlined text-3xl text-feedback-warning">{'warning'}</span>
            <h2 className="text-lg font-serif font-bold text-ink-green-900">{t('Certificate not found', 'الشهادة غير موجودة في السجل')}</h2>
            <p className="text-ink-text-muted text-xs max-w-md mx-auto">
              {t(
                'No certificate matches this code. Check the code and try again, or contact the issuing institution.',
                'لا توجد شهادة مطابقة لهذا الرمز. يرجى التأكد من الرمز المدخل أو مراجعة إدارة الكلية.'
              )}
            </p>
          </div>
        )}

        {found && (
          <div className={`rounded-[14px] border p-6 shadow-manuscript-md ${
            r.valid ? 'border-sand-border bg-paper-white' : 'border-feedback-danger/30 bg-feedback-danger/5'
          }`}>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-sand-border/60">
              <span className={`material-symbols-outlined text-3xl ${r.valid ? 'text-emerald-700' : 'text-feedback-danger'}`} aria-hidden>
                {r.valid ? 'verified_user' : 'cancel'}
              </span>
              <div>
                <h2 className={`font-serif text-lg font-bold ${r.valid ? 'text-ink-green-900' : 'text-feedback-danger'}`}>
                  {r.valid ? t('Valid certificate', 'شهادة رسمية معتمدة وصحيحة') : t('This certificate has been revoked', 'تم إلغاء هذه الشهادة')}
                </h2>
                <p className="text-xs text-ink-text-muted">{(ar && r.institution_ar) || r.institution}</p>
              </div>
            </div>

            <dl className="divide-y divide-sand-border/60 text-xs">
              {[
                [t('Student', 'اسم الطالب'), r.student_name],
                [t('Certificate', 'عنوان الشهادة'), r.title],
                [t('Type', 'النوع والتخصص'), labelOf(CERTIFICATE_TYPES, r.type, ar)],
                [t('Serial no.', 'الرقم التسلسلي'), r.serial_no],
                [t('Issued on', 'تاريخ المنح والإصدار'), formatDate(r.issued_date)],
                [t('Institution', 'المؤسسة المانحة'), (ar && r.institution_ar) || r.institution],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-ink-text-muted font-medium">{k}</dt>
                  <dd className="font-semibold text-ink-text-primary text-end font-mono">{v || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
