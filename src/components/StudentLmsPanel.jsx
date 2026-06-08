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

const StudentLmsPanel = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const classNumber = user?.classNumber;

  const [materials, setMaterials] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [drafts, setDrafts] = useState({});

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
    await submitAssignment(assignmentId, user.id, content.trim());
    setDrafts((d) => ({ ...d, [assignmentId]: '' }));
    setSubmissions(await getStudentSubmissions(user.id));
  };

  if (!classNumber) {
    return <p className="text-gray-500 text-sm">{ar ? 'لم يُحدد فصلك بعد' : 'Your class is not assigned yet'}</p>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">{ar ? 'التعلم والواجبات' : 'Learning & Assignments'}</h2>

      {schedules.length > 0 && (
        <div className="bg-gray-900/40 p-4 rounded-xl border border-gray-800">
          <h3 className="font-bold text-emerald-400 mb-2">{ar ? 'جدول الحصص' : 'Class schedule'}</h3>
          <ul className="text-sm space-y-1">
            {schedules.map((s) => (
              <li key={s.id} className="text-gray-300">
                {s.day_of_week} · {s.subject} · {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="font-bold text-gray-400 mb-2">{ar ? 'مواد' : 'Materials'}</h3>
        <ul className="space-y-2 text-sm">
          {materials.map((m) => (
            <li key={m.id} className="p-3 bg-gray-900/40 rounded border border-gray-800">
              <span className="text-white font-semibold">{m.title}</span>
              {m.link_url && (
                <a href={m.link_url} target="_blank" rel="noreferrer" className="block text-emerald-400 text-xs mt-1">Open</a>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-bold text-gray-400 mb-2">{ar ? 'الواجبات' : 'Assignments'}</h3>
        {assignments.map((a) => {
          const sub = submissions.find((s) => s.assignment_id === a.id);
          return (
            <div key={a.id} className="p-4 mb-3 bg-gray-900/40 rounded border border-gray-800 space-y-2">
              <div className="font-semibold text-white">{a.title}</div>
              <div className="text-xs text-gray-500">{a.due_date ? `Due: ${a.due_date}` : ''}</div>
              {sub ? (
                <p className="text-sm text-emerald-400">{ar ? 'تم التسليم' : 'Submitted'} {sub.grade ? `· Grade: ${sub.grade}` : ''}</p>
              ) : (
                <>
                  <textarea
                    className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm text-gray-200"
                    rows={2}
                    placeholder={ar ? 'إجابتك...' : 'Your answer...'}
                    value={drafts[a.id] || ''}
                    onChange={(e) => setDrafts({ ...drafts, [a.id]: e.target.value })}
                  />
                  <button type="button" onClick={() => handleSubmit(a.id)} className="px-4 py-1 bg-emerald-700 rounded text-white text-xs font-bold">
                    {ar ? 'تسليم' : 'Submit'}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StudentLmsPanel;
