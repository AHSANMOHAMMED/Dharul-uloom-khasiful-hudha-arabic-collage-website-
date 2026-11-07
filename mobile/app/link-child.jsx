import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase, must } from '../lib/supabase';
import { useI18n } from '../lib/i18n';
import { Screen, Card, Chips, Field, Button, Txt } from '../components';

const RELS = ['father', 'mother', 'guardian', 'other'];

export default function LinkChild() {
  const { t } = useI18n();
  const [mode, setMode] = useState('index');
  const [index, setIndex] = useState('');
  const [token, setToken] = useState('');
  const [rel, setRel] = useState('guardian');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const done = (msg) => {
    setMessage(msg);
    Alert.alert(t('common.success'), msg, [{ text: t('common.close'), onPress: () => router.back() }]);
  };

  const submit = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (mode === 'index') {
        if (!index.trim()) throw new Error(t('common.required'));
        const res = await must(
          supabase.rpc('request_child_link', { p_index: index.trim(), p_relationship: rel, p_note: note.trim() || null }),
        );
        if (res?.status === 'linked') done(t('parent.linked', { name: res.child_name || index.trim() }));
        else if (res?.status === 'already_linked') done(t('parent.alreadyLinked'));
        else done(t('parent.pending'));
      } else {
        if (!token.trim()) throw new Error(t('common.required'));
        const res = await must(supabase.rpc('claim_parent_invite', { p_token: token.trim() }));
        if (!res?.ok) throw new Error(res?.error || t('common.error'));
        done(t('parent.inviteOk'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Chips
        options={[
          { value: 'index', label: t('parent.byIndex') },
          { value: 'invite', label: t('parent.byInvite') },
        ]}
        value={mode}
        onChange={setMode}
      />
      <Card>
        {mode === 'index' ? (
          <>
            <Field label={t('parent.byIndex')} placeholder={t('parent.indexPlaceholder')} value={index} onChangeText={setIndex} autoCapitalize="characters" />
            <Txt variant="label">{t('parent.relationship')}</Txt>
            <Chips options={RELS.map((r) => ({ value: r, label: t(`rel.${r}`) }))} value={rel} onChange={setRel} />
            <Field label={t('parent.noteOptional')} value={note} onChangeText={setNote} />
          </>
        ) : (
          <Field label={t('parent.byInvite')} placeholder={t('parent.invitePlaceholder')} value={token} onChangeText={setToken} autoCapitalize="none" />
        )}
        <Button title={t('parent.linkBtn')} icon="link-outline" loading={saving} onPress={submit} />
        {message ? <Txt variant="muted">{message}</Txt> : null}
      </Card>
    </Screen>
  );
}
