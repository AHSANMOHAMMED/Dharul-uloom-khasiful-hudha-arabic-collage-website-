import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';
import { ROLE_BADGE } from '../../lib/roleTheme';

const HostelPanel = lazy(() => import('../../components/erp/campus/HostelPanel'));
const WelfarePanel = lazy(() => import('../../components/erp/campus/WelfarePanel'));

function DisciplineEmbed() {
  return <WelfarePanel initialTab="discipline" />;
}

function WelfareEmbed() {
  return <WelfarePanel initialTab="welfare" />;
}

export default function WardenPortal() {
  const tabs = [
    { id: 'hostel', label_en: 'Hostel', label_ar: 'السكن', icon: 'apartment', embed: HostelPanel },
    { id: 'discipline', label_en: 'Discipline', label_ar: 'الانضباط', icon: 'gavel', embed: DisciplineEmbed },
    { id: 'welfare', label_en: 'Welfare', label_ar: 'الرعاية', icon: 'volunteer_activism', embed: WelfareEmbed },
  ];

  return (
    <RolePortalShell
      title_en="Warden Portal"
      title_ar="بوابة مشرف السكن"
      roleBadge={{
        text_en: 'Warden',
        text_ar: 'مشرف السكن',
        color: ROLE_BADGE.emerald,
      }}
      tabs={tabs}
      defaultTab="hostel"
      bannerProps={{
        portal_en: 'Hostel & boarding',
        portal_ar: 'السكن والإقامة',
        hint_en: 'Hostel allocations, discipline incidents, and welfare cases.',
        hint_ar: 'توزيع السكن وحوادث الانضباط وحالات الرعاية.',
        accent: 'emerald',
      }}
    />
  );
}
