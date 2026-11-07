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
    return <div className="text-[#4A5E56] text-xs py-12 text-center">Loading CRM pipeline…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#E8E1D0]">
        <div>
          <h2 className="text-lg font-serif font-bold text-[#0B3B2E]">
            {ar ? 'مسار القبول والتسجيل (CRM)' : 'Admissions CRM Pipeline'}
          </h2>
          <p className="text-xs text-[#4A5E56]">
            {ar ? 'تتبع مراحل المتقدمين من الاستفسار حتى التسجيل النهائي' : 'Stage management from prospective inquiries to enrollment'}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-[#E8E1D0] bg-[#FBF8F0] text-[#0B3B2E] hover:bg-white transition"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {CRM_STAGES.map((stage) => {
          const items = rows.filter((r) => (r.pipelineStage || 'submitted') === stage);
          return (
            <div key={stage} className="rounded-2xl border border-[#E8E1D0] bg-[#FBF8F0] p-3.5 min-h-[190px] flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#E8E1D0]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0B3B2E]">
                    {ar ? STAGE_LABELS[stage].ar : STAGE_LABELS[stage].en}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#4A5E56] border border-[#E8E1D0]">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => setSelected(item)}
                      className="w-full text-left p-3 rounded-xl bg-white border border-[#E8E1D0] hover:border-[#11694A] transition shadow-xs"
                    >
                      <div className="font-bold text-[#0B3B2E] text-xs sm:text-sm">{item.studentName}</div>
                      <div className="text-[11px] text-[#4A5E56] mt-0.5">
                        <span className="font-semibold text-[#11694A]">{item.course}</span> · {item.parentName}
                      </div>
                      <div className="text-[10px] text-[#60736C] font-mono mt-0.5">{item.phone}</div>
                    </button>
                  ))}
                  {items.length === 0 && (
                    <p className="text-[11px] text-[#60736C] text-center py-6 italic">No applicants in this stage</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="rounded-2xl border border-[#E8E1D0] bg-[#FBF8F0] p-6 space-y-5">
          <div className="flex justify-between items-start gap-4 pb-3 border-b border-[#E8E1D0]">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#C29A3A]">Applicant Details</span>
              <h3 className="text-lg font-serif font-bold text-[#0B3B2E]">{selected.studentName}</h3>
              <p className="text-xs text-[#4A5E56] mt-0.5">
                Parent: {selected.parentName} · Phone: {selected.phone} · Course: <span className="font-semibold text-[#11694A]">{selected.course}</span>
              </p>
            </div>
            <button
              type="button"
              className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-[#E8E1D0] text-[#4A5E56] hover:text-[#0B3B2E]"
              onClick={() => setSelected(null)}
            >
              ✕ Close
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] text-[#4A5E56] font-bold uppercase tracking-wider block">Move Pipeline Stage</label>
            <div className="flex flex-wrap gap-2">
              {CRM_STAGES.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => onMove(selected._id, stage)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                    selected.pipelineStage === stage
                      ? 'bg-[#11694A] border-[#11694A] text-white shadow-xs'
                      : 'border-[#E8E1D0] bg-white text-[#4A5E56] hover:border-[#11694A] hover:text-[#0B3B2E]'
                  }`}
                >
                  {ar ? STAGE_LABELS[stage].ar : STAGE_LABELS[stage].en}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-3 bg-white p-4 rounded-xl border border-[#E8E1D0]">
              <label className="text-xs font-bold text-[#0B3B2E] uppercase tracking-wider block">Admissions Notes</label>
              <textarea
                className="w-full bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl p-2.5 text-xs text-[#14201B] focus:outline-none focus:ring-1 focus:ring-[#11694A] resize-none"
                rows={2}
                placeholder="Log interview feedback or document checklist notes..."
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
              />
              <button
                type="button"
                onClick={onAddNote}
                className="px-4 py-1.5 rounded-xl bg-[#11694A] hover:bg-[#0B3B2E] text-white text-xs font-bold transition"
              >
                Add Note
              </button>
              <ul className="space-y-2 max-h-40 overflow-y-auto pt-2 border-t border-[#E8E1D0]">
                {notes.map((n) => (
                  <li key={n.id} className="text-xs text-[#14201B] border-b border-[#E8E1D0] pb-2">
                    <p className="leading-relaxed">{n.body}</p>
                    <div className="text-[10px] text-[#4A5E56] mt-0.5">
                      {n.profiles?.full_name || 'Staff'} · {new Date(n.created_at).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3 bg-white p-4 rounded-xl border border-[#E8E1D0]">
              <label className="text-xs font-bold text-[#0B3B2E] uppercase tracking-wider block">Official Enrollment</label>
              <div>
                <label className="block text-[10px] text-[#4A5E56] uppercase mb-1">Assigned Student Index Number</label>
                <input
                  className="w-full bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl p-2.5 text-xs text-[#14201B] focus:outline-none focus:ring-1 focus:ring-[#11694A]"
                  placeholder="e.g. KASHIF-2026-101"
                  value={enrollIndex}
                  onChange={(e) => setEnrollIndex(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#4A5E56] uppercase mb-1">Class Placement</label>
                <select
                  className="w-full bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl p-2.5 text-xs text-[#14201B] focus:outline-none focus:ring-1 focus:ring-[#11694A]"
                  value={enrollClass}
                  onChange={(e) => setEnrollClass(e.target.value)}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((c) => (
                    <option key={c} value={c}>Class {c}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={onEnroll}
                className="w-full py-2 rounded-xl bg-[#C29A3A] hover:bg-[#A8822B] text-[#0B3B2E] text-xs font-bold transition shadow-xs"
              >
                Create Index & Issue Parent Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
