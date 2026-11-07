import RoleTabs from '../../components/RoleTabs';

export default function ParentLayout() {
  return (
    <RoleTabs
      portal="/parent"
      tabs={[
        { name: 'index', title: 'tabs.children', icon: 'people-outline' },
        { name: 'alerts', title: 'tabs.alerts', icon: 'notifications-outline' },
        { name: 'settings', title: 'tabs.settings', icon: 'settings-outline' },
      ]}
    />
  );
}
