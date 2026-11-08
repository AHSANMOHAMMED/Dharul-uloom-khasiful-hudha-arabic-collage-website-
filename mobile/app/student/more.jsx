import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import SettingsView from '../../components/views/SettingsView';

export default function StudentMore() {
  const { t } = useI18n();
  const { user, profile } = useAuth();
  const s = user?.id;
  return (
    <SettingsView
      links={[
        { href: `/attendance-history?student=${s}`, icon: 'calendar-outline', label: t('attendance.history') },
        { href: `/timetable?class=${profile?.class_number ?? ''}`, icon: 'time-outline', label: t('timetable.title') },
        { href: `/certificates?student=${s}`, icon: 'medal-outline', label: t('cert.title') },
        { href: `/hostel?student=${s}`, icon: 'bed-outline', label: t('hostel.title') },
        { href: `/leave-requests?student=${s}`, icon: 'airplane-outline', label: t('leave.title') },
        { href: '/dictionary', icon: 'language-outline', label: t('dict.title') },
        { href: '/announcements', icon: 'megaphone-outline', label: t('home.announcements') },
        { href: '/messages', icon: 'chatbubbles-outline', label: t('chat.title') },
        { href: '/notifications', icon: 'notifications-outline', label: t('notif.title') },
      ]}
    />
  );
}
