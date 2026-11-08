import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  listMaterialsForClass,
  listAssignmentsForClass,
  submitAssignment,
  getStudentSubmissions,
  listClassSchedules,
} from '../lib/lmsApi';
import { tx } from '../lib/tx';

const StudentLmsPanel = () => {
  const { user } = useAuth();
  useTranslation(); // re-render on language change
  const classNumber = user?.classNumber;

  const [materials, setMaterials] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [submitting, setSubmitting] = useState({});

  useEffect(() => {
    if (!classNumber) return;
    listMaterialsForClass(classNumber).then(setMaterials);
    listAssignmentsForClass(classNumber).then(setAssignments);
    listClassSchedules(classNumber).then(setSchedules);
    if (user?.id) getStudentSubmissions(user.id).then(setSubmissions);
  }, [classNumber, user?.id]);

  const handleSubmit = async (assignmentId) => {
    const content = drafts[assignmentId];
    if (!content?.trim()) return;
    setSubmitting(prev => ({ ...prev, [assignmentId]: true }));
    try {
      await submitAssignment(assignmentId, user.id, content.trim());
      setDrafts((d) => ({ ...d, [assignmentId]: '' }));
      setSubmissions(await getStudentSubmissions(user.id));
    } finally {
      setSubmitting(prev => ({ ...prev, [assignmentId]: false }));
    }
  };

  if (!classNumber) {
    return (
      <div className="p-6 bg-[#FBF8F0] border border-[#E8E1D0] rounded-2xl text-center text-sm text-[#4A5E56]">
        {tx('لم يُحدد فصلك الدراسي بعد في الحساب.', 'Your class is not assigned yet.')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-[#E8E1D0]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#E3F1EA] text-[#11694A] flex items-center justify-center">
            <svg className="w-4 h-4 stroke-[1.75]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-xl font-serif font-bold text-[#0B3B2E]">
            {tx('المواد الدراسية والواجبات', 'Learning & Assignments')}
          </h2>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-[#E3F1EA] text-[#11694A] font-bold border border-[#11694A]/20">
          {tx('الصف', 'Class')} {classNumber}
        </span>
      </div>

      {/* Class Schedule Ribbon */}
      {schedules.length > 0 && (
        <div className="bg-[#FBF8F0] p-4 rounded-xl border border-[#E8E1D0]">
          <h3 className="font-bold text-xs uppercase tracking-wider text-[#11694A] mb-2">
            {tx('جدول الحصص الأسبوعي', 'Weekly Class Schedule')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {schedules.map((s) => (
              <div key={s.id} className="p-2 bg-white rounded-lg border border-[#E8E1D0]">
                <div className="font-bold text-[#0B3B2E]">{s.subject}</div>
                <div className="text-[11px] text-[#4A5E56] font-mono tabular-nums">
                  {s.day_of_week} · {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Materials */}
      <div>
        <h3 className="text-xs font-bold text-[#4A5E56] uppercase tracking-wider mb-2.5">
          {tx('المذكرات والمراجع التعليمية', 'Course Notes & References')}
        </h3>
        {materials.length === 0 ? (
          <p className="text-xs text-[#4A5E56] p-4 bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl">
            {tx('لا توجد مذكرات منشورة حتى الآن.', 'No materials uploaded for this class yet.')}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {materials.map((m) => (
              <div key={m.id} className="p-3.5 bg-[#FBF8F0] rounded-xl border border-[#E8E1D0] flex justify-between items-center gap-2">
                <div>
                  <span className="font-bold text-sm text-[#0B3B2E] block">{m.title}</span>
                  <span className="text-[10px] text-[#4A5E56]">{m.subject}</span>
                </div>
                {m.link_url && (
                  <a
                    href={m.link_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#11694A] hover:underline px-2.5 py-1 rounded bg-white border border-[#E8E1D0] shrink-0"
                  >
                    {tx('فتح', 'Open')} ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assignments */}
      <div>
        <h3 className="text-xs font-bold text-[#4A5E56] uppercase tracking-wider mb-2.5">
          {tx('الواجبات والتسليمات', 'Assignments & Homework')}
        </h3>
        {assignments.length === 0 ? (
          <p className="text-xs text-[#4A5E56] p-4 bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl">
            {tx('لا توجد واجبات معلقة.', 'No active assignments.')}
          </p>
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => {
              const sub = submissions.find((s) => s.assignment_id === a.id);
              const isSubmitting = submitting[a.id];
              return (
                <div key={a.id} className="p-4 bg-[#FBF8F0] rounded-xl border border-[#E8E1D0] space-y-2.5">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-[#0B3B2E]">{a.title}</h4>
                      <span className="text-[10px] text-[#11694A] font-semibold">{a.subject}</span>
                      {a.description && <p className="text-xs text-[#4A5E56] mt-1">{a.description}</p>}
                    </div>
                    {a.due_date && (
                      <span className="text-[11px] font-mono text-[#4A5E56] bg-white px-2 py-0.5 rounded border border-[#E8E1D0] tabular-nums shrink-0">
                        {tx('موعد التسليم:', 'Due:')} {a.due_date}
                      </span>
                    )}
                  </div>

                  {sub ? (
                    <div className="p-3 bg-[#E3F1EA] rounded-lg border border-[#11694A]/20 flex justify-between items-center text-xs">
                      <span className="text-[#11694A] font-bold">
                        ✓ {tx('تم التسليم بنجاح', 'Submitted')}
                      </span>
                      {sub.grade && (
                        <span className="font-bold text-[#0B3B2E]">
                          {tx('الدرجة:', 'Grade:')} <span className="font-mono">{sub.grade}</span>
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <textarea
                        className="w-full bg-white border border-[#E8E1D0] rounded-xl p-2.5 text-xs text-[#14201B] focus:outline-none focus:ring-1 focus:ring-[#11694A]"
                        rows={2}
                        placeholder={tx('اكتب إجابتك أو ملاحظة التسليم هنا...', 'Write your submission answer or link here...')}
                        value={drafts[a.id] || ''}
                        onChange={(e) => setDrafts({ ...drafts, [a.id]: e.target.value })}
                      />
                      <button
                        type="button"
                        disabled={isSubmitting || !drafts[a.id]?.trim()}
                        onClick={() => handleSubmit(a.id)}
                        className="px-4 py-2 bg-[#11694A] hover:bg-[#0B3B2E] disabled:bg-[#A3B8B0] rounded-xl text-white text-xs font-bold transition shadow-sm"
                      >
                        {isSubmitting ? (tx('جاري التسليم...', 'Submitting...')) : (tx('تسليم الإجابة', 'Submit Assignment'))}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentLmsPanel;
