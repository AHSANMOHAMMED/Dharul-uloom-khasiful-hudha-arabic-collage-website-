import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLang } from '../../components/erp/ui';
import { formatDate, rpc } from '../../lib/erp/rpc';
import { CERTIFICATE_TYPES, labelOf } from '../../lib/erp/campusApi';
import { tx } from '../../lib/tx';

/** Public certificate verification (no login). Calls verify_certificate (anon). */
export default function VerifyCertificate() {
  const { t, ar, lang } = useLang();
  const dir = { ar: 'rtl' }[lang] || 'ltr';
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
    <div className="min-h-screen bg-slate-50 pt-24 pb-16 px-4" dir={dir}>
      <div className="max-w-xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-emerald-800">{t('Certificate verification', 'التحقق من الشهادة')}</h1>
          <p className="text-slate-600 mt-2">{t('Enter the verification code printed on the certificate.', 'أدخل رمز التحقق المطبوع على الشهادة.')}</p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row gap-3">
          <label className="sr-only" htmlFor="verify-code">{t('Verification code', 'رمز التحقق')}</label>
          <input
            id="verify-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="A1B2C3D4E5F6"
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 font-mono uppercase tracking-wider text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            autoComplete="off"
          />
          <button type="submit" disabled={state.loading || !code.trim()} className="rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold px-6 py-2.5 disabled:opacity-50">
            {state.loading ? t('Checking…', 'جارٍ التحقق…') : t('Verify', 'تحقق')}
          </button>
        </form>

        {state.error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 text-red-800 p-4 text-sm">{state.error.message || String(state.error)}</div>
        )}

        {r && !found && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <div className="text-4xl mb-2" aria-hidden>⚠️</div>
            <h2 className="text-xl font-bold text-amber-900">{t('Certificate not found', 'الشهادة غير موجودة')}</h2>
            <p className="text-amber-800 mt-1 text-sm">{t('No certificate matches this code. Check the code and try again, or contact the issuing institution.', 'لا توجد شهادة بهذا الرمز. تحقق من الرمز أو تواصل مع المؤسسة.')}</p>
          </div>
        )}

        {found && (
          <div className={`rounded-2xl border p-6 ${r.valid ? 'border-emerald-200 bg-white' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-center gap-3 mb-4">
              <span className={`text-3xl ${r.valid ? 'text-emerald-600' : 'text-red-600'}`} aria-hidden>{r.valid ? '✔' : '✖'}</span>
              <div>
                <h2 className={`text-xl font-bold ${r.valid ? 'text-emerald-800' : 'text-red-800'}`}>
                  {r.valid ? t('Valid certificate', 'شهادة صحيحة') : t('This certificate has been revoked', 'تم إلغاء هذه الشهادة')}
                </h2>
                <p className="text-sm text-slate-500">{tx(r.institution_ar || r.institution, r.institution)}</p>
              </div>
            </div>
            <dl className="divide-y divide-slate-100 text-sm">
              {[
                [t('Student', 'الطالب'), r.student_name],
                [t('Certificate', 'الشهادة'), r.title],
                [t('Type', 'النوع'), labelOf(CERTIFICATE_TYPES, r.type, ar)],
                [t('Serial no.', 'الرقم التسلسلي'), r.serial_no],
                [t('Issued on', 'تاريخ الإصدار'), formatDate(r.issued_date)],
                [t('Institution', 'المؤسسة'), tx(r.institution_ar || r.institution, r.institution)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-semibold text-slate-900 text-end">{v || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
