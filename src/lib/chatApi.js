import { supabase, isSupabaseConfigured } from './supabaseClient';

function requireClient() {
  if (!isSupabaseConfigured || !supabase) throw new Error('Messaging is not configured');
  return supabase;
}

export async function listChatConversations() {
  const { data, error } = await requireClient().rpc('my_chat_conversations');
  if (error) throw error;
  return data || [];
}

export async function searchChatContacts(search = '') {
  const { data, error } = await requireClient().rpc('search_chat_contacts', { p_search: search.trim() });
  if (error) throw error;
  return data || [];
}

export async function openChatConversation(userId) {
  const { data, error } = await requireClient().rpc('open_chat_conversation', { p_other: userId });
  if (error) throw error;
  return data;
}

export async function listChatMessages(conversationId, limit = 100) {
  const { data, error } = await requireClient().rpc('chat_messages_page', {
    p_conversation: conversationId, p_limit: Math.min(100, Math.max(1, limit)), p_before: null,
  });
  if (error) throw error;
  return (data || []).reverse();
}

export async function sendChatMessage(conversationId, body) {
  const { data, error } = await requireClient().rpc('send_chat_message', {
    p_conversation: conversationId,
    p_body: body,
  });
  if (error) throw error;
  // The database has already persisted the message and in-app notification.
  // Trigger the opted-in WhatsApp teaser asynchronously; provider failure is
  // tracked in message_outbox and must not make the in-app send appear lost.
  requireClient().functions.invoke('send-outbound', { body: { chat_message_id: data } })
    .then(({ error: dispatchError }) => {
      if (dispatchError) console.warn('[chatApi] WhatsApp notification remains queued', dispatchError);
    })
    .catch((dispatchError) => console.warn('[chatApi] WhatsApp notification remains queued', dispatchError));
  return data;
}

export async function markChatRead(conversationId) {
  const { data, error } = await requireClient().rpc('mark_chat_read', { p_conversation: conversationId });
  if (error) throw error;
  return data;
}

export function subscribeToChat(conversationId, onMessage) {
  const client = requireClient();
  const channel = client
    .channel(`chat:${conversationId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}`,
    }, (payload) => onMessage(payload.new, payload.eventType))
    .subscribe();
  return () => client.removeChannel(channel);
}
