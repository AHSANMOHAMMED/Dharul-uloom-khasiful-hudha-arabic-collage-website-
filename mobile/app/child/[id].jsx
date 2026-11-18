import { Stack, router, useLocalSearchParams } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { colors } from '../../lib/theme';
import { useLiveReload } from '../../lib/live';
import { Screen, Card, Txt, StatTile, TileGrid, ListItem, SectionHeader, ErrorBanner, useMoney, LiveIndicator } from '../../components';

const DEFAULT_PERMS = { fees: true, results: true, attendance: true, leave: true };

function may(perms, key) {
  const p = perms && typeof perms === 'object' ? perms : DEFAULT_PERMS;
  const v = p[key];
  if (v === undefined || v === null) return true;
  return v === true || v === 'true';
}

export default function ChildHub() {
  const { id } = useLocalSearchParams();
  const { t } = useI18n();
  const money = useMoney();
  const { user } = useAuth();

  const q = useAsync(async () => {
    const [child, link] = await Promise.all([
      must(supabase.from('profiles').select('id, full_name, index_number, class_number, is_approved').eq('id', id).maybeSingle()),
      must(
        supabase
          .from('parent_children')
          .select('permissions, status')
          .eq('parent_id', user.id)
          .eq('child_id', id)
          .eq('status', 'active')
          .maybeSingle(),
      ),
    ]);
    const perms = link?.permissions || DEFAULT_PERMS;
    const summary = may(perms, 'attendance')
      ? await must(supabase.rpc('attendance_summary', { p_student: id, p_from: null, p_to: null })).catch(() => ({}))
      : {};
    const statement = may(perms, 'fees')
      ? await must(supabase.rpc('student_fee_statement', { p_student: id })).catch(() => null)
      : null;
    return {
      child,
      perms,
      summary: summary || {},
      outstanding: Number(statement?.total_outstanding || 0),
    };
  }, [id, user?.id]);
  const live = useLiveReload(['student_fees', 'attendance'], id ? `student_id=eq.${id}` : undefined, q.reload, !!id);

  const c = q.data?.child;
  const perms = q.data?.perms || DEFAULT_PERMS;
  const go = (pathname, extra = {}) => router.push({ pathname, params: { student: id, ...extra } });

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Stack.Screen options={{ title: c?.full_name || t('child.overview') }} />
      {c ? (
        <>
          <Card accent={colors.gold}>
            <Txt variant="title">{c.full_name}</Txt>
            <Txt variant="muted">
              {[c.index_number, c.class_number ? t('common.classN', { n: c.class_number }) : null].filter(Boolean).join(' · ')}
            </Txt>
            <LiveIndicator live={live} />
          </Card>
          {!c.is_approved ? <ErrorBanner message={t('child.notApproved')} /> : null}
          <TileGrid>
            {may(perms, 'attendance') ? (
              <StatTile
                label={t('home.attendanceRate')}
                value={q.data.summary.rate != null ? `${q.data.summary.rate}%` : '—'}
                icon="checkmark-done-outline"
                onPress={() => go('/attendance-history')}
              />
            ) : null}
            {may(perms, 'fees') ? (
              <StatTile
                label={t('home.outstanding')}
                value={q.data.outstanding > 0 ? money(q.data.outstanding) : t('home.allPaid')}
                icon="wallet-outline"
                tone={q.data.outstanding > 0 ? colors.danger : colors.primary}
                onPress={() => go('/fees')}
              />
            ) : null}
          </TileGrid>
          <SectionHeader title={t('common.more')} />
          {may(perms, 'attendance') ? (
            <ListItem icon="calendar-outline" title={t('attendance.history')} onPress={() => go('/attendance-history')} />
          ) : null}
          {may(perms, 'results') ? (
            <ListItem icon="ribbon-outline" title={t('results.title')} onPress={() => go('/results', { class: c.class_number ?? '' })} />
          ) : null}
          {may(perms, 'fees') ? (
            <ListItem icon="wallet-outline" title={t('fees.title')} subtitle={t('fees.arrearsAndReceipts')} onPress={() => go('/fees')} />
          ) : null}
          {may(perms, 'leave') ? (
            <ListItem icon="airplane-outline" title={t('child.leave')} onPress={() => go('/leave-requests')} />
          ) : null}
          <ListItem icon="shield-outline" title={t('child.discipline')} onPress={() => go('/discipline')} />
          <ListItem icon="medal-outline" title={t('cert.title')} onPress={() => go('/certificates')} />
          <ListItem icon="bed-outline" title={t('hostel.title')} onPress={() => go('/hostel')} />
          <ListItem
            icon="time-outline"
            title={t('timetable.title')}
            onPress={() => router.push({ pathname: '/timetable', params: { class: c.class_number ?? '' } })}
          />
        </>
      ) : null}
    </Screen>
  );
}
