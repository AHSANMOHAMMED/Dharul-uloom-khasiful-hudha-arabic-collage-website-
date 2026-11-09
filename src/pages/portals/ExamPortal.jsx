import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';

const Exams = lazy(() => import('../../components/erp/campus/Exams'));
const MarksEntry = lazy(() => import('../../components/erp/campus/MarksEntry'));
const ReportCards = lazy(() => import('../../components/erp/campus/ReportCards'));
const DocumentsPanel = lazy(() => import('../../components/erp/docs/DocumentsPanel'));

function ExamsWrap() {
  return <Exams canEdit />;
}

export default function ExamPortal() {
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
      bannerProps={{
        portal_en: 'Examinations',
        portal_ar: 'الامتحانات',
        hint_en: 'Schedule exams, enter marks, and publish report cards.',
        hint_ar: 'جدولة الامتحانات وإدخال الدرجات ونشر كشوف النتائج.',
        accent: 'gold',
      }}
    />
  );
}
