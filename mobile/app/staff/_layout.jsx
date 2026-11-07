import RoleTabs from '../../components/RoleTabs';
import { useAuth } from '../../lib/auth';

export default function StaffLayout() {
  const { caps } = useAuth();
  return (
    <RoleTabs
      portal="/staff"
      tabs={[
        { name: 'index', title: 'tabs.home', icon: 'home-outline' },
        { name: 'attendance', title: 'tabs.attendance', icon: 'checkbox-outline', hidden: !caps.canMarkAttendance },
        { name: 'leaves', title: 'tabs.leaves', icon: 'document-text-outline', hidden: !caps.canReviewStudentLeave },
        { name: 'hr', title: 'tabs.hr', icon: 'briefcase-outline' },
        { name: 'dashboard', title: 'tabs.dashboard', icon: 'stats-chart-outline', hidden: !caps.canViewDashboard },
        { name: 'more', title: 'tabs.more', icon: 'menu-outline' },
      ]}
    />
  );
}
