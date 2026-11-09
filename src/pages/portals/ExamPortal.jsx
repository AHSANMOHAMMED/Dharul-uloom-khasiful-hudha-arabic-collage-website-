import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';
import { ERP_QUICK_LINK } from '../../lib/portalChrome';
import { tx } from '../../lib/tx';
import { useAuth } from '../../context/AuthContext';

const Exams = lazy(() => import('../../components/erp/campus/Exams'));
const MarksEntry = lazy(() => import('../../components/erp/campus/MarksEntry'));
const ReportCards = lazy(() => import('../../components/erp/campus/ReportCards'));
const DocumentsPanel = lazy(() => import('../../components/erp/docs/DocumentsPanel'));

function ExamsWrap() {
  return <Exams canEdit />;
}

export default function ExamPortal() {
  const { user } = useAuth();
  const tabs = [
    { id: 'exams', label_en: 'Exams', label_ar: 'الامتحانات', icon: 'quiz', embed: ExamsWrap },
    { id: 'marks', label_en: 'Marks', label_ar: 'الدرجات', icon: 'grade', embed: MarksEntry },
    { id: 'reportcards', label_en: 'Report cards', label_ar: 'كشوف الدرجات', icon: 'description', embed: ReportCards },
    { id: 'documents', label_en: 'Exam papers', label_ar: 'أوراق الامتحان', icon: 'folder', embed: DocumentsPanel },
  ];

  return (
    <RolePortalShell
      title_en="Exam Portal"
      title_ar="بوابة الامتحانات"
      roleBadge={{
        text_en: 'Exam Officer',
        text_ar: 'مسؤول الامتحانات',
        color: 'bg-[#FEF9EE] text-[#C29A3A] border-[#C29A3A]/30',
      }}
      tabs={tabs}
      defaultTab="exams"
      quickLinks={[ERP_QUICK_LINK]}
      banner={
        <div className="rounded-[14px] bg-[#0B3B2E] text-white p-5 sm:p-6">
          <p className="text-[11px] uppercase tracking-wider text-[#C29A3A] font-semibold">{tx('الامتحانات', 'Examinations')}</p>
          <h1 className="font-serif text-2xl font-semibold mt-1">
            {tx(`مرحباً، ${user?.username || ''}`, `Welcome, ${user?.username || ''}`)}
          </h1>
          <p className="text-xs text-white/75 mt-1">
            {tx('الامتحانات، إدخال الدرجات، وكشوف النتائج.', 'Exams, marks entry, and report cards.')}
          </p>
        </div>
      }
    />
  );
}
