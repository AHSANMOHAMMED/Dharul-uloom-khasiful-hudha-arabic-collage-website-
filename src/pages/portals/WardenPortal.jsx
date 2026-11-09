import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';

const HostelPanel = lazy(() => import('../../components/erp/campus/HostelPanel'));
const ActivitiesPanel = lazy(() => import('../../components/erp/ops/ActivitiesPanel'));
const WelfarePanel = lazy(() => import('../../components/erp/campus/WelfarePanel'));

export default function WardenPortal() {
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
      bannerProps={{
        portal_en: 'Hostel & boarding',
        portal_ar: 'السكن والإقامة',
        hint_en: 'Hostel allocations, discipline, and welfare visibility.',
        hint_ar: 'توزيع السكن والانضباط ومتابعة الرعاية.',
        accent: 'emerald',
      }}
    />
  );
}
