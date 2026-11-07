import RoleTabs from '../../components/RoleTabs';
import { useAuth } from '../../lib/auth';

export default function AdminLayout() {
  const { caps } = useAuth();
  return (
    <RoleTabs
      portal="/admin"
      tabs={[
        { name: 'index', title: 'tabs.dashboard', icon: 'stats-chart-outline' },
        { name: 'finance', title: 'tabs.finance', icon: 'cash-outline', hidden: !caps.isFinanceViewer },
        { name: 'alerts', title: 'tabs.alerts', icon: 'notifications-outline' },
        { name: 'settings', title: 'tabs.settings', icon: 'settings-outline' },
      ]}
    />
  );
}
