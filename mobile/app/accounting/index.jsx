import { useState } from 'react';
import { Alert, Share } from 'react-native';
import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { Screen, Card, Txt, EmptyState, StatusBadge, Row, Button } from '../../components';

export default function AccountingJournals() {
  const { t } = useI18n();
  const [busyId, setBusyId] = useState(null);
  const q = useAsync(
    () =>
      must(
        supabase
          .from('journal_entries')
          .select('id, entry_date, description, status, entry_no, source')
          .order('entry_date', { ascending: false })
          .limit(80),
      ),
    [],
  );
  const rows = q.data || [];

  const post = async (id) => {
    setBusyId(id);
    try {
      await must(supabase.rpc('post_journal_entry', { p_entry: id }));
      q.reload();
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setBusyId(null);
    }
  };

  const shareList = async () => {
    const lines = rows.map(
      (r) => `${r.entry_no || r.id.slice(0, 8)} | ${formatDate(r.entry_date)} | ${r.status} | ${r.description || ''}`,
    );
    try {
      await Share.share({
        title: t('finance.accounting') || 'Journals',
        message: lines.join('\n'),
      });
    } catch (e) {
      Alert.alert(t('common.error'), e?.message);
    }
  };

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Txt variant="title">{t('finance.accounting') || 'Accounting'}</Txt>
        <Button title={t('common.share') || 'Share'} small variant="muted" onPress={shareList} />
      </Row>
      {!rows.length ? <EmptyState message={t('common.none')} icon="book-outline" /> : null}
      {rows.map((r) => (
        <Card key={r.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="strong">{r.entry_no || r.id.slice(0, 8)}</Txt>
            <StatusBadge status={r.status} />
          </Row>
          <Txt variant="muted">{[formatDate(r.entry_date), r.source].filter(Boolean).join(' · ')}</Txt>
          <Txt>{r.description}</Txt>
          {r.status === 'draft' ? (
            <Button
              title={t('finance.post') || 'Post'}
              small
              loading={busyId === r.id}
              onPress={() => post(r.id)}
              style={{ marginTop: 8 }}
            />
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
