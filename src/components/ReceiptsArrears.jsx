import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDate, formatMoney, query, rpc } from '../lib/erp/rpc';
import { receiptPdfUrl } from '../lib/receiptPrint';
import { tx } from '../lib/tx';

/** Compact "Receipts & arrears" card for the student / parent portals. */
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
    <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-white">🧾 {tx('الإيصالات والمتأخرات', 'Receipts & arrears')}</h3>
        <button type="button" onClick={load} className="text-xs text-gray-400 hover:text-white">
          {tx('تحديث', 'Refresh')}
        </button>
      </div>

      {state.loading && !state.arrears ? (
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-emerald-500" />
        </div>
      ) : state.error ? (
        <p className="text-sm text-red-300">{state.error.message || String(state.error)}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-3 bg-gray-950/30 rounded-lg">
              <div className={`text-lg font-bold font-mono ${total > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{formatMoney(total)}</div>
              <span className="text-[10px] text-gray-500">
                {tx('إجمالي المتأخرات', 'Total arrears')} · {months.length} {tx('أشهر', 'months')}
              </span>
            </div>
            <div className="p-3 bg-gray-950/30 rounded-lg">
              <div className={`text-lg font-bold font-mono ${overdue > 0 ? 'text-red-400' : 'text-gray-300'}`}>{formatMoney(overdue)}</div>
              <span className="text-[10px] text-gray-500">{tx('متأخر', 'Overdue')}</span>
            </div>
          </div>

          {state.receipts.length === 0 ? (
            <p className="text-center text-xs text-gray-500 py-2">{tx('لا توجد إيصالات بعد', 'No receipts yet')}</p>
          ) : (
            <ul className="space-y-2">
              {state.receipts.map((r) => {
                const pdf = receiptPdfUrl(r.public_token);
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-950/30 p-2.5 text-xs">
                    <div>
                      <div className="font-mono text-gray-200">{r.receipt_no}</div>
                      <div className="text-gray-500">
                        {formatDate(r.paid_at)}
                        {r.status === 'reversed' && <span className="ms-2 text-red-400 font-bold">{tx('معكوس', 'Reversed')}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-emerald-400">{formatMoney(r.amount, r.currency || 'LKR')}</span>
                      <Link to={`/receipt/${r.id}`} className="rounded-md border border-gray-700 px-2 py-1 text-gray-200 hover:bg-gray-800">
                        {tx('عرض', 'View')}
                      </Link>
                      {pdf && (
                        <a href={pdf} target="_blank" rel="noreferrer" className="rounded-md border border-emerald-600/50 px-2 py-1 text-emerald-300 hover:bg-emerald-500/10">
                          PDF
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
