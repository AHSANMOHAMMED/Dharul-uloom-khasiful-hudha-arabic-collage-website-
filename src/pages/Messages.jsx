import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { listChatConversations, listChatMessages, markChatRead, openChatConversation, searchChatContacts, sendChatMessage, subscribeToChat } from '../lib/chatApi';
import { tx } from '../lib/tx';

const timeLabel = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
const dateLabel = (value) => value ? new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';

export default function Messages() {
  const { user, isAuthenticated, loading, isParent } = useAuth();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('conversation');
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [error, setError] = useState('');
  const [mobileListOpen, setMobileListOpen] = useState(true);
  const endRef = useRef(null);
  const active = useMemo(() => conversations.find((c) => c.conversation_id === selectedId) || null, [conversations, selectedId]);

  const refreshConversations = useCallback(async () => {
    try {
      const rows = await listChatConversations();
      setConversations(rows);
      setError('');
    } catch (e) {
      setError(e.message || tx('تعذر تحميل الرسائل', 'Could not load messages'));
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    refreshConversations();
    const timer = setInterval(refreshConversations, 45000);
    return () => clearInterval(timer);
  }, [isAuthenticated, refreshConversations]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const rows = await searchChatContacts(search);
        if (live) {
          setContacts(rows);
          setError('');
        }
      } catch (e) {
        if (live) setError(e.message || tx('تعذر البحث عن المستخدمين', 'Could not search users'));
      }
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [isAuthenticated, search]);

  const refreshMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;
    setLoadingMessages(true);
    try {
      await markChatRead(conversationId);
      const rows = await listChatMessages(conversationId);
      setMessages(rows);
      setHasOlder(rows.length === 100);
      await refreshConversations();
      setError('');
    } catch (e) {
      setError(e.message || tx('تعذر تحميل المحادثة', 'Could not load conversation'));
    } finally {
      setLoadingMessages(false);
    }
  }, [refreshConversations]);

  useEffect(() => {
    setMessages([]);
    setHasOlder(false);
    if (!selectedId || !isAuthenticated) return undefined;
    refreshMessages(selectedId);
    const stop = subscribeToChat(selectedId, (incoming, eventType) => {
      if (eventType === 'UPDATE') {
        setMessages((current) => current.map((m) => m.id === incoming.id ? { ...m, ...incoming } : m));
      } else {
        setMessages((current) => current.some((m) => m.id === incoming.id) ? current : [...current, incoming]);
        if (incoming.sender_id !== user?.id) markChatRead(selectedId).then(refreshConversations).catch(() => {});
      }
      refreshConversations();
    });
    return () => stop();
  }, [selectedId, isAuthenticated, user?.id, refreshMessages, refreshConversations]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return undefined;
    const channel = supabase.channel(`chat-list:${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_conversations' }, refreshConversations)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated, user?.id, refreshConversations]);

  if (!loading && !isAuthenticated) return <Navigate to="/login" replace />;

  const chooseContact = async (contact) => {
    setBusy(true);
    setError('');
    try {
      const id = await openChatConversation(contact.user_id);
      await refreshConversations();
      setParams({ conversation: id });
      setMobileListOpen(false);
      setSearch('');
    } catch (e) {
      setError(e.message || tx('تعذر بدء المحادثة', 'Could not start conversation'));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!selectedId || !body || busy) return;
    setBusy(true);
    setDraft('');
    try {
      await sendChatMessage(selectedId, body);
      await refreshMessages(selectedId);
    } catch (e) {
      setDraft(body);
      setError(e.message || tx('تعذر إرسال الرسالة', 'Message could not be sent'));
    } finally {
      setBusy(false);
    }
  };

  const selectConversation = (id) => {
    setParams({ conversation: id });
    setMobileListOpen(false);
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#F4F1E9] px-2 py-3 sm:p-6">
      <section className="mx-auto flex h-[calc(100vh-6rem)] min-h-[520px] max-w-7xl overflow-hidden rounded-2xl border border-[#E8E1D0] bg-white shadow-xl">
        <aside className={`${mobileListOpen ? 'flex' : 'hidden'} w-full shrink-0 flex-col border-e border-[#E8E1D0] bg-[#FBF8F0] md:flex md:w-[340px]`}>
          <header className="bg-[#0B3B2E] px-4 py-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">{tx('الرسائل', 'Messages')}</div>
                <div className="text-xs text-white/70">{tx('محادثات خاصة داخل بوابة الكلية', 'Private conversations in the college app')}</div>
              </div>
              <span className="material-symbols-outlined">forum</span>
            </div>
          </header>
          <div className="p-3">
            <label className="sr-only" htmlFor="chat-search">{tx('ابحث عن مستخدم', 'Find a user')}</label>
            <input id="chat-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isParent ? tx('ابحث عن إدارة أو مدرّس أو موظف…', 'Find admin, tutor, or staff…') : tx('ابحث عن طالب أو ولي أمر أو موظف…', 'Find a student, parent, or staff…')} className="w-full rounded-xl border border-[#E8E1D0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#11694A]" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {search.trim() ? (
              <>
                <div className="px-4 pb-2 text-[11px] font-bold uppercase tracking-wide text-[#60736C]">{tx('مستخدمون', 'People')}</div>
                {contacts.map((person) => (
                  <button key={person.user_id} type="button" disabled={busy} onClick={() => chooseContact(person)} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-white disabled:opacity-50">
                    <Avatar name={person.full_name} />
                    <span className="min-w-0 flex-1"><b className="block truncate text-sm text-[#0B3B2E]">{person.full_name}</b><small className="text-[#60736C]">{roleName(person.account_type)}{person.class_number ? ` · ${tx('الصف', 'Class')} ${person.class_number}` : ''}</small></span>
                    <span className="material-symbols-outlined text-[#11694A]">chat</span>
                  </button>
                ))}
                {!contacts.length && <p className="px-4 py-6 text-center text-xs text-[#60736C]">{tx('لا يوجد مستخدمون مطابقون', 'No matching people')}</p>}
              </>
            ) : (
              <>
                <div className="px-4 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wide text-[#60736C]">{tx('المحادثات', 'Chats')}</div>
                {conversations.map((c) => (
                  <button key={c.conversation_id} type="button" onClick={() => selectConversation(c.conversation_id)} className={`flex w-full items-center gap-3 border-b border-[#E8E1D0]/70 px-4 py-3 text-start hover:bg-white ${selectedId === c.conversation_id ? 'bg-white' : ''}`}>
                    <Avatar name={c.other_user_name} />
                    <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><b className="truncate text-sm text-[#0B3B2E]">{c.other_user_name}</b><small className="shrink-0 text-[10px] text-[#60736C]">{dateLabel(c.last_message_at)}</small></span><span className="flex items-center justify-between gap-2"><small className="truncate text-xs text-[#60736C]">{c.last_message || roleName(c.other_account_type)}</small>{Number(c.unread_count) > 0 && <b className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#11694A] px-1 text-[10px] text-white">{c.unread_count}</b>}</span></span>
                  </button>
                ))}
                {!loadingList && !conversations.length && <p className="px-5 py-8 text-center text-sm text-[#60736C]">{tx('لا توجد محادثات بعد. ابحث عن شخص لبدء محادثة.', 'No conversations yet. Search for someone to start one.')}</p>}
                {loadingList && <p className="px-4 py-6 text-center text-xs text-[#60736C]">{tx('جارٍ التحميل…', 'Loading…')}</p>}
              </>
            )}
          </div>
          <footer className="border-t border-[#E8E1D0] px-4 py-2 text-[10px] text-[#60736C]">{tx('تُحفظ الرسائل داخل التطبيق. قد تصل تنبيهات واتساب عند تفعيلها.', 'Messages stay in the app. WhatsApp alerts may be sent when enabled.')}</footer>
        </aside>

        <section className={`${mobileListOpen ? 'hidden' : 'flex'} min-w-0 flex-1 flex-col md:flex`}>
          {active ? (
            <>
              <header className="flex items-center gap-3 border-b border-[#E8E1D0] bg-white px-4 py-3 shadow-sm">
                <button type="button" aria-label={tx('المحادثات', 'Chats')} onClick={() => setMobileListOpen(true)} className="rounded-lg p-1 text-[#11694A] md:hidden"><span className="material-symbols-outlined">arrow_back</span></button>
                <Avatar name={active.other_user_name} />
                <div className="min-w-0"><b className="block truncate text-sm text-[#0B3B2E]">{active.other_user_name}</b><small className="text-[#60736C]">{roleName(active.other_account_type)}</small></div>
                <span className="ms-auto text-xs text-[#60736C]">{tx('رسائل مباشرة', 'Direct messages')}</span>
              </header>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-[#F5F2EB] px-3 py-4 sm:px-8">
                {loadingMessages && <div className="text-center text-xs text-[#60736C]">{tx('جارٍ تحميل الرسائل…', 'Loading messages…')}</div>}
                {!loadingMessages && messages.length === 0 && <div className="m-auto max-w-xs rounded-2xl bg-white/80 px-5 py-4 text-center text-sm text-[#60736C]">{tx('ابدأ المحادثة برسالة خاصة إلى', 'Start a private conversation with')} {active.other_user_name}.</div>}
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm sm:max-w-[70%] ${mine ? 'rounded-br-sm bg-[#D9FDD3] text-[#143A2A]' : 'rounded-bl-sm bg-white text-[#202C26]'}`}><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p><div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#60736C]">{timeLabel(m.created_at)}{mine && <span className={`material-symbols-outlined text-[14px] ${m.read_at ? 'text-sky-600' : ''}`}>{m.read_at ? 'done_all' : 'done'}</span>}</div></div></div>;
                })}
                {hasOlder && <button type="button" onClick={async () => {
                  const before = messages[0]?.created_at;
                  if (!before) return;
                  const { data, error: pageError } = await supabase.rpc('chat_messages_page', {
                    p_conversation: selectedId, p_before: before, p_limit: 100,
                  });
                  if (pageError) setError(pageError.message);
                  else {
                    const page = [...(data || [])].reverse();
                    setMessages((current) => [...page, ...current]);
                    setHasOlder(page.length === 100);
                  }
                }} className="self-center rounded-full bg-white px-4 py-2 text-xs text-[#11694A] shadow">{tx('تحميل رسائل أقدم', 'Load older messages')}</button>}
                <div ref={endRef} />
              </div>
              <form onSubmit={submit} className="flex items-end gap-2 border-t border-[#E8E1D0] bg-[#FBF8F0] p-3 sm:p-4">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 4000))} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} rows={1} maxLength={4000} placeholder={tx('اكتب رسالة…', 'Type a message…')} className="max-h-32 min-h-11 flex-1 resize-y rounded-2xl border border-[#E8E1D0] bg-white px-4 py-3 text-sm outline-none focus:border-[#11694A]" />
                <button type="submit" disabled={busy || !draft.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#11694A] text-white shadow-sm hover:bg-[#0B3B2E] disabled:cursor-not-allowed disabled:opacity-40" aria-label={tx('إرسال', 'Send')}><span className="material-symbols-outlined">send</span></button>
              </form>
            </>
          ) : (
            <div className="hidden flex-1 flex-col items-center justify-center bg-[#F5F2EB] px-8 text-center md:flex"><span className="material-symbols-outlined text-6xl text-[#11694A]/50">forum</span><h1 className="mt-4 text-xl font-bold text-[#0B3B2E]">{tx('رسائل الكلية', 'College messages')}</h1><p className="mt-2 max-w-md text-sm text-[#60736C]">{isParent ? tx('اختر محادثة أو ابحث عن إدارة الكلية أو مدرّس لبدء مراسلة خاصة.', 'Choose a chat or search for college admin or a tutor to start a private conversation.') : tx('اختر محادثة أو ابحث عن طالب أو ولي أمر أو موظف لبدء مراسلة خاصة وآمنة.', 'Choose a chat or search for a student, parent, or staff member to start a private conversation.')}</p></div>
          )}
        </section>
      </section>
      {error && <div role="alert" className="mx-auto mt-3 max-w-7xl rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</div>}
    </main>
  );
}

function Avatar({ name }) {
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#DCEBE2] font-bold text-[#11694A]">{(name || '?').trim().slice(0, 1).toUpperCase()}</span>;
}

function roleName(type) {
  return ({ student: tx('طالب', 'Student'), parent: tx('ولي أمر', 'Parent'), tutor: tx('مدرس', 'Tutor'), staff: tx('موظف', 'Staff') })[type] || tx('مستخدم', 'User');
}
