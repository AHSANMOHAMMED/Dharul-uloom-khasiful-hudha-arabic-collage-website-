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

const inputCls = 'w-full bg-gray-950 border border-gray-800 text-sm text-gray-200 p-2 rounded';

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
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-white">{ar ? 'نظام التعلم — الفصل' : 'LMS — Class'} {classNumber}</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={addMaterial} className="bg-gray-900/50 p-5 rounded-xl border border-gray-800 space-y-3">
          <h3 className="font-bold text-emerald-400">{ar ? 'مادة تعليمية' : 'Learning material'}</h3>
          <input className={inputCls} placeholder="Subject" value={matForm.subject} onChange={(e) => setMatForm({ ...matForm, subject: e.target.value })} required />
          <input className={inputCls} placeholder="Title" value={matForm.title} onChange={(e) => setMatForm({ ...matForm, title: e.target.value })} required />
          <input className={inputCls} placeholder="Link URL" value={matForm.link_url} onChange={(e) => setMatForm({ ...matForm, link_url: e.target.value })} />
          <button type="submit" className="py-2 px-4 bg-emerald-700 rounded text-white text-sm font-bold">{ar ? 'نشر' : 'Publish'}</button>
        </form>

        <form onSubmit={addAssignment} className="bg-gray-900/50 p-5 rounded-xl border border-gray-800 space-y-3">
          <h3 className="font-bold text-amber-400">{ar ? 'واجب' : 'Assignment'}</h3>
          <input className={inputCls} placeholder="Subject" value={asgForm.subject} onChange={(e) => setAsgForm({ ...asgForm, subject: e.target.value })} required />
          <input className={inputCls} placeholder="Title" value={asgForm.title} onChange={(e) => setAsgForm({ ...asgForm, title: e.target.value })} required />
          <input type="date" className={inputCls} value={asgForm.due_date} onChange={(e) => setAsgForm({ ...asgForm, due_date: e.target.value })} />
          <textarea className={inputCls} rows={2} placeholder="Description" value={asgForm.description} onChange={(e) => setAsgForm({ ...asgForm, description: e.target.value })} />
          <button type="submit" className="py-2 px-4 bg-amber-600 rounded text-white text-sm font-bold">{ar ? 'إنشاء' : 'Create'}</button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-bold text-gray-400 mb-2">{ar ? 'المواد' : 'Materials'}</h4>
          <ul className="space-y-2 text-sm">
            {materials.map((m) => (
              <li key={m.id} className="p-3 bg-gray-900/40 rounded border border-gray-800">
                <div className="font-semibold text-white">{m.title}</div>
                {m.link_url && <a href={m.link_url} target="_blank" rel="noreferrer" className="text-emerald-400 text-xs">Open</a>}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-400 mb-2">{ar ? 'الواجبات' : 'Assignments'}</h4>
          <ul className="space-y-2 text-sm">
            {assignments.map((a) => (
              <li key={a.id} className="p-3 bg-gray-900/40 rounded border border-gray-800 flex justify-between gap-2">
                <div>
                  <div className="font-semibold text-white">{a.title}</div>
                  <div className="text-xs text-gray-500">{a.due_date || 'No due date'}</div>
                </div>
                <button type="button" onClick={() => openGrading(a.id)} className="text-xs text-emerald-400 shrink-0">Grade</button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {gradingId && (
        <div className="bg-gray-900/60 p-5 rounded-xl border border-gray-700 space-y-3">
          <h4 className="font-bold text-white">{ar ? 'تسليمات الطلاب' : 'Student submissions'}</h4>
          {submissions.length === 0 ? (
            <p className="text-gray-500 text-sm">{ar ? 'لا تسليمات بعد' : 'No submissions yet'}</p>
          ) : submissions.map((s) => (
            <div key={s.id} className="p-3 bg-gray-950 rounded border border-gray-800 text-sm space-y-2">
              <div className="font-semibold text-white">{s.profiles?.full_name}</div>
              <p className="text-gray-400">{s.content}</p>
              {s.grade && <p className="text-emerald-400">Grade: {s.grade}</p>}
              <div className="flex gap-2">
                <input className={inputCls} placeholder="Grade" value={gradeForm.grade} onChange={(e) => setGradeForm({ ...gradeForm, grade: e.target.value })} />
                <input className={inputCls} placeholder="Feedback" value={gradeForm.feedback} onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })} />
                <button type="button" onClick={() => submitGrade(s.id)} className="px-3 py-1 bg-emerald-700 rounded text-white text-xs">Save</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TutorLmsPanel;
