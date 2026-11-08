import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDate, formatMoney, query, rpc } from '../lib/erp/rpc';
import { receiptPdfUrl } from '../lib/receiptPrint';
import { tx } from '../lib/tx';

/** Modern Manuscript "Receipts & arrears" card for the student / parent portals. */
export default function ReceiptsArrears({ studentId }) {
  useTranslation();
  const [state, setState] = useState({ loading: true, arrears: null, receipts: [], error: null });

  const load = useCallback(async () => {
    if (!studentId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [arrears, receipts] = await Promise.all([
        rpc('student_arrears', { p_student: studentId }),
        query('fee_receipts', (q) =>
          q
            .select('id, receipt_no, amount, currency, method, paid_at, status, public_token')
            .eq('student_id', studentId)
            .order('paid_at', { ascending: false })
            .limit(5),
        ),
      ]);
      setState({ loading: false, arrears, receipts: receipts || [], error: null });
    } catch (error) {
      setState({ loading: false, arrears: null, receipts: [], error });
    }
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!studentId) return null;
  const total = Number(state.arrears?.total || 0);
  const overdue = Number(state.arrears?.overdue || 0);
  const months = state.arrears?.months || [];

  return (
    <div className="bg-paper-white rounded-[14px] p-6 border border-sand-border shadow-manuscript-sm space-y-4">
      <div className="flex items-center justify-between gap-2 border-b border-sand-border/60 pb-3">
        <h3 className="font-serif text-base font-bold text-ink-green-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-700 text-[20px]">{'receipt_long'}</span>
          <span>{tx('الإيصالات والمتأخرات', 'Receipts & Fee Arrears')}</span>
        </h3>
        <button
          type="button"
          onClick={load}
          className="text-xs text-ink-text-muted hover:text-emerald-700 transition-colors flex items-center gap-1 font-medium"
        >
          <span className="material-symbols-outlined text-[16px]">{'refresh'}</span>
          <span>{tx('تحديث', 'Refresh')}</span>
        </button>
      </div>

      {state.loading && !state.arrears ? (
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-700 border-t-transparent" />
        </div>
      ) : state.error ? (
        <p className="text-sm text-feedback-danger">{state.error.message || String(state.error)}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-3 bg-parchment-50 rounded-[10px] border border-sand-border">
              <div className={`text-lg font-bold font-mono ${total > 0 ? 'text-feedback-warning' : 'text-emerald-700'}`}>
                {formatMoney(total)}
              </div>
              <span className="text-[11px] text-ink-text-muted font-medium">
                {tx('إجمالي المتأخرات', 'Total arrears')} · {months.length} {tx('أشهر', 'months')}
              </span>
            </div>
            <div className="p-3 bg-parchment-50 rounded-[10px] border border-sand-border">
              <div className={`text-lg font-bold font-mono ${overdue > 0 ? 'text-feedback-danger' : 'text-ink-text-secondary'}`}>
                {formatMoney(overdue)}
              </div>
              <span className="text-[11px] text-ink-text-muted font-medium">{tx('متأخر', 'Overdue')}</span>
            </div>
          </div>

          {state.receipts.length === 0 ? (
            <p className="text-center text-xs text-ink-text-muted py-3">
              {tx('لا توجد إيصالات مسجلة بعد', 'No fee receipts issued yet')}
            </p>
          ) : (
            <ul className="space-y-2">
              {state.receipts.map((r) => {
                const pdf = receiptPdfUrl(r.public_token);
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-parchment-50 border border-sand-border/80 p-3 text-xs"
                  >
                    <div>
                      <div className="font-mono font-semibold text-ink-green-900">{r.receipt_no}</div>
                      <div className="text-ink-text-muted text-[11px]">
                        {formatDate(r.paid_at)}
                        {r.status === 'reversed' && (
                          <span className="ms-2 text-feedback-danger font-bold uppercase">{tx('معكوس', 'Reversed')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-700 tabular-nums">
                        {formatMoney(r.amount, r.currency || 'LKR')}
                      </span>
                      <Link
                        to={`/receipt/${r.id}`}
                        className="rounded-[6px] border border-sand-border bg-paper-white px-2.5 py-1 text-ink-text-primary hover:border-emerald-700 hover:text-emerald-700 transition-colors font-medium text-[11px]"
                      >
                        {tx('عرض', 'View')}
                      </Link>
                      {pdf && (
                        <a
                          href={pdf}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-[6px] border border-emerald-700/30 bg-mint-wash-100 px-2.5 py-1 text-emerald-700 hover:bg-emerald-700 hover:text-white transition-colors font-medium text-[11px]"
                        >
                          {'PDF'}
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
