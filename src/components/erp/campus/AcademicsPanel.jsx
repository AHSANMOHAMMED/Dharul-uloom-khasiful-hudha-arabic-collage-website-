import { useAuth } from '../../../context/AuthContext';
import { PageHeader, Tabs, useLang } from '../ui';
import AcademicYears from './AcademicYears';
import { ClassSubjectsTab, GradeScalesTab, SubjectsTab } from './AcademicSetup';
import Timetable from './Timetable';
import ClassAttendance from './ClassAttendance';
import Exams from './Exams';
import MarksEntry from './MarksEntry';
import ReportCards from './ReportCards';
import { useUrlState } from '../../../lib/useTabParam';

export default function AcademicsPanel() {
  const { t } = useLang();
  const auth = useAuth();
  const canEdit = auth.isAcademicAdmin;
  // In the URL (?acad=) so Back/Forward and links reach this tab.
  const [tab, setTab] = useUrlState('acad', auth.isTutor && !canEdit ? 'attendance' : 'years');
  const tabs = [
    { id: 'years', label: t('Years & terms', 'الأعوام والفصول') },
    { id: 'subjects', label: t('Subjects', 'المواد') },
    { id: 'class_subjects', label: t('Class subjects', 'مواد الصفوف') },
    { id: 'timetable', label: t('Timetable', 'الجدول') },
    { id: 'attendance', label: t('Attendance', 'الحضور') },
    { id: 'exams', label: t('Exams', 'الامتحانات') },
    { id: 'marks', label: t('Marks entry', 'إدخال الدرجات') },
    { id: 'reports', label: t('Report cards', 'بطاقات النتائج') },
    { id: 'grades', label: t('Grade scales', 'سلم التقديرات') },
  ];
  return (
    <div>
      <PageHeader title={t('Academics & exams', 'الشؤون الأكاديمية والامتحانات')} subtitle={t('Structure, timetable, attendance, exams and results.', 'الهيكل والجدول والحضور والامتحانات والنتائج.')} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'years' && <AcademicYears canEdit={canEdit} />}
      {tab === 'subjects' && <SubjectsTab canEdit={canEdit} />}
      {tab === 'class_subjects' && <ClassSubjectsTab canEdit={canEdit} />}
      {tab === 'timetable' && <Timetable />}
      {tab === 'attendance' && <ClassAttendance />}
      {tab === 'exams' && <Exams canEdit={canEdit} />}
      {tab === 'marks' && <MarksEntry />}
      {tab === 'reports' && <ReportCards />}
      {tab === 'grades' && <GradeScalesTab canEdit={canEdit} />}
    </div>
  );
}
