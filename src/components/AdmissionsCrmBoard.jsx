import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CRM_STAGES,
  listCrmAdmissions,
  moveAdmissionStage,
  addAdmissionNote,
  enrollAdmission,
  listAdmissionNotes,
} from '../lib/crmApi';
import { toast } from 'react-toastify';

const STAGE_LABELS = {
  lead: { en: 'Lead', ar: 'عميل محتمل' },
  submitted: { en: 'Submitted', ar: 'مقدم' },
  interview: { en: 'Interview', ar: 'مقابلة' },
  accepted: { en: 'Accepted', ar: 'مقبول' },
  enrolled: { en: 'Enrolled', ar: 'مسجل' },
  rejected: { en: 'Rejected', ar: 'مرفوض' },
};

export default function AdmissionsCrmBoard() {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState([]);
  const [noteBody, setNoteBody] = useState('');
  const [enrollIndex, setEnrollIndex] = useState('');
  const [enrollClass, setEnrollClass] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setRows(await listCrmAdmissions());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selected) return;
    listAdmissionNotes(selected._id).then(setNotes);
  }, [selected]);

  const onMove = async (id, stage) => {
    try {
      await moveAdmissionStage(id, stage);
      toast.success(ar ? 'تم تحديث المرحلة' : 'Stage updated');
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onAddNote = async () => {
    if (!selected || !noteBody.trim()) return;
    try {
      await addAdmissionNote(selected._id, noteBody.trim());
      setNoteBody('');
      setNotes(await listAdmissionNotes(selected._id));
      toast.success(ar ? 'تمت إضافة الملاحظة' : 'Note added');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onEnroll = async () => {
    if (!selected || !enrollIndex.trim()) return;
    try {
      const result = await enrollAdmission(selected._id, enrollIndex.trim(), Number(enrollClass));
      const token = result?.parent_invite_token;
      toast.success(
        ar
          ? `تم التسجيل. رمز دعوة ولي الأمر: ${token || '—'}`
          : `Enrolled. Parent invite token: ${token || '—'}`
      );
      if (token && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(token);
        toast.info(ar ? 'تم نسخ رمز الدعوة' : 'Invite token copied');
      }
      setSelected(null);
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) {
    return <div className="text-gray-400 text-sm py-8 text-center">Loading CRM…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-bold text-white">
          {ar ? 'لوحة CRM للقبول' : 'Admissions CRM pipeline'}
        </h2>
        <button
          type="button"
          onClick={load}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {CRM_STAGES.map((stage) => {
          const items = rows.filter((r) => (r.pipelineStage || 'submitted') === stage);
          return (
            <div key={stage} className="rounded-2xl border border-gray-800 bg-gray-900/50 p-3 min-h-[180px]">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-bold text-emerald-300">
                  {ar ? STAGE_LABELS[stage].ar : STAGE_LABELS[stage].en}
                </span>
                <span className="text-xs text-gray-500">{items.length}</span>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {items.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => setSelected(item)}
                    className="w-full text-left p-3 rounded-xl bg-gray-950/60 border border-gray-800 hover:border-emerald-500/40"
                  >
                    <div className="font-semibold text-white text-sm">{item.studentName}</div>
                    <div className="text-xs text-gray-400 mt-1">{item.course} · {item.parentName}</div>
                    <div className="text-xs text-gray-500">{item.phone}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="rounded-2xl border border-emerald-500/30 bg-gray-900/80 p-5 space-y-4">
          <div className="flex justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-lg font-bold text-white">{selected.studentName}</h3>
              <p className="text-sm text-gray-400">
                {selected.parentName} · {selected.phone} · {selected.course}
              </p>
            </div>
            <button type="button" className="text-gray-400 text-sm" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {CRM_STAGES.map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => onMove(selected._id, stage)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                  selected.pipelineStage === stage
                    ? 'bg-emerald-600 border-emerald-400 text-white'
                    : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                }`}
              >
                {ar ? STAGE_LABELS[stage].ar : STAGE_LABELS[stage].en}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-gray-400 uppercase">Notes</label>
              <textarea
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-200"
                rows={3}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
              />
              <button
                type="button"
                onClick={onAddNote}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold"
              >
                Add note
              </button>
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {notes.map((n) => (
                  <li key={n.id} className="text-xs text-gray-300 border-b border-gray-800 pb-2">
                    {n.body}
                    <div className="text-gray-500 mt-1">
                      {n.profiles?.full_name || 'Staff'} · {new Date(n.created_at).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-400 uppercase">Enroll student</label>
              <input
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-200"
                placeholder="KASHIF-2026-101"
                value={enrollIndex}
                onChange={(e) => setEnrollIndex(e.target.value)}
              />
              <select
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-sm text-gray-200"
                value={enrollClass}
                onChange={(e) => setEnrollClass(e.target.value)}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((c) => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={onEnroll}
                className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold"
              >
                Create index + enroll
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
