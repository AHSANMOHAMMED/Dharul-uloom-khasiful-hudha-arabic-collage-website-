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
        ...(caps.isFinanceViewer ? [{ href: '/finance-hub', icon: 'git-network-outline', label: 'Finance Hub' }] : []),
        ...(caps.isFinanceStaff ? [{ href: '/receive-payment', icon: 'cash-outline', label: t('counter.title') }] : []),
        ...(caps.isFinanceStaff ? [{ href: '/donations', icon: 'heart-circle-outline', label: 'Donations' }] : []),
        ...(caps.isFinanceStaff ? [{ href: '/expenses', icon: 'receipt-outline', label: 'Expenses' }] : []),
        ...(caps.isFinanceViewer ? [{ href: '/cheques', icon: 'card-outline', label: 'Cheques' }] : []),
        ...(caps.isAccountant ? [{ href: '/accounting', icon: 'book-outline', label: t('finance.accounting') || 'Accounting' }] : []),
        ...(caps.isAdmissions ? [{ href: '/admissions', icon: 'people-outline', label: t('admissions.pipeline') || 'Admissions' }] : []),
        { href: '/welfare', icon: 'heart-outline', label: t('welfare.title') || 'Welfare' },
        { href: '/exams', icon: 'school-outline', label: t('exams.title') || 'Exams' },
        { href: '/library', icon: 'library-outline', label: t('nav.library') || 'Library' },
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
