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

export default function StaffHrmPanel() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const ar = i18n.language === 'ar';
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
      toast.success(ar ? 'تم حفظ سجل الموظفين' : 'Staff HR record saved');
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
      toast.success(ar ? 'تم رفع المستند' : 'Document uploaded');
      await reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-white">{ar ? 'إدارة الموارد البشرية' : 'Staff HRM'}</h2>

      <form onSubmit={onSave} className="grid md:grid-cols-2 gap-3 rounded-2xl border border-gray-800 bg-gray-900/50 p-4">
        <select
          required
          className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-200"
          value={form.profile_id}
          onChange={(e) => setForm({ ...form, profile_id: e.target.value })}
        >
          <option value="">{ar ? 'اختر موظفاً' : 'Select staff'}</option>
          {tutors.map((t) => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
        <input className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-200" placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
        <input className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-200" placeholder="Job title" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
        <input type="date" className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-200" value={form.employment_start} onChange={(e) => setForm({ ...form, employment_start: e.target.value })} />
        <input className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-200" placeholder="Emergency contact" value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} />
        <input className="bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-200" placeholder="Emergency phone" value={form.emergency_phone} onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })} />
        <textarea className="md:col-span-2 bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-200" rows={2} placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button type="submit" className="md:col-span-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm">
          {ar ? 'حفظ' : 'Save HR record'}
        </button>
      </form>

      <div className="rounded-2xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-900 text-gray-400">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Department</th>
              <th className="p-3">Title</th>
              <th className="p-3">Start</th>
              <th className="p-3">Emergency</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-t border-gray-800 text-gray-200">
                <td className="p-3">{r.profiles?.full_name}</td>
                <td className="p-3">{r.department || '—'}</td>
                <td className="p-3">{r.job_title || '—'}</td>
                <td className="p-3">{r.employment_start || '—'}</td>
                <td className="p-3">
                  <div>{r.emergency_contact || '—'} {r.emergency_phone ? `· ${r.emergency_phone}` : ''}</div>
                  <label className="inline-block mt-2 text-xs text-emerald-400 cursor-pointer">
                    Upload doc
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => uploadStaffDoc(r.profile_id, e.target.files?.[0])}
                    />
                  </label>
                  {(r.documents || []).length > 0 && (
                    <div className="text-[10px] text-gray-500 mt-1">{r.documents.length} file(s)</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-white">{ar ? 'قسائم الرواتب' : 'Payroll slips'}</h3>
          <input
            type="month"
            className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-1 text-sm text-gray-200"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          {salaries.map((s) => (
            <div key={s.id} className="flex justify-between items-center p-3 rounded-xl border border-gray-800 bg-gray-900/40">
              <div className="text-sm text-gray-200">
                <div className="font-semibold">{s.profiles?.full_name}</div>
                <div className="text-xs text-gray-500">LKR {s.amount} · {s.status}</div>
              </div>
              <button
                type="button"
                className="text-xs px-3 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-300"
                onClick={() => printSalarySlip(s.profiles, s, user?.username || 'Admin')}
              >
                Print slip
              </button>
            </div>
          ))}
          {salaries.length === 0 && (
            <p className="text-sm text-gray-500">No salary rows for this month.</p>
          )}
        </div>
      </div>
    </div>
  );
}
