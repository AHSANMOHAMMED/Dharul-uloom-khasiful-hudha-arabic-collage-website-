import { supabase, must } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { announcementVisible } from '../../lib/roles';
import { formatDate } from '../../lib/format';
import { Screen, Card, Txt, EmptyState, Badge, Row } from '..';

export async function fetchAnnouncements(profile, limit = 50) {
  const rows = await must(
    supabase
      .from('announcements')
      .select('id, title, body, target_roles, is_pinned, created_at')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit),
  );
  return rows.filter((a) => announcementVisible(a, profile));
}

export function AnnouncementCard({ a, compact }) {
  return (
    <Card accent={a.is_pinned ? '#d4a017' : undefined}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="strong" style={{ flex: 1 }}>{a.title}</Txt>
        {a.is_pinned ? <Badge label="★" tone="gold" /> : null}
      </Row>
      <Txt variant="muted" numberOfLines={compact ? 3 : undefined}>{a.body}</Txt>
      <Txt variant="small">{formatDate(a.created_at)}</Txt>
    </Card>
  );
}

export default function AnnouncementsView() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const q = useAsync(() => fetchAnnouncements(profile), [profile?.id]);
  const rows = q.data || [];
  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      {!rows.length ? <EmptyState message={t('home.noAnnouncements')} icon="megaphone-outline" /> : null}
      {rows.map((a) => (
        <AnnouncementCard key={a.id} a={a} />
      ))}
    </Screen>
  );
}
