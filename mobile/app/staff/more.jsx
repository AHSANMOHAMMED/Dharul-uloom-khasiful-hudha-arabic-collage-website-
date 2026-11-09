import { useI18n } from '../../lib/i18n';
import { useAuth } from '../../lib/auth';
import SettingsView from '../../components/views/SettingsView';
import { staffTabsFor, multiHatRoles, ROLE_SHORTCUTS } from '../../lib/rolePortals';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Row, Txt } from '../../components';

export default function StaffMore() {
  const { t } = useI18n();
  const { caps, profile } = useAuth();
  const { duty, shortcuts } = staffTabsFor(profile);
  const hats = multiHatRoles(profile);
  const [activeDuty, setActiveDuty] = useState(duty);
  const dutyShortcuts = ROLE_SHORTCUTS[activeDuty] || shortcuts || [];

  const links = [
    ...dutyShortcuts.map((s) => ({
      href: s.href,
      icon: s.icon,
      label: t(s.title) || s.title,
    })),
    ...(caps.isFinanceViewer ? [{ href: '/finance', icon: 'wallet-outline', label: t('fin.title') }] : []),
    ...(caps.isFinanceViewer ? [{ href: '/finance-hub', icon: 'git-network-outline', label: 'Finance Hub' }] : []),
    ...(caps.isFinanceStaff ? [{ href: '/receive-payment', icon: 'cash-outline', label: t('counter.title') }] : []),
    ...(caps.isFinanceStaff ? [{ href: '/donations', icon: 'heart-circle-outline', label: 'Donations' }] : []),
    ...(caps.isFinanceStaff ? [{ href: '/expenses', icon: 'receipt-outline', label: 'Expenses' }] : []),
    ...(caps.isFinanceViewer ? [{ href: '/cheques', icon: 'card-outline', label: 'Cheques' }] : []),
    ...(caps.isAccountant ? [{ href: '/accounting', icon: 'book-outline', label: t('finance.accounting') || 'Accounting' }] : []),
    ...(caps.isAdmissions ? [{ href: '/admissions', icon: 'people-outline', label: t('admissions.pipeline') || 'Admissions' }] : []),
    ...(caps.isHr ? [{ href: '/staff/hr', icon: 'briefcase-outline', label: t('tabs.hr') }] : []),
    ...(caps.isTutor ? [{ href: '/tutor-lms', icon: 'school-outline', label: t('lms.title') || 'Class LMS' }] : []),
    { href: '/hostel', icon: 'bed-outline', label: t('hostel.title') || 'Hostel' },
    { href: '/discipline', icon: 'shield-outline', label: t('discipline.title') || 'Discipline' },
    { href: '/welfare', icon: 'heart-outline', label: t('welfare.title') || 'Welfare' },
    { href: '/exams', icon: 'school-outline', label: t('exams.title') || 'Exams' },
    { href: '/library', icon: 'library-outline', label: t('nav.library') || 'Library' },
    ...(caps.canViewAnalytics ? [{ href: '/analytics', icon: 'bar-chart-outline', label: t('analytics.title') }] : []),
    { href: '/responsibilities', icon: 'flag-outline', label: t('resp.title') },
    { href: '/tasks', icon: 'checkbox-outline', label: t('task.boardTitle') },
    { href: '/duties', icon: 'ribbon-outline', label: t('duty.title') },
    { href: '/mashoora', icon: 'people-outline', label: t('mashoora.title') },
    { href: '/timetable?tutor=me', icon: 'time-outline', label: t('staff.myTimetable') },
    { href: '/my-attendance', icon: 'calendar-outline', label: t('staff.myAttendance') },
    { href: '/staff-leave', icon: 'airplane-outline', label: t('staff.requestLeave') },
    { href: '/payslips', icon: 'cash-outline', label: t('staff.payslips') },
    { href: '/dictionary', icon: 'language-outline', label: t('dict.title') },
    { href: '/announcements', icon: 'megaphone-outline', label: t('home.announcements') },
    { href: '/messages', icon: 'chatbubbles-outline', label: t('chat.title') },
    { href: '/notifications', icon: 'notifications-outline', label: t('notif.title') },
  ];

  // Dedupe by href
  const seen = new Set();
  const deduped = links.filter((l) => {
    if (seen.has(l.href)) return false;
    seen.add(l.href);
    return true;
  });

  return (
    <View style={{ flex: 1 }}>
      {hats.length > 1 ? (
        <Card style={{ margin: 12, marginBottom: 0 }}>
          <Txt variant="label">{t('roles.switch') || 'Active duty'}</Txt>
          <Row style={{ flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {hats.map((h) => (
              <Button
                key={h.key}
                small
                title={t(h.labelKey) || h.key}
                variant={activeDuty === h.key ? 'primary' : 'muted'}
                onPress={() => setActiveDuty(h.key)}
              />
            ))}
          </Row>
        </Card>
      ) : null}
      <SettingsView links={deduped} />
    </View>
  );
}
