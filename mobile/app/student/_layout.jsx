import RoleTabs from '../../components/RoleTabs';

export default function StudentLayout() {
  return (
    <RoleTabs
      portal="/student"
      tabs={[
        { name: 'index', title: 'tabs.home', icon: 'home-outline' },
        { name: 'fees', title: 'tabs.fees', icon: 'wallet-outline' },
        { name: 'results', title: 'tabs.results', icon: 'ribbon-outline' },
        { name: 'learn', title: 'tabs.learn', icon: 'book-outline' },
        { name: 'more', title: 'tabs.more', icon: 'menu-outline' },
      ]}
    />
  );
}
