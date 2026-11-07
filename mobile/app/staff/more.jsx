import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import SettingsView from '../../components/views/SettingsView';

export default function StaffMore() {
  const { t } = useI18n();
  const { caps } = useAuth();
  return (
    <SettingsView
      links={[
        ...(caps.isFinanceStaff ? [{ href: '/receive-payment', icon: 'cash-outline', label: t('counter.title') }] : []),
        { href: '/tasks', icon: 'checkbox-outline', label: t('task.boardTitle') },
        { href: '/duties', icon: 'ribbon-outline', label: t('duty.title') },
        { href: '/mashoora', icon: 'people-outline', label: t('mashoora.title') },
        { href: '/timetable?tutor=me', icon: 'time-outline', label: t('staff.myTimetable') },
        { href: '/my-attendance', icon: 'calendar-outline', label: t('staff.myAttendance') },
        { href: '/staff-leave', icon: 'airplane-outline', label: t('staff.requestLeave') },
        { href: '/payslips', icon: 'cash-outline', label: t('staff.payslips') },
        { href: '/dictionary', icon: 'language-outline', label: t('dict.title') },
        { href: '/announcements', icon: 'megaphone-outline', label: t('home.announcements') },
        { href: '/notifications', icon: 'notifications-outline', label: t('notif.title') },
      ]}
    />
  );
}
