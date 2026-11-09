import { useState, Suspense, lazy } from 'react';
import DashboardSidebarLayout from '../DashboardSidebarLayout';
import RoleSwitcher from '../RoleSwitcher';
import PortalTabChrome from './PortalTabChrome';
import { ERP_QUICK_LINK } from '../../lib/portalChrome';
import { tx } from '../../lib/tx';

/**
 * Config-driven branded portal.
 * tabs: [{ id, label_en, label_ar, icon, badge?, embed?: lazy component, render?: fn, chrome?: { title_en, title_ar, onPrint, onExport } }]
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
}) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id);
  const tab = tabs.find((t) => t.id === active) || tabs[0];
  const Embed = tab?.embed;

  const navItems = tabs.map((t) => ({
    id: t.id,
    label_en: t.label_en,
    label_ar: t.label_ar,
    icon: t.icon,
    badge: t.badge,
    badgeTone: t.badgeTone,
  }));

  return (
    <DashboardSidebarLayout
      title_en={title_en}
      title_ar={title_ar}
      roleBadge={roleBadge}
      navItems={navItems}
      activeItem={active}
      onSelect={setActive}
      roleSwitcher={showRoleSwitcher ? <RoleSwitcher compact /> : null}
      quickLinks={quickLinks || [ERP_QUICK_LINK]}
    >
      <div className="space-y-6">
        {banner}
        <PortalTabChrome
          title_en={tab?.chrome?.title_en || tab?.label_en || title_en}
          title_ar={tab?.chrome?.title_ar || tab?.label_ar || title_ar}
          subtitle_en={tab?.chrome?.subtitle_en}
          subtitle_ar={tab?.chrome?.subtitle_ar}
          showBack={active !== (defaultTab || tabs[0]?.id)}
          onBack={() => setActive(defaultTab || tabs[0]?.id)}
          onPrint={tab?.chrome?.onPrint}
          onExport={tab?.chrome?.onExport}
        >
          <div className="rounded-[14px] border border-[#E8E1D0] bg-white p-3 sm:p-5 shadow-xs min-h-[12rem]">
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-16 text-[#4A5E56] text-xs gap-2">
                  <span className="w-5 h-5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
                  {tx('جاري التحميل…', 'Loading…')}
                </div>
              }
            >
              {tab?.render ? tab.render() : Embed ? <Embed {...(tab.embedProps || {})} /> : null}
            </Suspense>
          </div>
        </PortalTabChrome>
      </div>
    </DashboardSidebarLayout>
  );
}

export { lazy };
