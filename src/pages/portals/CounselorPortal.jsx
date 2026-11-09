import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';
import { ERP_QUICK_LINK } from '../../lib/portalChrome';
import { tx } from '../../lib/tx';
import { useAuth } from '../../context/AuthContext';

const WelfarePanel = lazy(() => import('../../components/erp/campus/WelfarePanel'));
const StudentsPanel = lazy(() => import('../../components/erp/campus/StudentsPanel'));

export default function CounselorPortal() {
  const { user } = useAuth();
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
      quickLinks={[ERP_QUICK_LINK]}
      banner={
        <div className="rounded-[14px] bg-[#0B3B2E] text-white p-5 sm:p-6">
          <p className="text-[11px] uppercase tracking-wider text-[#C29A3A] font-semibold">{tx('الإرشاد', 'Counseling')}</p>
          <h1 className="font-serif text-2xl font-semibold mt-1">
            {tx(`مرحباً، ${user?.username || ''}`, `Welcome, ${user?.username || ''}`)}
          </h1>
          <p className="text-xs text-white/75 mt-1">
            {tx('حالات الرعاية وقراءة ملفات الطلاب.', 'Welfare cases and student read access.')}
          </p>
        </div>
      }
    />
  );
}
