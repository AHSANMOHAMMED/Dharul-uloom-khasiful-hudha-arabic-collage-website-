import { router } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { Screen, Txt, ListItem, EmptyState, Button, SectionHeader, StatusBadge } from '../../components';

export async function fetchChildren(parentId) {
  const rows = await must(
    supabase
      .from('parent_children')
      .select('child_id, child:profiles!parent_children_child_id_fkey(id, full_name, index_number, class_number, is_approved)')
      .eq('parent_id', parentId),
  );
  return rows.map((r) => r.child).filter(Boolean);
}

export default function ParentHome() {
  const { t } = useI18n();
  const { user, profile } = useAuth();
  const q = useAsync(async () => {
    const [children, requests] = await Promise.all([
      fetchChildren(user.id),
      must(
        supabase
          .from('parent_link_requests')
          .select('id, child_index, status, created_at')
          .eq('parent_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      ),
    ]);
    return { children, requests };
  }, [user?.id]);

  const children = q.data?.children || [];
  const requests = q.data?.requests || [];

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Txt variant="title">{t('home.greeting', { name: profile?.full_name?.split(' ')[0] || '' })}</Txt>
      <SectionHeader title={t('parent.children')} />
      {!children.length ? <EmptyState message={t('parent.noChildren')} icon="people-outline" /> : null}
      {children.map((c) => (
        <ListItem
          key={c.id}
          icon="person-circle-outline"
          title={c.full_name}
          subtitle={[c.index_number, c.class_number ? t('common.classN', { n: c.class_number }) : null].filter(Boolean).join(' · ')}
          onPress={() => router.push(`/child/${c.id}`)}
        />
      ))}
      <Button title={t('parent.link')} icon="add-circle-outline" variant="gold" onPress={() => router.push('/link-child')} />
      {requests.length ? (
        <>
          <SectionHeader title={t('parent.pendingRequests')} />
          {requests.map((r) => (
            <ListItem key={r.id} icon="hourglass-outline" title={r.child_index} subtitle={formatDate(r.created_at)} right={<StatusBadge status={r.status} />} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
