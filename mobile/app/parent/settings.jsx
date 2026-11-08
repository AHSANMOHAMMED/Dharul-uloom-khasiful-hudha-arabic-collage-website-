import { useI18n } from '../../lib/i18n';
import SettingsView from '../../components/views/SettingsView';

export default function ParentSettings() {
  const { t } = useI18n();
  return (
    <SettingsView
      links={[
        { href: '/link-child', icon: 'link-outline', label: t('parent.link') },
        { href: '/announcements', icon: 'megaphone-outline', label: t('home.announcements') },
        { href: '/messages', icon: 'chatbubbles-outline', label: t('chat.title') },
      ]}
    />
  );
}
