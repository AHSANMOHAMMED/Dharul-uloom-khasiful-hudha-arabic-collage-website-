import { useState } from 'react';
import { Alert, TextInput } from 'react-native';
import { Redirect, router } from 'expo-router';
import { supabase, must } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { formatDate } from '../lib/format';
import { colors } from '../lib/theme';
import { Screen, Card, Txt, EmptyState, Row, Button, SectionHeader, StatusBadge } from '../components';

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 10,
  padding: 10,
  marginBottom: 8,
  backgroundColor: '#fff',
};

export default function TutorLmsScreen() {
  const { t } = useI18n();
  const { profile, caps, user } = useAuth();
  const canTeach = caps?.isTutor || caps?.isAdmin || profile?.role === 'super_admin';
  const [tab, setTab] = useState('assignments');
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('General');
  const [classNumber, setClassNumber] = useState('1');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialLink, setMaterialLink] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [gradeText, setGradeText] = useState('');
  const [feedback, setFeedback] = useState('');

  const q = useAsync(async () => {
    if (!user?.id) return { assignments: [], materials: [], submissions: [] };
    const [assignments, materials] = await Promise.all([
      must(
        supabase
          .from('lms_assignments')
          .select('id, subject, title, description, due_date, class_number, created_at')
          .eq('tutor_id', user.id)
          .order('created_at', { ascending: false })
          .limit(40),
      ),
      must(
        supabase
          .from('lms_materials')
          .select('id, subject, title, description, link_url, file_url, class_number, created_at')
          .eq('tutor_id', user.id)
          .order('created_at', { ascending: false })
          .limit(40),
      ),
    ]);
    let submissions = [];
    if (selectedAssignment?.id) {
      submissions = await must(
        supabase
          .from('lms_submissions')
          .select('id, student_id, content, grade, feedback, submitted_at, student:profiles!student_id(full_name, index_number)')
          .eq('assignment_id', selectedAssignment.id)
          .order('submitted_at', { ascending: false }),
      );
    }
    return { assignments, materials, submissions };
  }, [user?.id, selectedAssignment?.id]);

  if (!profile) return null;
  if (!canTeach) return <Redirect href="/" />;

  const assignments = q.data?.assignments || [];
  const materials = q.data?.materials || [];
  const submissions = q.data?.submissions || [];

  const createAssignment = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await must(
        supabase.from('lms_assignments').insert({
          tutor_id: user.id,
          class_number: Number(classNumber) || 1,
          subject: subject.trim() || 'General',
          title: title.trim(),
          description: description.trim() || null,
          due_date: dueDate.trim() || null,
        }).select('id').single(),
      );
      setTitle('');
      setDescription('');
      setDueDate('');
      q.reload?.() || q.refresh?.();
    } catch (e) {
      Alert.alert(t('common.error') || 'Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const createMaterial = async () => {
    if (!materialTitle.trim()) return;
    setBusy(true);
    try {
      await must(
        supabase.from('lms_materials').insert({
          tutor_id: user.id,
          class_number: Number(classNumber) || 1,
          subject: subject.trim() || 'General',
          title: materialTitle.trim(),
          description: description.trim() || null,
          link_url: materialLink.trim() || null,
        }).select('id').single(),
      );
      setMaterialTitle('');
      setMaterialLink('');
      setDescription('');
      q.reload?.() || q.refresh?.();
    } catch (e) {
      Alert.alert(t('common.error') || 'Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const gradeSubmission = async (subId) => {
    if (!gradeText.trim()) {
      Alert.alert('Grade', 'Enter a grade.');
      return;
    }
    setBusy(true);
    try {
      await must(
        supabase.from('lms_submissions').update({
          grade: gradeText.trim(),
          feedback: feedback.trim() || null,
        }).eq('id', subId).select('id').single(),
      );
      setGradeText('');
      setFeedback('');
      q.reload?.() || q.refresh?.();
    } catch (e) {
      Alert.alert(t('common.error') || 'Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen loading={q.loading} error={q.error} onRefresh={q.refresh} refreshing={q.refreshing}>
      <Txt variant="title">{t('lms.title') || 'Class LMS'}</Txt>
      <Txt variant="muted" style={{ marginBottom: 8 }}>Create assignments & materials, review submissions.</Txt>
      <Row style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <Button title="Assignments" small variant={tab === 'assignments' ? 'primary' : 'muted'} onPress={() => setTab('assignments')} />
        <Button title="Materials" small variant={tab === 'materials' ? 'primary' : 'muted'} onPress={() => setTab('materials')} />
        <Button title="Submissions" small variant={tab === 'subs' ? 'primary' : 'muted'} onPress={() => setTab('subs')} />
      </Row>

      <Card>
        <SectionHeader title="Class & subject" />
        <TextInput style={inputStyle} value={classNumber} onChangeText={setClassNumber} placeholder="Class number (1–7)" keyboardType="number-pad" />
        <TextInput style={inputStyle} value={subject} onChangeText={setSubject} placeholder="Subject" />
      </Card>

      {tab === 'assignments' ? (
        <>
          <Card>
            <SectionHeader title="New assignment" />
            <TextInput style={inputStyle} value={title} onChangeText={setTitle} placeholder="Title" />
            <TextInput style={inputStyle} value={description} onChangeText={setDescription} placeholder="Description" multiline />
            <TextInput style={inputStyle} value={dueDate} onChangeText={setDueDate} placeholder="Due YYYY-MM-DD" />
            <Button title="Publish assignment" loading={busy} disabled={busy || !title.trim()} onPress={createAssignment} />
          </Card>
          {!assignments.length ? <EmptyState message={t('lms.noAssignments') || 'No assignments'} icon="create-outline" /> : null}
          {assignments.map((a) => (
            <Card key={a.id}>
              <Txt variant="strong">{a.title}</Txt>
              <Txt variant="muted">
                {[`Class ${a.class_number}`, a.subject, a.due_date ? `due ${formatDate(a.due_date)}` : null].filter(Boolean).join(' · ')}
              </Txt>
              {a.description ? <Txt numberOfLines={3}>{a.description}</Txt> : null}
              <Row style={{ gap: 6, marginTop: 8 }}>
                <Button title="Submissions" small variant="muted" onPress={() => { setSelectedAssignment(a); setTab('subs'); }} />
                <Button title="Open" small variant="outline" onPress={() => router.push(`/assignment/${a.id}`)} />
              </Row>
            </Card>
          ))}
        </>
      ) : null}

      {tab === 'materials' ? (
        <>
          <Card>
            <SectionHeader title="New material" />
            <TextInput style={inputStyle} value={materialTitle} onChangeText={setMaterialTitle} placeholder="Title" />
            <TextInput style={inputStyle} value={materialLink} onChangeText={setMaterialLink} placeholder="Link URL" autoCapitalize="none" />
            <TextInput style={inputStyle} value={description} onChangeText={setDescription} placeholder="Description" multiline />
            <Button title="Publish material" loading={busy} disabled={busy || !materialTitle.trim()} onPress={createMaterial} />
          </Card>
          {!materials.length ? <EmptyState message={t('lms.noMaterials') || 'No materials'} icon="library-outline" /> : null}
          {materials.map((m) => (
            <Card key={m.id}>
              <Txt variant="strong">{m.title}</Txt>
              <Txt variant="muted">{[`Class ${m.class_number}`, m.subject, formatDate(m.created_at)].filter(Boolean).join(' · ')}</Txt>
              {m.link_url ? <Txt variant="small">{m.link_url}</Txt> : null}
            </Card>
          ))}
        </>
      ) : null}

      {tab === 'subs' ? (
        <>
          <Card>
            <SectionHeader title="Pick assignment" />
            {!assignments.length ? <EmptyState message="Create an assignment first" /> : null}
            {assignments.map((a) => (
              <Button
                key={a.id}
                title={`${a.title} (class ${a.class_number})`}
                small
                variant={selectedAssignment?.id === a.id ? 'primary' : 'muted'}
                onPress={() => setSelectedAssignment(a)}
                style={{ marginBottom: 6 }}
              />
            ))}
          </Card>
          {selectedAssignment ? (
            <>
              <Txt variant="h2">{selectedAssignment.title}</Txt>
              <TextInput style={inputStyle} value={gradeText} onChangeText={setGradeText} placeholder="Grade (e.g. A / 85)" />
              <TextInput style={inputStyle} value={feedback} onChangeText={setFeedback} placeholder="Feedback" />
              {!submissions.length ? <EmptyState message="No submissions yet" /> : null}
              {submissions.map((s) => (
                <Card key={s.id}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt variant="strong">{s.student?.full_name || s.student_id?.slice?.(0, 8)}</Txt>
                    {s.grade ? <StatusBadge status={s.grade} /> : null}
                  </Row>
                  <Txt variant="muted">{[s.student?.index_number, formatDate(s.submitted_at)].filter(Boolean).join(' · ')}</Txt>
                  {s.content ? <Txt numberOfLines={4}>{s.content}</Txt> : null}
                  {s.feedback ? <Txt variant="small">Feedback: {s.feedback}</Txt> : null}
                  <Button title="Save grade" small style={{ marginTop: 8 }} disabled={busy} onPress={() => gradeSubmission(s.id)} />
                </Card>
              ))}
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
