import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';
import { ROLE_BADGE } from '../../lib/roleTheme';

const CrmPanel = lazy(() => import('../../components/erp/campus/CrmPanel'));
const StudentEnrolment = lazy(() => import('../../components/erp/campus/StudentEnrolment'));
const CrmInvitations = lazy(() => import('../../components/erp/campus/CrmInvitations'));

function EnrolmentWrap() {
  return <StudentEnrolment canEnroll canPromote />;
}

export default function AdmissionsPortal() {
  const tabs = [
    { id: 'pipeline', label_en: 'Pipeline', label_ar: 'خط القبول', icon: 'filter_alt', embed: CrmPanel },
    { id: 'enrolment', label_en: 'Enrolment', label_ar: 'التسجيل', icon: 'how_to_reg', embed: EnrolmentWrap },
    { id: 'invitations', label_en: 'Invitations', label_ar: 'الدعوات', icon: 'mail', embed: CrmInvitations },
  ];

  return (
    <RolePortalShell
      title_en="Admissions Portal"
      title_ar="بوابة القبول"
      roleBadge={{
        text_en: 'Admissions',
        text_ar: 'القبول',
        color: ROLE_BADGE.brass,
      }}
      tabs={tabs}
      defaultTab="pipeline"
      bannerProps={{
        portal_en: 'Admissions',
        portal_ar: 'القبول',
        hint_en: 'CRM pipeline, enrolment, and parent invitations.',
        hint_ar: 'خط القبول والتسجيل ودعوات أولياء الأمور.',
        accent: 'gold',
      }}
    />
  );
}
