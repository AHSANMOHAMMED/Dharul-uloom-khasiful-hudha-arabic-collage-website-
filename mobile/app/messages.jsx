import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useLiveTable } from '../lib/live';
import { colors, radius } from '../lib/theme';
import { chatContacts, chatConversations, chatMessages, liveChat, openChat, readChat, sendChat } from '../lib/chat';
import { supabase } from '../lib/supabase';
import { Screen, Txt, Button, ErrorBanner } from '../components';

export default function MessagesScreen() {
  const { t, row } = useI18n();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const conversationId = Array.isArray(params.conversation) ? params.conversation[0] : params.conversation;
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const active = conversations.find((c) => c.conversation_id === conversationId);

  useLiveTable({ table: 'chat_conversations', enabled: !!user, onChange: reloadConversations });

  const reloadConversations = useCallback(async () => {
    try { setConversations(await chatConversations()); setError(''); }
    catch (e) { setError(e.message || t('chat.error')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { reloadConversations(); }, [reloadConversations]);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      try { const rows = await chatContacts(search); if (alive) setContacts(rows); }
      catch (e) { if (alive && search.trim()) setError(e.message || t('chat.error')); }
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [search, t]);

  const reloadMessages = useCallback(async (id) => {
    if (!id) return;
    try {
      await readChat(id);
      const rows = await chatMessages(id);
      setMessages(rows);
      setHasOlder(rows.length === 100);
      await reloadConversations();
    } catch (e) { setError(e.message || t('chat.error')); }
  }, [reloadConversations, t]);

  useEffect(() => {
    if (!conversationId) { setMessages([]); setHasOlder(false); return undefined; }
    reloadMessages(conversationId);
    const stop = liveChat(conversationId, (incoming, eventType) => {
      if (eventType === 'UPDATE') {
        setMessages((current) => current.map((m) => m.id === incoming.id ? { ...m, ...incoming } : m));
      } else {
        setMessages((current) => current.some((m) => m.id === incoming.id) ? current : [...current, incoming]);
        if (incoming.sender_id !== user?.id) readChat(conversationId).then(reloadConversations).catch(() => {});
      }
      reloadConversations();
    });
    return stop;
  }, [conversationId, reloadMessages, reloadConversations, user?.id]);

  const selectContact = async (person) => {
    setSending(true); setError('');
    try {
      const id = await openChat(person.user_id);
      await reloadConversations();
      setSearch('');
      router.replace({ pathname: '/messages', params: { conversation: id } });
    } catch (e) { setError(e.message || t('chat.error')); }
    finally { setSending(false); }
  };

  const submit = async () => {
    const body = draft.trim();
    if (!conversationId || !body || sending) return;
    setSending(true); setDraft('');
    try { await sendChat(conversationId, body); await reloadMessages(conversationId); }
    catch (e) { setDraft(body); setError(e.message || t('chat.error')); }
    finally { setSending(false); }
  };

  if (!conversationId) {
    return (
      <Screen loading={loading} onRefresh={reloadConversations}>
        <Txt variant="title">{t('chat.title')}</Txt>
        <TextInput value={search} onChangeText={setSearch} placeholder={t('chat.search')} placeholderTextColor={colors.muted} style={styles.search} />
        {search.trim() ? <Txt variant="label">{t('chat.people')}</Txt> : null}
        {search.trim() ? contacts.map((p) => (
          <Pressable key={p.user_id} onPress={() => selectContact(p)} disabled={sending} style={[styles.row, row]}>
            <Avatar name={p.full_name} />
            <View style={styles.flex}><Txt variant="strong">{p.full_name}</Txt><Txt variant="small">{typeLabel(p.account_type, t)}{p.class_number ? ` · ${t('common.class')} ${p.class_number}` : ''}</Txt></View>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
          </Pressable>
        )) : null}
        {!search.trim() && conversations.map((c) => (
          <Pressable key={c.conversation_id} onPress={() => router.push({ pathname: '/messages', params: { conversation: c.conversation_id } })} style={[styles.row, row]}>
            <Avatar name={c.other_user_name} />
            <View style={styles.flex}><Txt variant="strong">{c.other_user_name}</Txt><Txt variant="muted" numberOfLines={1}>{c.last_message || typeLabel(c.other_account_type, t)}</Txt></View>
            {Number(c.unread_count) > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{c.unread_count}</Text></View> : null}
          </Pressable>
        ))}
        {!search.trim() && !conversations.length && !loading ? <Txt center variant="muted">{t('chat.none')}</Txt> : null}
        {search.trim() && !contacts.length ? <Txt center variant="muted">{t('chat.noPeople')}</Txt> : null}
        {error ? <ErrorBanner message={error} /> : null}
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={[styles.header, row]}>
        <Pressable onPress={() => router.replace('/messages')} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.primaryDark} /></Pressable>
        <Avatar name={active?.other_user_name || ''} />
        <View style={styles.flex}><Txt variant="strong">{active?.other_user_name || t('chat.title')}</Txt><Txt variant="small">{typeLabel(active?.other_account_type, t)}</Txt></View>
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messages}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={hasOlder ? <Button title={t('chat.loadOlder')} variant="outline" small onPress={async () => {
          const before = messages[0]?.created_at;
          if (!before) return;
          try {
            const { data, error: pageError } = await supabase.rpc('chat_messages_page', { p_conversation: conversationId, p_before: before, p_limit: 100 });
            if (pageError) throw pageError;
            const older = [...(data || [])].reverse();
            setMessages((current) => [...older, ...current]);
            setHasOlder(older.length === 100);
          } catch (e) { setError(e.message || t('chat.error')); }
        }} /> : null}
        ListEmptyComponent={<View style={styles.empty}><Txt center variant="muted">{t('chat.start', { name: active?.other_user_name || '' })}</Txt></View>}
        renderItem={({ item }) => {
          const mine = item.sender_id === user?.id;
          return <View style={[styles.bubbleRow, mine ? styles.mineRow : styles.theirRow]}><View style={[styles.bubble, mine ? styles.mineBubble : styles.theirBubble]}><Text style={styles.messageText}>{item.body}</Text><Text style={styles.meta}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{mine ? (item.read_at ? '  ✓✓' : '  ✓') : ''}</Text></View></View>;
        }}
      />
      <View style={[styles.composer, row]}>
        <TextInput value={draft} onChangeText={(v) => setDraft(v.slice(0, 4000))} placeholder={t('chat.placeholder')} placeholderTextColor={colors.muted} multiline style={styles.input} />
        <Button small title={t('chat.send')} icon="send" disabled={sending || !draft.trim()} onPress={submit} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Avatar({ name }) {
  return <View style={styles.avatar}><Text style={styles.avatarText}>{(name || '?').trim().slice(0, 1).toUpperCase()}</Text></View>;
}

function typeLabel(type, t) {
  return ({ student: t('chat.student'), parent: t('chat.parent'), tutor: t('chat.tutor'), staff: t('chat.staff') })[type] || '';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { paddingHorizontal: 12, paddingVertical: 11, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12 },
  avatar: { height: 42, width: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  avatarText: { fontWeight: '800', color: colors.primary },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  header: { minHeight: 64, paddingHorizontal: 12, gap: 10, alignItems: 'center', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { padding: 6 },
  messages: { flexGrow: 1, justifyContent: 'flex-end', padding: 12, gap: 9, backgroundColor: '#F5F2EB' },
  empty: { minHeight: 120, justifyContent: 'center', padding: 24 },
  bubbleRow: { width: '100%', flexDirection: 'row' },
  mineRow: { justifyContent: 'flex-end' },
  theirRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '84%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  mineBubble: { backgroundColor: '#D9FDD3', borderBottomRightRadius: 5 },
  theirBubble: { backgroundColor: colors.white, borderBottomLeftRadius: 5 },
  messageText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  meta: { color: colors.muted, fontSize: 10, textAlign: 'right', marginTop: 4 },
  composer: { alignItems: 'flex-end', gap: 8, padding: 10, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, maxHeight: 120, minHeight: 44, paddingVertical: 10, paddingHorizontal: 13, backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.border, color: colors.text },
});
