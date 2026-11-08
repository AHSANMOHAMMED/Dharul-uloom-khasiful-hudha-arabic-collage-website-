import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  listStaffHr,
  listTutorProfiles,
  upsertStaffHr,
  listSalariesForMonth,
  printSalarySlip,
} from '../lib/hrmApi';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { tx } from '../lib/tx';

export default function StaffHrmPanel() {
  useTranslation(); // re-render on language change
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [form, setForm] = useState({
    profile_id: '',
    department: '',
    job_title: '',
    employment_start: '',
    emergency_contact: '',
    emergency_phone: '',
    notes: '',
  });

  const reload = async () => {
    setRecords(await listStaffHr());
    setTutors(await listTutorProfiles());
    setSalaries(await listSalariesForMonth(month));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const onSave = async (e) => {
    e.preventDefault();
    try {
      await upsertStaffHr({
        profile_id: form.profile_id,
        department: form.department || null,
        job_title: form.job_title || null,
        employment_start: form.employment_start || null,
        emergency_contact: form.emergency_contact || null,
        emergency_phone: form.emergency_phone || null,
        notes: form.notes || null,
      });
      toast.success(tx('تم حفظ سجل الموظف بنجاح', 'Staff HR record saved'));
      setForm({
        profile_id: '',
        department: '',
        job_title: '',
        employment_start: '',
        emergency_contact: '',
        emergency_phone: '',
        notes: '',
      });
      await reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const uploadStaffDoc = async (profileId, file) => {
    if (!profileId || !file) return;
    const path = `${profileId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('staff-docs').upload(path, file, { upsert: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    const existing = records.find((r) => r.profile_id === profileId);
    const docs = [...(existing?.documents || []), { path, name: file.name, uploaded_at: new Date().toISOString() }];
    try {
      await upsertStaffHr({
        profile_id: profileId,
        documents: docs,
        department: existing?.department || null,
        job_title: existing?.job_title || null,
      });
      toast.success(tx('تم رفع المستند بنجاح', 'Document uploaded successfully'));
      await reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-[#E8E1D0]">
        <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
          {tx('إدارة شؤون الموظفين والموارد البشرية (HRM)', 'Staff Human Resources Management')}
        </h2>
        <p className="text-xs text-[#4A5E56]">
          {tx('سجلات أعضاء هيئة التدريس، عقود العمل، مستندات الاعتماد، وقسائم الرواتب', 'Faculty roster, contracts, emergency records & monthly payroll slips')}
        </p>
      </div>

      <form onSubmit={onSave} className="grid md:grid-cols-2 gap-3.5 rounded-2xl border border-[#E8E1D0] bg-[#FBF8F0] p-5">
        <select
          required
          className="bg-white border border-[#E8E1D0] rounded-xl p-2.5 text-xs text-[#14201B] focus:outline-none"
          value={form.profile_id}
          onChange={(e) => setForm({ ...form, profile_id: e.target.value })}
        >
          <option value="">{tx('اختر عضواً من الهيئة التدريسية', 'Select Faculty Member')}</option>
          {tutors.map((t) => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
        <input className="bg-white border border-[#E8E1D0] rounded-xl p-2.5 text-xs text-[#14201B] focus:outline-none" placeholder={tx('القسم (مثل: الشريعة، القرآن، اللغة)', 'Department (e.g. Sharia, Quran, Language)')} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
        <input className="bg-white border border-[#E8E1D0] rounded-xl p-2.5 text-xs text-[#14201B] focus:outline-none" placeholder={tx('المسمى الوظيفي الرسمي', 'Official Job Title')} value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
        <input type="date" className="bg-white border border-[#E8E1D0] rounded-xl p-2.5 text-xs text-[#14201B] focus:outline-none" value={form.employment_start} onChange={(e) => setForm({ ...form, employment_start: e.target.value })} />
        <input className="bg-white border border-[#E8E1D0] rounded-xl p-2.5 text-xs text-[#14201B] focus:outline-none" placeholder={tx('اسم جهة الاتصال للطوارئ', 'Emergency Contact Name')} value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} />
        <input className="bg-white border border-[#E8E1D0] rounded-xl p-2.5 text-xs text-[#14201B] focus:outline-none" placeholder={tx('هاتف الطوارئ', 'Emergency Contact Phone')} value={form.emergency_phone} onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })} />
        <textarea className="md:col-span-2 bg-white border border-[#E8E1D0] rounded-xl p-2.5 text-xs text-[#14201B] focus:outline-none resize-none" rows={2} placeholder={tx('ملاحظات عن الموظف، المؤهلات العلمية أو الحلقة المتخصصة...', 'Staff notes, academic qualifications or specialized halaqah...')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button type="submit" className="md:col-span-2 py-2.5 rounded-xl bg-[#11694A] hover:bg-[#0B3B2E] text-white font-bold text-xs transition shadow-sm">
          {tx('حفظ وتحديث سجل الموظف', 'Save Staff HR Record')}
        </button>
      </form>

      {/* Staff Roster Table */}
      <div className="rounded-2xl border border-[#E8E1D0] overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-[#FBF8F0] text-[#0B3B2E] border-b border-[#E8E1D0] uppercase font-bold tracking-wider">
            <tr>
              <th className="p-3">{tx('الاسم', 'Name')}</th>
              <th className="p-3">{tx('القسم', 'Department')}</th>
              <th className="p-3">{tx('المسمى', 'Title')}</th>
              <th className="p-3">{tx('تاريخ البدء', 'Start Date')}</th>
              <th className="p-3">{tx('الطوارئ والمستندات', 'Emergency & Documents')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8E1D0]">
            {records.map((r) => (
              <tr key={r.id} className="text-[#14201B] hover:bg-[#FBF8F0] transition">
                <td className="p-3 font-bold text-[#0B3B2E]">{r.profiles?.full_name}</td>
                <td className="p-3 text-[#4A5E56]">{r.department || '—'}</td>
                <td className="p-3 text-[#11694A] font-semibold">{r.job_title || '—'}</td>
                <td className="p-3 text-[#4A5E56] font-mono tabular-nums">{r.employment_start || '—'}</td>
                <td className="p-3">
                  <div>{r.emergency_contact || '—'} {r.emergency_phone ? `· ${r.emergency_phone}` : ''}</div>
                  <label className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-[#11694A] hover:underline cursor-pointer">
                    + {tx('رفع مستند', 'Upload Document')}
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => uploadStaffDoc(r.profile_id, e.target.files?.[0])}
                    />
                  </label>
                  {(r.documents || []).length > 0 && (
                    <div className="text-[10px] text-[#4A5E56] mt-0.5">{tx('{n} مستند محفوظ', '{n} document(s) filed').replace('{n}', r.documents.length)}</div>
                  )}
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-[#4A5E56]">
                  {tx('لا توجد سجلات موارد بشرية بعد.', 'No HR records filed yet.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Payroll Slips section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[#0B3B2E] uppercase tracking-wider">
            {tx('قسائم الرواتب الشهرية', 'Monthly Payroll Slips')}
          </h3>
          <input
            type="month"
            className="bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl px-3 py-1 text-xs text-[#14201B] focus:outline-none"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          {salaries.map((s) => (
            <div key={s.id} className="flex justify-between items-center p-3 rounded-xl border border-[#E8E1D0] bg-[#FBF8F0]">
              <div className="text-xs text-[#14201B]">
                <div className="font-bold text-[#0B3B2E]">{s.profiles?.full_name}</div>
                <div className="text-[11px] text-[#4A5E56] font-mono tabular-nums">
                  {tx('روبية', 'LKR')} {Number(s.amount).toLocaleString()} · <span className="uppercase font-bold text-[#11694A]">{s.status}</span>
                </div>
              </div>
              <button
                type="button"
                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#E8E1D0] bg-white text-[#0B3B2E] hover:border-[#11694A] transition"
                onClick={() => printSalarySlip(s.profiles, s, user?.username || tx('المدير', 'Admin'))}
              >
                {tx('طباعة القسيمة', 'Print Slip')}
              </button>
            </div>
          ))}
          {salaries.length === 0 && (
            <p className="text-xs text-[#4A5E56] text-center py-6">{tx('لا توجد رواتب لهذا الشهر.', 'No salary records for this month.')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
