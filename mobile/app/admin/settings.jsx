import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import SettingsView from '../../components/views/SettingsView';

export default function AdminSettings() {
  const { t } = useI18n();
  const { caps } = useAuth();
  return (
    <SettingsView
      links={[
        ...(caps.isFinanceViewer ? [{ href: '/finance', icon: 'wallet-outline', label: t('fin.title') }] : []),
        ...(caps.isFinanceStaff ? [{ href: '/receive-payment', icon: 'cash-outline', label: t('counter.title') }] : []),
        ...(caps.canViewAnalytics ? [{ href: '/analytics', icon: 'bar-chart-outline', label: t('analytics.title') }] : []),
        { href: '/responsibilities', icon: 'flag-outline', label: t('resp.title') },
        { href: '/tasks', icon: 'checkbox-outline', label: t('task.boardTitle') },
        { href: '/mashoora', icon: 'people-outline', label: t('mashoora.title') },
        { href: '/dictionary', icon: 'language-outline', label: t('dict.title') },
        { href: '/announcements', icon: 'megaphone-outline', label: t('home.announcements') },
        { href: '/messages', icon: 'chatbubbles-outline', label: t('chat.title') },
      ]}
    />
  );
}
