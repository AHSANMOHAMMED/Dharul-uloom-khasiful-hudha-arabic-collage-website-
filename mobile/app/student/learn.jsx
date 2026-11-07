import { useState } from 'react';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { supabase, must } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { formatDate, toISODate } from '../../lib/format';
import { Screen, Chips, ListItem, EmptyState, Badge, Card, Txt, Button, Row } from '../../components';

export default function Learn() {
  const { t } = useI18n();
  const { user, profile } = useAuth();
  const [tab, setTab] = useState('assignments');
  const cls = profile?.class_number;

  const q = useAsync(async () => {
    if (!cls) return { assignments: [], materials: [], subs: {} };
    const [assignments, materials, subs] = await Promise.all([
      must(
        supabase
          .from('lms_assignments')
          .select('id, subject, title, description, due_date, created_at')
          .eq('class_number', cls)
          .order('due_date', { ascending: false, nullsFirst: false }),
      ),
      must(
        supabase
          .from('lms_materials')
          .select('id, subject, title, description, file_url, link_url, created_at')
          .eq('class_number', cls)
          .order('created_at', { ascending: false }),
      ),
      must(supabase.from('lms_submissions').select('assignment_id, grade, submitted_at').eq('student_id', user.id)),
    ]);
    return { assignments, materials, subs: Object.fromEntries(subs.map((s) => [s.assignment_id, s])) };
  }, [cls, user?.id]);

  const d = q.data || { assignments: [], materials: [], subs: {} };
  const today = toISODate();

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Chips
        options={[
          { value: 'assignments', label: t('lms.assignments') },
          { value: 'materials', label: t('lms.materials') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'assignments' ? (
        <>
          {!d.assignments.length ? <EmptyState message={t('lms.noAssignments')} icon="create-outline" /> : null}
          {d.assignments.map((a) => {
            const sub = d.subs[a.id];
            const overdue = !sub && a.due_date && a.due_date < today;
            return (
              <ListItem
                key={a.id}
                icon="create-outline"
                title={a.title}
                subtitle={`${a.subject}${a.due_date ? ` · ${t('lms.dueOn', { date: formatDate(a.due_date) })}` : ''}`}
                onPress={() => router.push(`/assignment/${a.id}`)}
                right={
                  sub?.grade ? (
                    <Badge label={`${t('lms.graded')}: ${sub.grade}`} tone="gold" />
                  ) : sub ? (
                    <Badge label={t('lms.submitted')} tone="success" />
                  ) : (
                    <Badge label={t('lms.notSubmitted')} tone={overdue ? 'danger' : 'warning'} />
                  )
                }
              />
            );
          })}
        </>
      ) : (
        <>
          {!d.materials.length ? <EmptyState message={t('lms.noMaterials')} icon="library-outline" /> : null}
          {d.materials.map((m) => (
            <Card key={m.id}>
              <Txt variant="strong">{m.title}</Txt>
              <Txt variant="small">{`${m.subject} · ${formatDate(m.created_at)}`}</Txt>
              {m.description ? <Txt variant="muted">{m.description}</Txt> : null}
              <Row>
                {m.link_url ? <Button small variant="outline" icon="link-outline" title={t('lms.openLink')} onPress={() => WebBrowser.openBrowserAsync(m.link_url)} /> : null}
                {m.file_url ? <Button small variant="outline" icon="document-outline" title={t('lms.openFile')} onPress={() => WebBrowser.openBrowserAsync(m.file_url)} /> : null}
              </Row>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
