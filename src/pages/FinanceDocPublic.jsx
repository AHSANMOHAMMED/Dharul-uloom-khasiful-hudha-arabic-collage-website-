import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { fetchFinanceDocumentByToken } from '../lib/financeHubApi';

export default function FinanceDocPublic() {
  const { token } = useParams();
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
    <main className="min-h-screen bg-[#fbf8f0] text-[#14201B] print:bg-white">
      <Helmet><title>{title} — Kashiful Hudha</title></Helmet>
      <div className="mx-auto max-w-[210mm] px-4 py-8 print:py-0">
        <article className="min-h-[297mm] rounded-xl border border-[#E8E1D0] bg-white p-8 shadow-sm print:border-0 print:shadow-none print:rounded-none">
          <header className="border-b border-[#E8E1D0] pb-4 mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C29A3A]">D.U. Kashiful Hudha Arabic College</p>
            <h1 className="font-serif text-2xl font-semibold text-[#0B3B2E] mt-1 capitalize">{title}</h1>
            <p className="text-sm text-[#60736C] mt-1">
              Status: {doc.status}
              {doc.issued_at ? ` · Issued ${new Date(doc.issued_at).toLocaleDateString()}` : ''}
            </p>
          </header>
          <div className="grid sm:grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <p className="text-xs uppercase text-[#60736C]">Party</p>
              <p className="font-semibold">{doc.party_name || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-[#60736C]">Total</p>
              <p className="font-semibold">{Number(doc.total || 0).toFixed(2)} {doc.currency || 'LKR'}</p>
            </div>
          </div>
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b border-[#E8E1D0] text-left text-xs uppercase text-[#60736C]">
                <th className="py-2">Description</th>
                <th className="py-2">Type</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Amount</th>
                <th className="py-2 text-right">Total</th>
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
              Print / Save PDF
            </button>
          </div>
        </article>
      </div>
    </main>
  );
}
