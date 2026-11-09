import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';

const WelfarePanel = lazy(() => import('../../components/erp/campus/WelfarePanel'));
const StudentsPanel = lazy(() => import('../../components/erp/campus/StudentsPanel'));

export default function CounselorPortal() {
  const tabs = [
    { id: 'welfare', label_en: 'Welfare cases', label_ar: 'حالات الرعاية', icon: 'volunteer_activism', embed: WelfarePanel },
    { id: 'students', label_en: 'Students', label_ar: 'الطلاب', icon: 'groups', embed: StudentsPanel },
  ];

  return (
    <RolePortalShell
      title_en="Counselor Portal"
      title_ar="بوابة المرشد"
      roleBadge={{
        text_en: 'Counselor',
        text_ar: 'مرشد',
        color: 'bg-[#E3F1EA] text-[#11694A] border-[#11694A]/30',
      }}
      tabs={tabs}
      defaultTab="welfare"
      bannerProps={{
        portal_en: 'Counseling',
        portal_ar: 'الإرشاد',
        hint_en: 'Welfare cases and student profiles for counselling follow-up.',
        hint_ar: 'حالات الرعاية وملفات الطلاب للمتابعة الإرشادية.',
        accent: 'emerald',
      }}
    />
  );
}
