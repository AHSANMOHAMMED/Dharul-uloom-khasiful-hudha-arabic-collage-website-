import { useMemo, useState, Suspense, Component } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardSidebarLayout from '../DashboardSidebarLayout';
import RoleSwitcher from '../RoleSwitcher';
import PortalTabChrome from './PortalTabChrome';
import OverviewBanner from './OverviewBanner';
import { ERP_QUICK_LINK } from '../../lib/portalChrome';
import { ErpEmbedProvider } from '../../context/ErpEmbedContext';
import { PortalNavProvider } from '../../context/PortalNavContext';
import { tx } from '../../lib/tx';

/** Map ErpDashboard tile modules → portal tab ids (when present). */
const ERP_MODULE_TO_TAB = {
  students: 'students',
  hr: 'staff',
  academics: 'academics',
  fees: 'fees',
  hostel: 'hostel',
  welfare: 'welfare',
  duties: 'duties',
  reports: 'reports',
  timetable: 'timetable',
  exams: 'exams',
  crm: 'pipeline',
  accounting: 'accounting',
  payroll: 'payroll',
};

class EmbedErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-feedback-danger/30 bg-feedback-danger/5 p-6 text-center space-y-2">
          <p className="text-sm font-semibold text-feedback-danger">
            {tx('تعذر تحميل هذه الوحدة', 'This module failed to load')}
          </p>
          <p className="text-xs text-ink-text-muted font-mono">{this.state.error.message}</p>
          <button
            type="button"
            className="text-xs font-semibold text-emerald-700 underline"
            onClick={() => this.setState({ error: null })}
          >
            {tx('إعادة المحاولة', 'Retry')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Config-driven branded portal.
 * tabs: [{ id, label_en, label_ar, icon, badge?, embed?, render?, embedProps?, chrome? }]
 */
export default function RolePortalShell({
  title_en,
  title_ar,
  roleBadge,
  tabs,
  defaultTab,
  showRoleSwitcher = true,
  quickLinks,
  banner,
  bannerProps,
}) {
  const navigate = useNavigate();
  const homeId = defaultTab || tabs[0]?.id;
  const [active, setActive] = useState(homeId);
  const tab = tabs.find((t) => t.id === active) || tabs[0];
  const Embed = tab?.embed;
  const isHome = active === homeId;
  const tabIds = useMemo(() => new Set(tabs.map((t) => t.id)), [tabs]);

  const portalNav = useMemo(
    () => ({
      goTab: (id) => {
        if (tabIds.has(id)) {
          setActive(id);
          return true;
        }
        return false;
      },
      goErpModule: (module) => {
        const mapped = ERP_MODULE_TO_TAB[module];
        if (mapped && tabIds.has(mapped)) {
          setActive(mapped);
          return true;
        }
        navigate(`/erp?module=${encodeURIComponent(module)}`);
        return true;
      },
    }),
    [tabIds, navigate],
  );

  const navItems = tabs.map((t) => ({
    id: t.id,
    label_en: t.label_en,
    label_ar: t.label_ar,
    icon: t.icon,
    badge: t.badge,
    badgeTone: t.badgeTone,
  }));

  const links = quickLinks || [
    ERP_QUICK_LINK,
    { to: '/messages', label_en: 'Messages', label_ar: 'الرسائل', icon: 'chat' },
  ];

  return (
    <DashboardSidebarLayout
      title_en={title_en}
      title_ar={title_ar}
      roleBadge={roleBadge}
      navItems={navItems}
      activeItem={active}
      onSelect={setActive}
      roleSwitcher={showRoleSwitcher ? <RoleSwitcher compact /> : null}
      quickLinks={links}
    >
      <PortalNavProvider value={portalNav}>
        <div className="space-y-5">
          {isHome && (banner || (bannerProps && <OverviewBanner {...bannerProps} erpLink />))}

          <PortalTabChrome
            title_en={tab?.chrome?.title_en || tab?.label_en || title_en}
            title_ar={tab?.chrome?.title_ar || tab?.label_ar || title_ar}
            subtitle_en={tab?.chrome?.subtitle_en}
            subtitle_ar={tab?.chrome?.subtitle_ar}
            showBack={!isHome}
            onBack={() => setActive(homeId)}
            onPrint={tab?.chrome?.onPrint}
            onExport={tab?.chrome?.onExport}
          >
            <ErpEmbedProvider embedded>
              <div className="min-h-[14rem]">
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center py-16 text-[#4A5E56] text-xs gap-2">
                      <span className="w-5 h-5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
                      {tx('جاري التحميل…', 'Loading…')}
                    </div>
                  }
                >
                  <EmbedErrorBoundary key={active}>
                    {tab?.render ? tab.render() : Embed ? <Embed {...(tab.embedProps || {})} /> : (
                      <div className="rounded-[14px] border border-dashed border-[#E8E1D0] p-10 text-center space-y-3">
                        <p className="text-sm text-[#4A5E56]">{tx('لا توجد وحدة لهذه التبويبة', 'No module for this tab')}</p>
                        <Link to="/erp" className="text-xs font-semibold text-emerald-700 underline">
                          {tx('فتح نظام ERP', 'Open Campus ERP')}
                        </Link>
                      </div>
                    )}
                  </EmbedErrorBoundary>
                </Suspense>
              </div>
            </ErpEmbedProvider>
          </PortalTabChrome>
        </div>
      </PortalNavProvider>
    </DashboardSidebarLayout>
  );
}
