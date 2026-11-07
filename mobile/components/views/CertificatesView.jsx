import { useState } from 'react';
import { Alert } from 'react-native';
import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useI18n } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { Screen, Card, ListItem, EmptyState, StatusBadge, SectionHeader, Chips, Field, Button, Txt } from '..';

const TYPES = ['enrolment', 'character', 'completion', 'transfer', 'attendance', 'hifz', 'ijazah', 'achievement', 'other'];

export default function CertificatesView({ studentId }) {
  const { t } = useI18n();
  const [type, setType] = useState('enrolment');
  const [purpose, setPurpose] = useState('');
  const [saving, setSaving] = useState(false);

  const q = useAsync(async () => {
    const [certs, requests] = await Promise.all([
      must(
        supabase
          .from('certificates')
          .select('id, certificate_type, serial_no, verification_code, title, issued_date, status')
          .eq('student_id', studentId)
          .order('issued_date', { ascending: false }),
      ),
      must(
        supabase
          .from('document_requests')
          .select('id, certificate_type, purpose, status, review_note, created_at')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false }),
      ),
    ]);
    return { certs, requests };
  }, [studentId], { enabled: !!studentId });

  const submit = async () => {
    setSaving(true);
    try {
      await must(
        supabase.from('document_requests').insert({ student_id: studentId, certificate_type: type, purpose: purpose.trim() || null }),
      );
      setPurpose('');
      Alert.alert(t('common.success'), t('cert.sent'));
      q.reload();
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  const certs = q.data?.certs || [];
  const requests = q.data?.requests || [];

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <SectionHeader title={t('cert.mine')} />
      {!certs.length ? <EmptyState message={t('cert.none')} icon="document-text-outline" /> : null}
      {certs.map((c) => (
        <ListItem
          key={c.id}
          icon="medal-outline"
          iconColor="#d4a017"
          title={c.title || t(`certType.${c.certificate_type}`)}
          subtitle={`${t('cert.serial', { serial: c.serial_no })} · ${formatDate(c.issued_date)}`}
          meta={t('cert.verify', { code: c.verification_code })}
          right={<StatusBadge status={c.status} />}
        />
      ))}

      <SectionHeader title={t('cert.request')} />
      <Card>
        <Txt variant="label">{t('cert.type')}</Txt>
        <Chips options={TYPES.map((v) => ({ value: v, label: t(`certType.${v}`) }))} value={type} onChange={setType} />
        <Field label={t('cert.purpose')} placeholder={t('cert.purposePlaceholder')} value={purpose} onChangeText={setPurpose} />
        <Button title={t('common.submit')} icon="send-outline" loading={saving} onPress={submit} />
      </Card>

      <SectionHeader title={t('cert.requests')} />
      {!requests.length ? <EmptyState message={t('cert.noRequests')} /> : null}
      {requests.map((r) => (
        <ListItem
          key={r.id}
          title={t(`certType.${r.certificate_type}`)}
          subtitle={[formatDate(r.created_at), r.purpose].filter(Boolean).join(' · ')}
          meta={r.review_note || undefined}
          right={<StatusBadge status={r.status} />}
        />
      ))}
    </Screen>
  );
}
