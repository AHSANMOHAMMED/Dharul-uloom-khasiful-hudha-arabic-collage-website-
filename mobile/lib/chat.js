import { supabase } from './supabase';

function client() {
  if (!supabase) throw new Error('Messaging is not configured');
  return supabase;
}

export async function chatConversations() {
  const { data, error } = await client().rpc('my_chat_conversations');
  if (error) throw error;
  return data || [];
}

export async function chatContacts(search = '') {
  const { data, error } = await client().rpc('search_chat_contacts', { p_search: search.trim() });
  if (error) throw error;
  return data || [];
}

export async function openChat(userId) {
  const { data, error } = await client().rpc('open_chat_conversation', { p_other: userId });
  if (error) throw error;
  return data;
}

export async function chatMessages(conversationId) {
  const { data, error } = await client().rpc('chat_messages_page', {
    p_conversation: conversationId, p_before: null, p_limit: 100,
  });
  if (error) throw error;
  return (data || []).reverse();
}

export async function sendChat(conversationId, body) {
  const { data, error } = await client().rpc('send_chat_message', { p_conversation: conversationId, p_body: body });
  if (error) throw error;
  client().functions.invoke('send-outbound', { body: { chat_message_id: data } })
    .then(({ error: dispatchError }) => dispatchError && console.warn('[chat] WhatsApp alert stays queued', dispatchError))
    .catch((e) => console.warn('[chat] WhatsApp alert stays queued', e));
  return data;
}

export async function readChat(conversationId) {
  const { error } = await client().rpc('mark_chat_read', { p_conversation: conversationId });
  if (error) throw error;
}

export async function deliverChat(conversationId = null) {
  try {
    await client().rpc('mark_chat_delivered', { p_conversation: conversationId });
  } catch {
    // non-fatal
  }
}

export function subscribeOrgPresence(orgId, userId, onSync) {
  if (!supabase || !userId) return () => {};
  const channel = supabase.channel(`org-presence:${orgId || 'default'}`, {
    config: { presence: { key: userId } },
  });
  channel
    .on('presence', { event: 'sync' }, () => {
      onSync(new Set(Object.keys(channel.presenceState())));
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: userId, online_at: new Date().toISOString() }).catch(() => {});
      }
    });
  return () => supabase.removeChannel(channel);
}

export function liveChat(conversationId, onMessage) {
  const c = client();
  const channel = c.channel(`mobile-chat:${conversationId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` }, (event) => onMessage(event.new, event.eventType))
    .subscribe();
  return () => c.removeChannel(channel);
}
