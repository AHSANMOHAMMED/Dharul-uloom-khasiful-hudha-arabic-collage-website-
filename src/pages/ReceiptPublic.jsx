import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { rpc, query } from '../lib/erp/rpc';
import { useAuth } from '../context/AuthContext';
import { tx } from '../lib/tx';
import { printReceipt, receiptPdfUrl } from '../lib/receiptPrint';
import ReceiptSlip from '../components/ReceiptSlip';

/**
 * /r/:token  — public secret-link receipt (no login; fee_receipt_by_token)
 * /receipt/:id — signed-in receipt view (fee_receipt_details, permission-checked)
 */
export default function ReceiptPublic() {
  useTranslation();
  const { token, id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState({ loading: true, receipt: null, error: null });

  const load = useCallback(async () => {
    setState({ loading: true, receipt: null, error: null });
    try {
      let receipt = null;
      if (token) {
        receipt = /^[0-9a-f]{32}$/i.test(token) ? await rpc('fee_receipt_by_token', { p_token: token.toLowerCase() }) : null;
      } else if (id) {
        receipt = await rpc('fee_receipt_details', { p_receipt: id });
        if (receipt && receipt.payer_name === undefined) {
          // payer name lives on fee_receipts (RLS: own / child / finance viewer)
          const rows = await query('fee_receipts', (q) => q.select('payer_name').eq('id', id).limit(1)).catch(() => []);
          receipt = { ...receipt, payer_name: rows?.[0]?.payer_name ?? null };
        }
      }
      setState({ loading: false, receipt: receipt && receipt.receipt_no ? receipt : null, error: null });
    } catch (error) {
      const notFound = /not found/i.test(error?.message || '');
      setState({ loading: false, receipt: null, error: notFound ? null : error });
    }
  }, [token, id]);

  const needsLogin = Boolean(id) && !authLoading && !user;

  useEffect(() => {
    if (id && (authLoading || !user)) return;
    load();
  }, [load, id, authLoading, user]);

  const r = state.receipt;
  const pdf = r ? receiptPdfUrl(r.public_token) : null;

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-16 pt-24" dir={tx('rtl', 'ltr')}>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-emerald-800">{tx('إيصال الدفع', 'Payment receipt')}</h1>
          {r && (
            <div className="flex flex-wrap gap-2">
              {pdf && (
                <a
                  href={pdf}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                >
                  {tx('تنزيل PDF', 'Download PDF')}
                </a>
              )}
              <button
                type="button"
                onClick={() => printReceipt(r)}
                className="rounded-xl border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                {tx('طباعة', 'Print')}
              </button>
            </div>
          )}
        </div>

        {needsLogin ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-slate-700">{tx('سجّل الدخول لعرض هذا الإيصال.', 'Sign in to view this receipt.')}</p>
            <Link to="/login" className="mt-3 inline-block rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white">
              {tx('دخول', 'Sign In')}
            </Link>
          </div>
        ) : state.loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-emerald-600" />
          </div>
        ) : state.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {state.error.message || String(state.error)}
            <button type="button" onClick={load} className="ms-3 font-semibold underline">
              {tx('إعادة المحاولة', 'Retry')}
            </button>
          </div>
        ) : !r ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <h2 className="text-xl font-bold text-amber-900">{tx('الإيصال غير موجود', 'Receipt not found')}</h2>
            <p className="mt-1 text-sm text-amber-800">
              {tx(
                'الرابط غير صالح أو لا تملك صلاحية عرض هذا الإيصال. تواصل مع مكتب الحسابات.',
                'The link is invalid or you do not have access to this receipt. Please contact the accounts office.',
              )}
            </p>
          </div>
        ) : (
          <ReceiptSlip receipt={r} />
        )}
      </div>
    </div>
  );
}
