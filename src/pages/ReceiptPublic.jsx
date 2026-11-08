import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { rpc, query } from '../lib/erp/rpc';
import { useAuth } from '../context/AuthContext';
import { tx } from '../lib/tx';
import { printReceipt, receiptPdfUrl } from '../lib/receiptPrint';
import { printReceiptDotMatrix } from '../lib/receiptText';
import ReceiptSlip from '../components/ReceiptSlip';
import KhatamPattern from '../components/KhatamPattern';

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
    <div className="min-h-screen bg-parchment-50 px-4 pb-16 pt-24 relative overflow-hidden" dir={tx('rtl', 'ltr')}>
      <KhatamPattern className="opacity-[0.04]" strokeColor="#0B3B2E" id="receipt-public-khatam" />

      <div className="mx-auto max-w-3xl space-y-6 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 block mb-0.5">
              {tx('سند استلام رسمي', 'Official Financial Voucher')}
            </span>
            <h1 className="text-2xl font-serif font-bold text-ink-green-900">
              {tx('إيصال تحصيل الرسوم', 'Tuition & Waqf Fee Receipt')}
            </h1>
          </div>

          {r && (
            <div className="flex flex-wrap gap-2">
              {pdf && (
                <a
                  href={pdf}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[10px] bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">{'picture_as_pdf'}</span>
                  <span>{tx('تنزيل PDF', 'Download PDF')}</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => printReceipt(r)}
                className="rounded-[10px] border border-sand-border bg-paper-white px-4 py-2 text-xs font-semibold text-ink-text-primary hover:bg-parchment-50 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">{'print'}</span>
                <span>{tx('طباعة', 'Print')}</span>
              </button>
              <button
                type="button"
                onClick={() => printReceiptDotMatrix(r)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                {tx('طباعة نقطية (LQ-310)', 'Dot-matrix (LQ-310)')}
              </button>
            </div>
          )}
        </div>

        {needsLogin ? (
          <div className="rounded-[14px] border border-sand-border bg-paper-white p-8 text-center space-y-3 shadow-manuscript-sm">
            <span className="material-symbols-outlined text-3xl text-brass-gold-500">{'lock'}</span>
            <p className="text-ink-text-secondary text-sm">
              {tx('سجّل الدخول إلى بوابتك المؤسسية لعرض هذا الإيصال.', 'Sign in to view this receipt.')}
            </p>
            <Link
              to="/login"
              className="mt-2 inline-block rounded-[10px] bg-emerald-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              {tx('تسجيل الدخول', 'Sign In')}
            </Link>
          </div>
        ) : state.loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
          </div>
        ) : state.error ? (
          <div className="rounded-[14px] border border-feedback-danger/30 bg-feedback-danger/10 p-4 text-xs text-feedback-danger">
            {state.error.message || String(state.error)}
            <button type="button" onClick={load} className="ms-3 font-semibold underline">
              {tx('إعادة المحاولة', 'Retry')}
            </button>
          </div>
        ) : !r ? (
          <div className="rounded-[14px] border border-sand-border bg-paper-white p-8 text-center space-y-2 shadow-manuscript-sm">
            <span className="material-symbols-outlined text-3xl text-feedback-warning">{'search_off'}</span>
            <h2 className="text-xl font-serif font-bold text-ink-green-900">{tx('الإيصال غير موجود', 'Receipt Not Found')}</h2>
            <p className="text-xs text-ink-text-secondary max-w-md mx-auto">
              {tx(
                'الرابط غير صالح أو لا تملك صلاحية عرض هذا الإيصال. تواصل مع مكتب الحسابات.',
                'The link is invalid or you do not have access to this receipt. Please contact the accounts office.'
              )}
            </p>
          </div>
        ) : (
          <div className="rounded-[14px] border border-sand-border bg-paper-white p-6 shadow-manuscript-md">
            <ReceiptSlip receipt={r} />
          </div>
        )}
      </div>
    </div>
  );
}
