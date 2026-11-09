import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';
import { ERP_QUICK_LINK } from '../../lib/portalChrome';
import { tx } from '../../lib/tx';
import { useAuth } from '../../context/AuthContext';

const HostelPanel = lazy(() => import('../../components/erp/campus/HostelPanel'));
const ActivitiesPanel = lazy(() => import('../../components/erp/ops/ActivitiesPanel'));
const WelfarePanel = lazy(() => import('../../components/erp/campus/WelfarePanel'));

export default function WardenPortal() {
  const { user } = useAuth();
  const tabs = [
    { id: 'hostel', label_en: 'Hostel', label_ar: 'السكن', icon: 'apartment', embed: HostelPanel },
    { id: 'discipline', label_en: 'Discipline', label_ar: 'الانضباط', icon: 'gavel', embed: ActivitiesPanel },
    { id: 'welfare', label_en: 'Welfare', label_ar: 'الرعاية', icon: 'volunteer_activism', embed: WelfarePanel },
  ];

  return (
    <RolePortalShell
      title_en="Warden Portal"
      title_ar="بوابة مشرف السكن"
      roleBadge={{
        text_en: 'Warden',
        text_ar: 'مشرف السكن',
        color: 'bg-[#E3F1EA] text-[#0B3B2E] border-[#0B3B2E]/20',
      }}
      tabs={tabs}
      defaultTab="hostel"
      quickLinks={[ERP_QUICK_LINK]}
      banner={
        <div className="rounded-[14px] bg-[#0B3B2E] text-white p-5 sm:p-6">
          <p className="text-[11px] uppercase tracking-wider text-[#C29A3A] font-semibold">{tx('السكن', 'Hostel')}</p>
          <h1 className="font-serif text-2xl font-semibold mt-1">
            {tx(`مرحباً، ${user?.username || ''}`, `Welcome, ${user?.username || ''}`)}
          </h1>
          <p className="text-xs text-white/75 mt-1">
            {tx('السكن، الانضباط، وقراءة حالات الرعاية.', 'Hostel, discipline, and welfare case visibility.')}
          </p>
        </div>
      }
    />
  );
}
