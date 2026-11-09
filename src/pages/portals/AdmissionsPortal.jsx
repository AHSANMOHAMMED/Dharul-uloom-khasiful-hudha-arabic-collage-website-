import { lazy } from 'react';
import RolePortalShell from '../../components/portals/RolePortalShell';
import { ERP_QUICK_LINK } from '../../lib/portalChrome';
import { tx } from '../../lib/tx';
import { useAuth } from '../../context/AuthContext';

const CrmPanel = lazy(() => import('../../components/erp/campus/CrmPanel'));
const StudentEnrolment = lazy(() => import('../../components/erp/campus/StudentEnrolment'));
const CrmInvitations = lazy(() => import('../../components/erp/campus/CrmInvitations'));

function EnrolmentWrap() {
  return <StudentEnrolment canEnroll canPromote />;
}

export default function AdmissionsPortal() {
  const { user } = useAuth();
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
        color: 'bg-[#FEF9EE] text-[#C29A3A] border-[#C29A3A]/30',
      }}
      tabs={tabs}
      defaultTab="pipeline"
      quickLinks={[ERP_QUICK_LINK]}
      banner={
        <div className="rounded-[14px] bg-[#0B3B2E] text-white p-5 sm:p-6">
          <p className="text-[11px] uppercase tracking-wider text-[#C29A3A] font-semibold">{tx('القبول', 'Admissions')}</p>
          <h1 className="font-serif text-2xl font-semibold mt-1">
            {tx(`مرحباً، ${user?.username || ''}`, `Welcome, ${user?.username || ''}`)}
          </h1>
          <p className="text-xs text-white/75 mt-1">
            {tx('خط القبول، التسجيل، ودعوات أولياء الأمور.', 'CRM pipeline, enrolment, and parent invitations.')}
          </p>
        </div>
      }
    />
  );
}
