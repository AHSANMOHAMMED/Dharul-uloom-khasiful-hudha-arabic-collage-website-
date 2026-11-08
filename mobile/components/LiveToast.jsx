import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLive } from '../lib/live';
import { useI18n } from '../lib/i18n';
import { notificationRoute } from '../lib/push';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../lib/theme';
import Txt from './Txt';

const VISIBLE_MS = 6000;

/** In-app banner for notifications that arrive while the app is open. */
export default function LiveToast() {
  const { toast, dismissToast, refreshUnread } = useLive();
  const { row, t } = useI18n();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(dismissToast, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;
  const type = toast.data?.type;
  const icon = type === 'fee_receipt' ? 'receipt-outline' : type === 'activity' ? 'flag-outline' : type === 'task' ? 'checkbox-outline' : 'notifications-outline';

  const open = async () => {
    dismissToast();
    router.push(notificationRoute(toast));
    if (supabase && toast.id) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', toast.id);
      refreshUnread();
    }
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <Pressable onPress={open} style={({ pressed }) => [styles.card, row, pressed && styles.pressed]} accessibilityRole="button">
        <View style={styles.icon}>
          <Ionicons name={icon} size={20} color={colors.primaryDark} />
        </View>
        <View style={styles.body}>
          <Txt variant="strong" style={styles.title} numberOfLines={1}>{toast.title || t('notif.title')}</Txt>
          {toast.message ? <Txt style={styles.message} numberOfLines={3}>{toast.message}</Txt> : null}
          <Txt variant="small" style={styles.hint}>{t('live.tapToOpen')}</Txt>
        </View>
        <Pressable onPress={dismissToast} hitSlop={10} accessibilityLabel={t('common.close')}>
          <Ionicons name="close" size={18} color={colors.white} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 1000, elevation: 1000 },
  card: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    padding: 12,
    gap: 10,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  pressed: { opacity: 0.9 },
  icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  title: { color: colors.white },
  message: { color: '#e2e8f0', fontSize: 13 },
  hint: { color: colors.gold },
});
