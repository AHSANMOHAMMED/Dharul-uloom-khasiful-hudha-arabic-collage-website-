import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Redirect, Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useLive } from '../lib/live';
import { homeRouteFor } from '../lib/roles';
import { colors } from '../lib/theme';
import Loading from './Loading';

/**
 * Tabs layout for one portal. `portal` is the route prefix ('/student', …);
 * users whose role belongs to another portal are redirected to it.
 * tabs: [{ name, title, icon, hidden }]
 */
export default function RoleTabs({ portal, tabs }) {
  const { session, profile, loading } = useAuth();
  const { t, isRTL } = useI18n();
  const { unread } = useLive();

  if (loading) return <Loading />;
  if (!session) return <Redirect href="/login" />;
  if (!profile) return <Redirect href="/" />;
  const home = homeRouteFor(profile);
  if (home !== portal) return <Redirect href={home} />;

  // Mirror tab order for Arabic.
  const ordered = isRTL ? [...tabs].reverse() : tabs;
  const initial = tabs[0].name;

  return (
    <Tabs
      initialRouteName={initial}
      screenOptions={{
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '700' },
        headerTitleAlign: 'center',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { borderTopColor: colors.border },
        tabBarLabelStyle: { fontWeight: '600' },
        headerRight: () => (
          <Pressable
            onPress={() => router.push('/notifications')}
            hitSlop={10}
            style={styles.bell}
            accessibilityLabel={unread ? t('live.unreadA11y', { n: unread }) : t('notif.title')}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.gold} />
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? '99+' : String(unread)}</Text>
              </View>
            ) : null}
          </Pressable>
        ),
      }}
    >
      {ordered.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.title),
            href: tab.hidden ? null : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bell: { paddingHorizontal: 16 },
  badge: {
    position: 'absolute',
    top: -4,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
});
