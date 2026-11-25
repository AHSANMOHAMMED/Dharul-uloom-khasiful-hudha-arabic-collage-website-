import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { fetchFinanceDocumentByToken } from '../lib/financeHubApi';
import { useAuth } from '../context/AuthContext';
import PageNavBar from '../components/PageNavBar';
import { portalHomeFor } from '../lib/useHistoryNav';
import { tx } from '../lib/tx';

export default function FinanceDocPublic() {
  const { token } = useParams();
  const auth = useAuth();
  const portalUrl = auth.isAuthenticated ? portalHomeFor(auth) : '/';
  const homeLabel = auth.isAuthenticated ? tx('بوابتي', 'My portal') : tx('الرئيسية', 'Home');
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const data = await fetchFinanceDocumentByToken(token);
        if (!live) return;
        if (!data) setError('Document not found or not issued.');
        else setDoc(data);
      } catch (e) {
        if (live) setError(e.message || 'Could not load document');
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbf8f0]">
        <div className="w-8 h-8 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbf8f0] p-6">
        <p className="text-sm text-red-800">{error || 'Not found'}</p>
      </div>
    );
  }

  const title = `${(doc.doc_type || 'document').replace('_', ' ')} ${doc.doc_number || ''}`.trim();

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#14201B] print:bg-white">
      <Helmet><title>{`${title} — ${tx('كاشف الهدى', 'Kashiful Hudha')}`}</title></Helmet>
      <div className="mx-auto max-w-[210mm] px-4 py-6 sm:py-8 print:py-0">
        <PageNavBar
          className="mb-4 print:hidden"
          home={{ to: portalUrl, label: homeLabel }}
          crumbs={[
            { label: homeLabel, to: portalUrl },
            { label: title },
          ]}
        />
        <article className="min-h-[297mm] rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none print:rounded-none">
          <header className="border-b border-[#E8E1D0] pb-4 mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C29A3A]">{doc.organization?.name_en || tx('دار العلوم كاشف الهدى العربية', 'D.U. Kashiful Hudha Arabic College')}</p>
            {(doc.organization?.address || doc.organization?.phone) && (
              <p className="text-xs text-[#60736C]">{[doc.organization.address, doc.organization.phone].filter(Boolean).join(' · ')}</p>
            )}
            <h1 className="font-serif text-2xl font-semibold text-[#0B3B2E] mt-1 capitalize">{title}</h1>
            <p className="text-sm text-[#60736C] mt-1">
              {tx('الحالة:', 'Status:')} {doc.status}
              {doc.issued_at ? ` · ${tx('صدر في', 'Issued')} ${new Date(doc.issued_at).toLocaleDateString()}` : ''}
              {doc.valid_until ? ` · ${tx('صالح حتى', 'Valid until')} ${doc.valid_until}` : ''}
            </p>
            {doc.status === 'void' && (
              <p className="mt-2 inline-block rounded border-2 border-red-700 px-3 py-1 text-sm font-bold uppercase tracking-widest text-red-700">{tx('ملغى', 'Void')}</p>
            )}
          </header>
          <div className="grid sm:grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <p className="text-xs uppercase text-[#60736C]">{tx('الطرف', 'Party')}</p>
              <p className="font-semibold">{doc.party_name || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-[#60736C]">{tx('الإجمالي', 'Total')}</p>
              <p className="font-semibold">{Number(doc.total || 0).toFixed(2)} {doc.currency || 'LKR'}</p>
            </div>
            {['bill', 'sale', 'fee_invoice'].includes(doc.doc_type) && (
              <>
                <div>
                  <p className="text-xs uppercase text-[#60736C]">{tx('المدفوع', 'Paid')}</p>
                  <p className="font-semibold">{Number(doc.paid_amount || 0).toFixed(2)} {doc.currency || 'LKR'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-[#60736C]">{tx('الرصيد المستحق', 'Balance due')}</p>
                  <p className="font-semibold">{Number(doc.balance ?? 0).toFixed(2)} {doc.currency || 'LKR'}</p>
                </div>
              </>
            )}
          </div>
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b border-[#E8E1D0] text-left text-xs uppercase text-[#60736C]">
                <th className="py-2">{tx('الوصف', 'Description')}</th>
                <th className="py-2">{tx('النوع', 'Type')}</th>
                <th className="py-2 text-right">{tx('الكمية', 'Qty')}</th>
                <th className="py-2 text-right">{tx('المبلغ', 'Amount')}</th>
                <th className="py-2 text-right">{tx('الإجمالي', 'Total')}</th>
              </tr>
            </thead>
            <tbody>
              {(doc.lines || []).map((l) => (
                <tr key={l.id} className="border-b border-[#E8E1D0]/70">
                  <td className="py-2">{l.description}</td>
                  <td className="py-2 text-xs">{l.line_type}</td>
                  <td className="py-2 text-right">{l.qty}</td>
                  <td className="py-2 text-right">{Number(l.unit_amount || 0).toFixed(2)}</td>
                  <td className="py-2 text-right font-semibold">{Number(l.line_total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {doc.notes && <p className="text-sm text-[#60736C] whitespace-pre-wrap mb-6">{doc.notes}</p>}
          <div className="flex gap-2 print:hidden">
            <button type="button" onClick={() => window.print()} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white">
              {tx('طباعة / حفظ PDF', 'Print / Save PDF')}
            </button>
          </div>
        </article>
      </div>
    </main>
  );
}
