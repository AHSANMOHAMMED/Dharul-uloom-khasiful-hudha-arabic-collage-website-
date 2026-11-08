import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { colors } from '../../lib/theme';
import { Chips } from '..';
import DashboardView from './DashboardView';
import FinanceTodayView from './FinanceTodayView';
import FinanceOutstandingView from './FinanceOutstandingView';

/**
 * Finance entry point inside a portal tab. Finance viewers land on "Today";
 * withStats adds the general dashboard (staff portal Dashboard tab).
 */
export default function FinanceTabView({ withStats = false }) {
  const { caps } = useAuth();
  const { t } = useI18n();
  const [view, setView] = useState('today');
  if (!caps.isFinanceViewer) return withStats ? <DashboardView /> : <FinanceOutstandingView />;
  const options = [
    { value: 'today', label: t('fin.today') },
    ...(withStats ? [{ value: 'stats', label: t('tabs.dashboard') }] : []),
    { value: 'outstanding', label: t('admin.outstandingList') },
  ];
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <Chips options={options} value={view} onChange={setView} />
      </View>
      {view === 'today' ? <FinanceTodayView /> : view === 'stats' ? <DashboardView /> : <FinanceOutstandingView />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  bar: { paddingHorizontal: 16, paddingTop: 12 },
});
