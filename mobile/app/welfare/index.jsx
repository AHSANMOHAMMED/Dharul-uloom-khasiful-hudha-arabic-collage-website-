import { useState } from 'react';
import { Alert, Pressable, TextInput } from 'react-native';
import { router } from 'expo-router';
import { supabase, must } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { formatDate } from '../../lib/format';
import { colors } from '../../lib/theme';
import { Screen, Card, Txt, EmptyState, StatusBadge, Row, Button, SectionHeader } from '../../components';

const CASE_TYPES = ['counselling', 'medical', 'financial_aid', 'family', 'other'];
const STATUSES = ['', 'open', 'in_progress', 'closed'];

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 10,
  padding: 10,
  marginBottom: 8,
  backgroundColor: '#fff',
};

export default function WelfareList() {
  const { t } = useI18n();
  const { profile, caps } = useAuth();
  const canWrite = caps?.isAdmin || caps?.isEmployee || profile?.role === 'super_admin';
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [caseType, setCaseType] = useState('counselling');
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [students, setStudents] = useState([]);

  const q = useAsync(
    () =>
      must(
        (() => {
          let b = supabase
            .from('welfare_cases')
            .select('id, case_type, status, created_at, summary, student:profiles!student_id(full_name, index_number, class_number)')
            .order('created_at', { ascending: false })
            .limit(100);
          if (status) b = b.eq('status', status);
          return b;
        })(),
      ),
    [status],
  );
  const rows = q.data || [];

  const searchStudents = async () => {
    if (!studentSearch.trim()) return;
    try {
      const data = await must(
        supabase
          .from('profiles')
          .select('id, full_name, index_number, class_number')
          .eq('account_type', 'student')
          .or(`full_name.ilike.%${studentSearch.trim()}%,index_number.ilike.%${studentSearch.trim()}%`)
          .limit(15),
      );
      setStudents(data || []);
    } catch (e) {
      Alert.alert(t('common.error') || 'Error', e.message);
    }
  };

  const createCase = async () => {
    if (!studentId || !summary.trim()) {
      Alert.alert('Welfare', 'Pick a student and enter a summary.');
      return;
    }
    setBusy(true);
    try {
      const row = await must(
        supabase.from('welfare_cases').insert({
          student_id: studentId,
          case_type: caseType,
          summary: summary.trim(),
          details: details.trim() || null,
          status: 'open',
          is_confidential: true,
        }).select('id').single(),
      );
      setSummary('');
      setDetails('');
      setStudentId('');
      setShowCreate(false);
      q.reload?.() || q.refresh?.();
      if (row?.id) router.push(`/welfare/${row.id}`);
    } catch (e) {
      Alert.alert(t('common.error') || 'Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Txt variant="title">{t('welfare.title') || 'Welfare cases'}</Txt>
        {canWrite ? (
          <Button title={showCreate ? 'Close' : 'New'} small onPress={() => setShowCreate((v) => !v)} />
        ) : null}
      </Row>

      {showCreate && canWrite ? (
        <Card>
          <SectionHeader title="Open welfare case" />
          <TextInput style={inputStyle} value={studentSearch} onChangeText={setStudentSearch} placeholder="Search student name / index" />
          <Button title="Find student" small variant="muted" onPress={searchStudents} style={{ marginBottom: 8 }} />
          {students.map((s) => (
            <Button
              key={s.id}
              title={`${s.full_name}${s.index_number ? ` · ${s.index_number}` : ''}`}
              small
              variant={studentId === s.id ? 'primary' : 'muted'}
              onPress={() => setStudentId(s.id)}
              style={{ marginBottom: 4 }}
            />
          ))}
          <Row style={{ flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
            {CASE_TYPES.map((c) => (
              <Button key={c} title={c} small variant={caseType === c ? 'primary' : 'muted'} onPress={() => setCaseType(c)} />
            ))}
          </Row>
          <TextInput style={inputStyle} value={summary} onChangeText={setSummary} placeholder="Summary" />
          <TextInput style={[inputStyle, { minHeight: 70 }]} value={details} onChangeText={setDetails} placeholder="Details (optional)" multiline />
          <Button title="Create case" loading={busy} disabled={busy} onPress={createCase} />
        </Card>
      ) : null}

      <Row style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {STATUSES.map((s) => (
          <Button
            key={s || 'all'}
            title={s || (t('common.all') || 'All')}
            small
            variant={status === s ? 'primary' : 'muted'}
            onPress={() => setStatus(s)}
          />
        ))}
      </Row>

      {!rows.length ? <EmptyState message={t('common.none')} icon="heart-outline" /> : null}
      {rows.map((r) => (
        <Pressable key={r.id} onPress={() => router.push(`/welfare/${r.id}`)}>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="strong">{r.student?.full_name || '—'}</Txt>
              <StatusBadge status={r.status} />
            </Row>
            <Txt variant="muted">
              {[r.case_type, r.student?.index_number, formatDate(r.created_at)].filter(Boolean).join(' · ')}
            </Txt>
            {r.summary ? <Txt numberOfLines={2}>{r.summary}</Txt> : null}
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
