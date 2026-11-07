import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  listMaterialsForClass,
  listAssignmentsForClass,
  createMaterial,
  createAssignment,
  listSubmissionsForAssignment,
  gradeSubmission,
} from '../lib/lmsApi';

const inputCls = 'w-full bg-[#FBF8F0] border border-[#E8E1D0] text-sm text-[#14201B] p-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#11694A]';

const TutorLmsPanel = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const classNumber = user?.classNumber || 5;

  const [materials, setMaterials] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [matForm, setMatForm] = useState({ subject: '', title: '', description: '', link_url: '' });
  const [asgForm, setAsgForm] = useState({ subject: '', title: '', description: '', due_date: '' });
  const [gradingId, setGradingId] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [gradeForm, setGradeForm] = useState({ grade: '', feedback: '' });

  const load = async () => {
    setMaterials(await listMaterialsForClass(classNumber));
    setAssignments(await listAssignmentsForClass(classNumber));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classNumber]);

  const addMaterial = async (e) => {
    e.preventDefault();
    await createMaterial({ ...matForm, tutor_id: user.id, class_number: classNumber });
    setMatForm({ subject: '', title: '', description: '', link_url: '' });
    load();
  };

  const addAssignment = async (e) => {
    e.preventDefault();
    await createAssignment({ ...asgForm, tutor_id: user.id, class_number: classNumber, due_date: asgForm.due_date || null });
    setAsgForm({ subject: '', title: '', description: '', due_date: '' });
    load();
  };

  const openGrading = async (assignmentId) => {
    setGradingId(assignmentId);
    setSubmissions(await listSubmissionsForAssignment(assignmentId));
  };

  const submitGrade = async (submissionId) => {
    await gradeSubmission(submissionId, gradeForm.grade, gradeForm.feedback);
    setGradeForm({ grade: '', feedback: '' });
    if (gradingId) setSubmissions(await listSubmissionsForAssignment(gradingId));
  };

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
            {ar ? `نظام التعليم الإلكتروني — الصف ${classNumber}` : `LMS — Class ${classNumber}`}
          </h2>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-[#E0F2F1] text-[#0F7C86] font-bold border border-[#0F7C86]/20">
          Class {classNumber}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Material */}
        <form onSubmit={addMaterial} className="bg-[#FBF8F0] p-5 rounded-2xl border border-[#E8E1D0] space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#E3F1EA] text-[#11694A] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="font-sans font-bold text-[#0B3B2E] text-sm">
              {ar ? 'إضافة مادة تعليمية / مذكرة' : 'New Learning Material'}
            </h3>
          </div>
          <input className={inputCls} placeholder={ar ? 'المادة (مثل: الفقه، التفسير)' : 'Subject (e.g., Fiqh, Tafsir)'} value={matForm.subject} onChange={(e) => setMatForm({ ...matForm, subject: e.target.value })} required />
          <input className={inputCls} placeholder={ar ? 'عنوان المادة' : 'Title'} value={matForm.title} onChange={(e) => setMatForm({ ...matForm, title: e.target.value })} required />
          <input className={inputCls} placeholder={ar ? 'رابط الملف أو المرجع (Google Drive / URL)' : 'Reference URL or File Link'} value={matForm.link_url} onChange={(e) => setMatForm({ ...matForm, link_url: e.target.value })} />
          <button type="submit" className="py-2 px-5 bg-[#11694A] hover:bg-[#0B3B2E] rounded-xl text-white text-xs font-bold transition shadow-sm">
            {ar ? 'نشر المادة' : 'Publish Material'}
          </button>
        </form>

        {/* Add Assignment */}
        <form onSubmit={addAssignment} className="bg-[#FBF8F0] p-5 rounded-2xl border border-[#E8E1D0] space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#F7EDD2] text-[#C29A3A] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 stroke-[2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="font-sans font-bold text-[#0B3B2E] text-sm">
              {ar ? 'إنشاء واجب أو تمرين جديد' : 'New Assignment'}
            </h3>
          </div>
          <input className={inputCls} placeholder={ar ? 'المادة' : 'Subject'} value={asgForm.subject} onChange={(e) => setAsgForm({ ...asgForm, subject: e.target.value })} required />
          <input className={inputCls} placeholder={ar ? 'عنوان الواجب' : 'Title'} value={asgForm.title} onChange={(e) => setAsgForm({ ...asgForm, title: e.target.value })} required />
          <input type="date" className={inputCls} value={asgForm.due_date} onChange={(e) => setAsgForm({ ...asgForm, due_date: e.target.value })} />
          <textarea className={inputCls} rows={2} placeholder={ar ? 'تعليمات وإرشادات الواجب...' : 'Assignment instructions...'} value={asgForm.description} onChange={(e) => setAsgForm({ ...asgForm, description: e.target.value })} />
          <button type="submit" className="py-2 px-5 bg-[#C29A3A] hover:bg-[#A8822B] rounded-xl text-[#0B3B2E] text-xs font-bold transition shadow-sm">
            {ar ? 'إنشاء الواجب' : 'Create Assignment'}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Materials List */}
        <div>
          <h4 className="text-xs font-bold text-[#4A5E56] uppercase tracking-wider mb-2.5">
            {ar ? 'المواد المنشورة' : 'Active Course Materials'}
          </h4>
          {materials.length === 0 ? (
            <p className="text-xs text-[#4A5E56] p-4 bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl">
              {ar ? 'لا توجد مواد تعليمية مضافة لهذا الفصل.' : 'No materials uploaded yet.'}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {materials.map((m) => (
                <li key={m.id} className="p-3 bg-[#FBF8F0] rounded-xl border border-[#E8E1D0] flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-[#0B3B2E] text-xs sm:text-sm">{m.title}</div>
                    <span className="text-[10px] text-[#4A5E56]">{m.subject}</span>
                  </div>
                  {m.link_url && (
                    <a
                      href={m.link_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-[#11694A] hover:underline px-2.5 py-1 rounded bg-white border border-[#E8E1D0]"
                    >
                      {ar ? 'فتح' : 'Open'} ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Assignments List */}
        <div>
          <h4 className="text-xs font-bold text-[#4A5E56] uppercase tracking-wider mb-2.5">
            {ar ? 'الواجبات الحالية' : 'Active Assignments'}
          </h4>
          {assignments.length === 0 ? (
            <p className="text-xs text-[#4A5E56] p-4 bg-[#FBF8F0] border border-[#E8E1D0] rounded-xl">
              {ar ? 'لا توجد واجبات مضافة لهذا الفصل.' : 'No assignments created yet.'}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {assignments.map((a) => (
                <li key={a.id} className="p-3 bg-[#FBF8F0] rounded-xl border border-[#E8E1D0] flex justify-between items-center gap-2">
                  <div>
                    <div className="font-semibold text-[#0B3B2E] text-xs sm:text-sm">{a.title}</div>
                    <div className="text-[10px] text-[#4A5E56] font-mono tabular-nums">
                      {a.due_date ? `Due: ${a.due_date}` : 'No due date'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openGrading(a.id)}
                    className="text-xs font-bold text-[#11694A] hover:text-[#0B3B2E] px-3 py-1 rounded-lg bg-white border border-[#E8E1D0] transition shrink-0"
                  >
                    {ar ? 'تصحيح' : 'Grade Submissions'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Submissions & Grading Drawer */}
      {gradingId && (
        <div className="bg-[#FBF8F0] p-5 rounded-2xl border border-[#E8E1D0] space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-sm text-[#0B3B2E]">
              {ar ? 'تسليمات الطلاب للواجب' : 'Student Submissions'}
            </h4>
            <button
              type="button"
              onClick={() => setGradingId(null)}
              className="text-xs text-[#4A5E56] hover:text-[#0B3B2E]"
            >
              ✕ {ar ? 'إغلاق' : 'Close'}
            </button>
          </div>
          
          {submissions.length === 0 ? (
            <p className="text-[#4A5E56] text-xs py-2">{ar ? 'لا تسليمات بعد لهذا الواجب.' : 'No submissions received yet.'}</p>
          ) : submissions.map((s) => (
            <div key={s.id} className="p-3.5 bg-white rounded-xl border border-[#E8E1D0] text-xs space-y-2">
              <div className="font-bold text-[#0B3B2E] text-sm">{s.profiles?.full_name}</div>
              <p className="text-[#14201B] bg-[#FBF8F0] p-2.5 rounded-lg border border-[#E8E1D0] whitespace-pre-wrap">{s.content}</p>
              {s.grade && (
                <p className="text-[#11694A] font-bold">
                  {ar ? 'الدرجة المسجلة:' : 'Current Grade:'} <span className="font-mono">{s.grade}</span>
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <input className={inputCls} placeholder="Grade (e.g. A, 90)" value={gradeForm.grade} onChange={(e) => setGradeForm({ ...gradeForm, grade: e.target.value })} />
                <input className={inputCls} placeholder="Feedback note" value={gradeForm.feedback} onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })} />
                <button type="button" onClick={() => submitGrade(s.id)} className="px-4 py-2 bg-[#11694A] hover:bg-[#0B3B2E] rounded-xl text-white font-bold shrink-0">
                  {ar ? 'حفظ الدرجة' : 'Save Grade'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TutorLmsPanel;
