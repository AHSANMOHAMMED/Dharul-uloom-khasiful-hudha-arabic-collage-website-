import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import SettingsView from '../../components/views/SettingsView';

export default function AdminSettings() {
  const { t } = useI18n();
  const { caps } = useAuth();
  return (
    <SettingsView
      links={[
        ...(caps.isFinanceStaff ? [{ href: '/receive-payment', icon: 'cash-outline', label: t('counter.title') }] : []),
        { href: '/tasks', icon: 'checkbox-outline', label: t('task.boardTitle') },
        { href: '/mashoora', icon: 'people-outline', label: t('mashoora.title') },
        { href: '/dictionary', icon: 'language-outline', label: t('dict.title') },
        { href: '/announcements', icon: 'megaphone-outline', label: t('home.announcements') },
      ]}
    />
  );
}
