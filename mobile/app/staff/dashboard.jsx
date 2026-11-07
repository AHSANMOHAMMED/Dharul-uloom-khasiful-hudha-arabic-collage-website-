import DashboardView from '../../components/views/DashboardView';
import FinanceOutstandingView from '../../components/views/FinanceOutstandingView';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { colors } from '../../lib/theme';
import { Chips } from '../../components';

// Leadership / finance / HR staff get the admin-lite dashboard inside the staff portal.
export default function StaffDashboard() {
  const { caps } = useAuth();
  const { t } = useI18n();
  const [view, setView] = useState('stats');
  if (!caps.isFinanceViewer) return <DashboardView />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Chips
          options={[
            { value: 'stats', label: t('tabs.dashboard') },
            { value: 'finance', label: t('admin.outstandingList') },
          ]}
          value={view}
          onChange={setView}
        />
      </View>
      {view === 'stats' ? <DashboardView /> : <FinanceOutstandingView />}
    </View>
  );
}
