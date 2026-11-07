import { useTranslation } from 'react-i18next';
import { tx } from '../lib/tx';
import { amountInWords, colomboDateTime, methodLabel, money, monthLabel, receiptPublicUrl } from '../lib/receiptPrint';

function Item({ label, children }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-semibold text-slate-900 break-words">{children || '—'}</div>
    </div>
  );
}

/** On-screen version of the official payment slip (light theme). */
export default function ReceiptSlip({ receipt }) {
  useTranslation(); // re-render on language change
  const r = receipt || {};
  const org = r.organization || {};
  const st = r.student || {};
  const cur = r.currency || 'LKR';
  const reversed = r.status === 'reversed';
  const parents = Array.isArray(st.parents) ? st.parents.filter(Boolean) : [];
  const allocations = Array.isArray(r.allocations) ? r.allocations : [];
  const openMonths = Array.isArray(r.open_months) ? r.open_months : [];

  return (
    <article className={`relative overflow-hidden rounded-2xl border bg-white shadow-sm ${reversed ? 'border-red-300' : 'border-emerald-200'}`}>
      {reversed && (
        <div className="bg-red-600 px-4 py-2 text-center text-sm font-bold text-white">
          {tx('هذا الإيصال ملغى (معكوس)', 'This receipt has been REVERSED and is no longer valid.')}
        </div>
      )}
      <header className="flex items-center gap-4 border-b border-emerald-100 bg-emerald-50 px-5 py-4">
        {org.logo_url && <img src={org.logo_url} alt="" className="h-12 w-12 object-contain" />}
        <div className="flex-1">
          <div className="text-lg font-extrabold text-emerald-900">{org.name_en || org.short_name}</div>
          {org.name_ar && (
            <div dir="rtl" lang="ar" className="font-arabic text-lg text-amber-700">
              {org.name_ar}
            </div>
          )}
          <div className="text-xs text-slate-600">
            {[org.address, org.phone, org.email].filter(Boolean).join(' · ')}
            {org.registration_no ? ` · ${tx('رقم التسجيل', 'Reg. No')}: ${org.registration_no}` : ''}
          </div>
        </div>
      </header>

      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-extrabold uppercase tracking-wider text-emerald-800">
            {tx('إيصال دفع رسمي', 'Official payment receipt')}
          </h2>
          <div className="font-mono text-sm text-slate-700">
            {tx('رقم', 'No.')} <strong>{r.receipt_no}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-xl border border-emerald-100 bg-slate-50 p-4 sm:grid-cols-2">
          <Item label={tx('التاريخ / الوقت', 'Date / time')}>{colomboDateTime(r.paid_at)}</Item>
          <Item label={tx('الطالب', 'Student')}>{st.full_name}</Item>
          <Item label={tx('رقم القيد', 'Index No.')}>{st.index_number}</Item>
          <Item label={tx('الصف', 'Class')}>{st.class_number}</Item>
          <Item label={tx('ولي الأمر', 'Parent / guardian')}>{parents.length ? parents.join(', ') : st.guardian_name}</Item>
          {r.payer_name && <Item label={tx('الدافع', 'Paid by')}>{r.payer_name}</Item>}
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-emerald-800 text-white">
              <tr>
                <th className="px-3 py-2 text-start">{tx('الشهر', 'Month')}</th>
                <th className="px-3 py-2 text-start">{tx('الفاتورة', 'Invoice')}</th>
                <th className="px-3 py-2 text-end">{tx('الإجمالي', 'Total')}</th>
                <th className="px-3 py-2 text-end">{tx('المدفوع الآن', 'Paid now')}</th>
                <th className="px-3 py-2 text-end">{tx('الرصيد', 'Balance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {allocations.map((a, i) => (
                <tr key={`${a.invoice_no}-${i}`}>
                  <td className="px-3 py-2">{a.month_label || monthLabel(a.month)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{a.invoice_no}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{money(a.invoice_total, cur)}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{money(a.paid_now, cur)}</td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {Number(a.balance_after) > 0 ? money(a.balance_after, cur) : tx('مدفوع', 'Paid')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-emerald-800 bg-emerald-50 font-extrabold text-emerald-900">
                <td className="px-3 py-2" colSpan={3}>
                  {tx('إجمالي المستلم', 'Total received')}
                </td>
                <td className="px-3 py-2 text-end tabular-nums" colSpan={2}>
                  {money(r.amount, cur)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-sm italic text-slate-600" dir="ltr">
          {amountInWords(r.amount, cur)}
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Item label={tx('طريقة الدفع', 'Method')}>{methodLabel(r.method)}</Item>
          <Item label={tx('المرجع', 'Reference')}>{r.reference}</Item>
          <Item label={tx('إجمالي المتأخرات بعد الدفع', 'Total arrears after this payment')}>
            <span className={Number(r.arrears_after) > 0 ? 'text-amber-700' : 'text-emerald-700'}>{money(r.arrears_after, cur)}</span>
          </Item>
          <Item label={tx('الأشهر المستحقة', 'Outstanding months')}>
            {openMonths.length ? openMonths.map((m) => `${monthLabel(m.month)} (${money(m.balance, cur)})`).join(', ') : tx('لا شيء', 'None')}
          </Item>
          {r.notes && <Item label={tx('ملاحظة', 'Note')}>{r.notes}</Item>}
          <Item label={tx('استلمه', 'Received by')}>{r.received_by}</Item>
        </div>

        {r.public_token && (
          <p className="break-all text-xs text-slate-500" dir="ltr">
            {tx('رابط التحقق', 'Verification link')}: {receiptPublicUrl(r.public_token)}
          </p>
        )}
      </div>
    </article>
  );
}
