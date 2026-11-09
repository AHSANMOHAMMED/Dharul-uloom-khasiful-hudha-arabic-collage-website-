import RoleTabs from '../../components/RoleTabs';
import { useAuth } from '../../lib/auth';
import { staffTabsFor } from '../../lib/rolePortals';

export default function StaffLayout() {
  const { profile } = useAuth();
  const { tabs } = staffTabsFor(profile);
  return <RoleTabs portal="/staff" tabs={tabs} />;
}
