import { supabase, isSupabaseConfigured, subscribeTableWithFallback } from './supabaseClient';

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

export async function listOlderChatMessages(conversationId, before, limit = 100) {
  const { data, error } = await requireClient().rpc('chat_messages_page', {
    p_conversation: conversationId, p_before: before, p_limit: Math.min(100, Math.max(1, limit)),
  });
  if (error) throw error;
  return (data || []).reverse();
}

export async function uploadChatAttachment(orgId, conversationId, file) {
  const client = requireClient();
  const safeName = String(file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${orgId || 'org'}/${conversationId}/${Date.now()}-${safeName}`;
  const { error } = await client.storage.from('chat-attachments').upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw error;
  return {
    url: path,
    name: file.name || safeName,
    type: file.type || 'application/octet-stream',
    size: file.size || 0,
  };
}

export async function getChatAttachmentUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await requireClient().storage.from('chat-attachments').createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}

export async function sendChatMessage(conversationId, body, attachment = null) {
  const { data, error } = await requireClient().rpc('send_chat_message', {
    p_conversation: conversationId,
    p_body: body || '',
    p_attachment_url: attachment?.url || null,
    p_attachment_name: attachment?.name || null,
    p_attachment_type: attachment?.type || null,
    p_attachment_size: attachment?.size || null,
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

export async function markChatDelivered(conversationId = null) {
  const { data, error } = await requireClient().rpc('mark_chat_delivered', { p_conversation: conversationId });
  if (error) return 0;
  return data || 0;
}

export async function touchMyPresence() {
  try {
    await requireClient().rpc('touch_my_presence');
  } catch {
    // non-fatal
  }
}

export function subscribeOrgPresence(orgId, userId, onSync) {
  if (!isSupabaseConfigured || !supabase || !userId) return () => {};
  const channel = supabase.channel(`org-presence:${orgId || 'default'}`, {
    config: { presence: { key: userId } },
  });
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      onSync(new Set(Object.keys(state)));
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: userId, online_at: new Date().toISOString() }).catch(() => {});
      }
    });
  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToChat(conversationId, onMessage) {
  requireClient();
  return subscribeTableWithFallback({
    table: 'chat_messages',
    filter: `conversation_id=eq.${conversationId}`,
    channelName: `chat:${conversationId}`,
    onChange: (payload) => onMessage(payload.new, payload.eventType),
    onFallback: async () => {
      try {
        const rows = await listChatMessages(conversationId);
        for (const row of rows) onMessage(row, 'POLL');
      } catch {
        // The next interval or the next user action retries.
      }
    },
  });
}
