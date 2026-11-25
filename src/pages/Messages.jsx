import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../context/FeatureFlagsContext';
import { subscribeTableWithFallback } from '../lib/supabaseClient';
import {
  deleteChatMessageForEveryone,
  deleteChatMessageForMe,
  editChatMessage,
  getChatAttachmentUrl,
  listChatConversations,
  listChatMessages,
  listOlderChatMessages,
  markChatDelivered,
  markChatRead,
  openChatConversation,
  searchChatContacts,
  sendChatMessage,
  subscribeOrgPresence,
  subscribeToChat,
  touchMyPresence,
  uploadChatAttachment,
} from '../lib/chatApi';
import { tx } from '../lib/tx';
import PageNavBar from '../components/PageNavBar';
import Icon from '../components/Icon';
import { portalHomeFor } from '../lib/useHistoryNav';

const timeLabel = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
const dateLabel = (value) => value ? new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';

export default function Messages({ embedded = false } = {}) {
  const auth = useAuth();
  const { user, isAuthenticated, loading, isApproved, isStudent, isParent, isEmployee, isAdmin, isLibrarian, isSuperAdmin } = auth;
  const { enabled, loading: featuresLoading } = useFeatures();
  const isVisitor = isAuthenticated && user?.accountType === 'guest' && !isEmployee && !isAdmin && !isLibrarian;
  const messagingEnabled = enabled('messaging');
  // Institution chat is per-college for approved non-guest members when enabled.
  const chatAllowed = isAuthenticated && !loading && !featuresLoading && isApproved && !isSuperAdmin && !isVisitor && messagingEnabled;
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
  const [onlineIds, setOnlineIds] = useState(() => new Set());
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingDraft, setEditingDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteModalMsg, setDeleteModalMsg] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const attachRef = useRef(null);
  const endRef = useRef(null);
  const active = useMemo(() => conversations.find((c) => c.conversation_id === selectedId) || null, [conversations, selectedId]);

  const setConversationParam = useCallback((id) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('conversation', id);
      else next.delete('conversation');
      return next;
    });
  }, [setParams]);

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
    if (!chatAllowed) return undefined;
    refreshConversations();
    markChatDelivered(null);
    touchMyPresence();
    const stopPresence = subscribeOrgPresence(user?.orgId, user?.id, setOnlineIds);
    const timer = setInterval(() => {
      refreshConversations();
      markChatDelivered(null);
      touchMyPresence();
    }, 45000);
    return () => {
      stopPresence();
      clearInterval(timer);
    };
  }, [chatAllowed, refreshConversations, user?.orgId, user?.id]);

  useEffect(() => {
    if (!chatAllowed) return undefined;
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
  }, [chatAllowed, search]);

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
    if (!selectedId || !chatAllowed) return undefined;
    refreshMessages(selectedId);
    const stop = subscribeToChat(selectedId, (incoming, eventType) => {
      const hiddenForMe = Array.isArray(incoming.deleted_for_user_ids) && incoming.deleted_for_user_ids.includes(user?.id);
      if (eventType === 'UPDATE') {
        if (hiddenForMe) {
          setMessages((current) => current.filter((m) => m.id !== incoming.id));
        } else {
          setMessages((current) => current.map((m) => m.id === incoming.id ? { ...m, ...incoming } : m));
        }
      } else if (!hiddenForMe) {
        setMessages((current) => current.some((m) => m.id === incoming.id) ? current : [...current, incoming]);
        if (incoming.sender_id !== user?.id && eventType !== 'POLL') {
          markChatRead(selectedId).then(refreshConversations).catch(() => {});
        }
      }
      if (eventType !== 'POLL') {
        refreshConversations();
      }
    });
    return () => stop();
  }, [selectedId, chatAllowed, user?.id, refreshMessages, refreshConversations]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    if (!chatAllowed || !user?.id) return undefined;
    return subscribeTableWithFallback({
      table: 'chat_conversations',
      event: '*',
      channelName: `chat-list:${user.id}`,
      onChange: refreshConversations,
      onFallback: refreshConversations,
    });
  }, [chatAllowed, user?.id, refreshConversations]);

  if (!loading && !isAuthenticated) return <Navigate to="/login" replace />;
  if (!loading && isSuperAdmin) {
    return (
      <div className="min-h-[60vh] bg-parchment-50 flex flex-col items-center justify-center gap-4 p-6">
        <PageNavBar home={{ to: '/platform', label: tx('لوحة المنصة', 'Super Admin console') }} crumbs={[{ label: tx('لوحة المنصة', 'Super Admin console'), to: '/platform' }, { label: tx('الرسائل', 'Messages') }]} />
        <div className="max-w-md rounded-[14px] border border-sand-border bg-paper-white p-6 text-center space-y-3 shadow-manuscript-sm">
          <Icon name="forum" className="text-[32px] text-emerald-700 mx-auto" aria-hidden />
          <h1 className="font-serif text-xl font-semibold text-ink-green-900">{tx('المراسلة خاصة بكل مؤسسة', 'Messaging is per institution')}</h1>
          <p className="text-sm text-ink-text-secondary">
            {tx('لا يشارك مشرف المنصة في محادثات الكليات. لإرسال إشعار إلى المؤسسات استخدم البث في لوحة المنصة.', 'Platform operators are not part of college conversations. To reach institutions, use the broadcast in the Super Admin console.')}
          </p>
          <Link to="/platform?tab=broadcast" className="inline-flex h-10 items-center px-4 rounded-[10px] bg-emerald-700 text-white text-sm font-semibold">{tx('فتح لوحة المنصة', 'Open Super Admin console')}</Link>
        </div>
      </div>
    );
  }
  if (!loading && !featuresLoading && !messagingEnabled) {
    return (
      <div className="min-h-[60vh] bg-parchment-50 flex flex-col items-center justify-center gap-4 p-6">
        <PageNavBar home={{ to: portalHomeFor(auth), label: tx('بوابتي', 'My portal') }} crumbs={[{ label: tx('بوابتي', 'My portal'), to: portalHomeFor(auth) }, { label: tx('الرسائل', 'Messages') }]} />
        <div className="max-w-md rounded-[14px] border border-sand-border bg-paper-white p-6 text-center space-y-3 shadow-manuscript-sm">
          <Icon name="forum" className="text-[32px] text-emerald-700 mx-auto" aria-hidden />
          <h1 className="font-serif text-xl font-semibold text-ink-green-900">{tx('المراسلة غير مفعّلة حالياً', 'Messaging is currently disabled')}</h1>
          <p className="text-sm text-ink-text-secondary">
            {tx('عطّل مدير المنصة ميزة الرسائل الخاصة لهذه المؤسسة.', 'The platform operator turned off private messaging for this institution.')}
          </p>
          <Link to={portalHomeFor(auth)} className="inline-flex h-10 items-center px-4 rounded-[10px] bg-emerald-700 text-white text-sm font-semibold">{tx('العودة إلى البوابة', 'Back to my portal')}</Link>
        </div>
      </div>
    );
  }
  if (!loading && (!isApproved || isVisitor)) {
    return (
      <div className="min-h-[60vh] bg-parchment-50 flex flex-col items-center justify-center gap-4 p-6">
        <PageNavBar home={{ to: portalHomeFor(auth), label: tx('بوابتي', 'My portal') }} crumbs={[{ label: tx('بوابتي', 'My portal'), to: portalHomeFor(auth) }, { label: tx('الرسائل', 'Messages') }]} />
        <div className="max-w-md rounded-[14px] border border-sand-border bg-paper-white p-6 text-center space-y-3 shadow-manuscript-sm">
          <Icon name="lock" className="text-[32px] text-brass-gold-500 mx-auto" aria-hidden />
          <h1 className="font-serif text-xl font-semibold text-ink-green-900">
            {!isApproved ? tx('الحساب قيد الاعتماد', 'Account pending approval') : tx('المراسلة للطلاب وأولياء الأمور والموظفين', 'Messaging is for campus members')}
          </h1>
          <p className="text-sm text-ink-text-secondary">
            {!isApproved
              ? tx('تتوفر المحادثات الخاصة بعد اعتماد حسابك من إدارة الكلية.', 'Private conversations are available once college administration approves your account.')
              : tx('تتوفر المحادثات الخاصة للطلاب وأولياء الأمور والموظفين المعتمدين.', 'Private conversations are available to approved students, parents, and staff.')}
          </p>
          <Link to={portalHomeFor(auth)} className="inline-flex h-10 items-center px-4 rounded-[10px] bg-emerald-700 text-white text-sm font-semibold">{tx('العودة إلى البوابة', 'Back to my portal')}</Link>
        </div>
      </div>
    );
  }

  const chooseContact = async (contact) => {
    setBusy(true);
    setError('');
    try {
      const id = await openChatConversation(contact.user_id);
      await refreshConversations();
      setConversationParam(id);
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

  const onAttachFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedId || busy) return;
    setBusy(true);
    setError('');
    try {
      const uploaded = await uploadChatAttachment(user?.orgId, selectedId, file);
      await sendChatMessage(selectedId, draft.trim() || file.name, uploaded);
      setDraft('');
      await refreshMessages(selectedId);
    } catch (err) {
      setError(err.message || tx('تعذر إرفاق الملف', 'Could not send attachment'));
    } finally {
      setBusy(false);
    }
  };

  const selectConversation = (id) => {
    setConversationParam(id);
    setMobileListOpen(false);
    setEditingMessageId(null);
    setEditingDraft('');
  };

  const startEdit = (msg) => {
    setEditingMessageId(msg.id);
    setEditingDraft(msg.body || msg.attachment_name || '');
    setError('');
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingDraft('');
  };

  const saveEdit = async (e) => {
    e?.preventDefault();
    const trimmed = editingDraft.trim();
    if (!editingMessageId || !trimmed || savingEdit) return;
    setSavingEdit(true);
    setError('');
    try {
      const updated = await editChatMessage(editingMessageId, trimmed);
      setMessages((current) => current.map((m) => m.id === editingMessageId ? { ...m, ...updated } : m));
      setEditingMessageId(null);
      setEditingDraft('');
      refreshConversations();
    } catch (err) {
      const msg = err.message || tx('تعذر تعديل الرسالة', 'Could not edit message');
      setError(msg);
      toast.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDeleteForMe = async () => {
    if (!deleteModalMsg || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await deleteChatMessageForMe(deleteModalMsg.id);
      setMessages((current) => current.filter((m) => m.id !== deleteModalMsg.id));
      if (editingMessageId === deleteModalMsg.id) cancelEdit();
      setDeleteModalMsg(null);
      refreshConversations();
    } catch (err) {
      const msg = err.message || tx('تعذر حذف الرسالة', 'Could not delete message');
      setError(msg);
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteForEveryone = async () => {
    if (!deleteModalMsg || deleting) return;
    setDeleting(true);
    setError('');
    try {
      const updated = await deleteChatMessageForEveryone(deleteModalMsg.id);
      setMessages((current) => current.map((m) => m.id === deleteModalMsg.id ? { ...m, ...updated } : m));
      if (editingMessageId === deleteModalMsg.id) cancelEdit();
      setDeleteModalMsg(null);
      refreshConversations();
    } catch (err) {
      const msg = err.message || tx('تعذر حذف الرسالة للجميع', 'Could not delete message for everyone');
      setError(msg);
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const otherOnline = active ? onlineIds.has(active.other_user_id) : false;

  const chatShell = (
    <section className={`${embedded ? 'flex h-[calc(100vh-14rem)] min-h-[500px]' : 'mx-auto flex h-[calc(100vh-9rem)] min-h-[520px] max-w-7xl'} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm`}>
      <aside className={`${mobileListOpen ? 'flex' : 'hidden'} w-full shrink-0 flex-col border-e border-slate-200 bg-slate-50/60 md:flex md:w-[330px]`}>
        <header className="border-b border-slate-200 bg-white px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-bold text-[#0B3B2E]">{tx('الرسائل', 'Messages')}</div>
              <div className="text-[11px] text-slate-500">{tx('محادثات خاصة داخل بوابة الكلية', 'Private conversations in the college app')}</div>
            </div>
            <Icon name="forum" className="text-2xl text-[#11694A]" />
          </div>
        </header>
        <div className="p-3 border-b border-slate-200/70 bg-white">
          <label className="sr-only" htmlFor="chat-search">{tx('ابحث عن مستخدم', 'Find a user')}</label>
          <input id="chat-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={(isParent || isStudent) ? tx('ابحث عن إدارة أو مدرّس أو موظف…', 'Find admin, tutor, or staff…') : tx('ابحث عن طالب أو ولي أمر أو موظف…', 'Find a student, parent, or staff…')} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#11694A] focus:bg-white" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {search.trim() ? (
            <>
              <div className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{tx('مستخدمون', 'People')}</div>
              {contacts.map((person) => (
                <button key={person.user_id} type="button" disabled={busy} onClick={() => chooseContact(person)} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-white disabled:opacity-50">
                  <Avatar name={person.full_name} online={onlineIds.has(person.user_id)} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm text-[#0B3B2E]">{person.full_name}</b>
                    <small className="text-xs text-slate-500">
                      {roleName(person.account_type, person.role, person.assigned_tutor_role)}
                      {person.class_number ? ` · ${tx('الصف', 'Class')} ${person.class_number}` : ''}
                      {onlineIds.has(person.user_id) ? ` · ${tx('متصل', 'Online')}` : ''}
                    </small>
                  </span>
                </button>
              ))}
              {!contacts.length && <p className="px-4 py-6 text-center text-xs text-slate-500">{tx('لا يوجد مستخدمون مطابقون', 'No matching people')}</p>}
            </>
          ) : (
            <>
              <div className="px-4 pb-2 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{tx('المحادثات', 'Chats')}</div>
              {conversations.map((c) => {
                const isOnline = onlineIds.has(c.other_user_id);
                return (
                  <button key={c.conversation_id} type="button" onClick={() => selectConversation(c.conversation_id)} className={`flex w-full items-center gap-3 border-b border-slate-200/70 px-4 py-3 text-start hover:bg-white ${selectedId === c.conversation_id ? 'bg-white' : ''}`}>
                    <Avatar name={c.other_user_name} online={isOnline} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <b className="truncate text-sm text-[#0B3B2E]">{c.other_user_name}</b>
                        <small className="shrink-0 text-[10px] text-slate-500">{dateLabel(c.last_message_at)}</small>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <small className="truncate text-xs text-slate-500">
                          {c.last_message === 'This message was deleted'
                            ? tx('تم حذف هذه الرسالة', 'This message was deleted')
                            : (c.last_message || roleName(c.other_account_type, c.other_role, c.other_assigned_tutor_role))}
                        </small>
                        {Number(c.unread_count) > 0 && <b className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#11694A] px-1 text-[10px] text-white">{c.unread_count}</b>}
                      </span>
                    </span>
                  </button>
                );
              })}
              {!loadingList && !conversations.length && <p className="px-5 py-8 text-center text-sm text-slate-500">{tx('لا توجد محادثات بعد. ابحث عن شخص لبدء محادثة.', 'No conversations yet. Search for someone to start one.')}</p>}
              {loadingList && <p className="px-4 py-6 text-center text-xs text-slate-500">{tx('جارٍ التحميل…', 'Loading…')}</p>}
            </>
          )}
        </div>
        <footer className="border-t border-slate-200 bg-white px-4 py-2 text-[10px] text-slate-500">{tx('تُحفظ الرسائل داخل التطبيق. قد تصل تنبيهات واتساب عند تفعيلها.', 'Messages stay in the app. WhatsApp alerts may be sent when enabled.')}</footer>
      </aside>

      <section className={`${mobileListOpen ? 'hidden' : 'flex'} min-w-0 flex-1 flex-col md:flex`}>
        {active ? (
          <>
            <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
              <button type="button" aria-label={tx('المحادثات', 'Chats')} onClick={() => setMobileListOpen(true)} className="rounded-lg p-1 text-[#11694A] md:hidden"><Icon name="arrow_back" className="text-lg rtl:rotate-180" /></button>
              <Avatar name={active.other_user_name} online={otherOnline} />
              <div className="min-w-0">
                <b className="block truncate text-sm text-[#0B3B2E]">{active.other_user_name}</b>
                <small className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>{roleName(active.other_account_type, active.other_role, active.other_assigned_tutor_role)}</span>
                  <span>·</span>
                  <span className={otherOnline ? 'font-semibold text-emerald-700' : 'text-slate-400'}>
                    {otherOnline ? tx('متصل الآن', 'Online') : tx('غير متصل', 'Offline')}
                  </span>
                </small>
              </div>
              <span className="ms-auto text-xs text-slate-500">{tx('رسائل مباشرة', 'Direct messages')}</span>
            </header>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-[#F8FAFC] px-3 py-4 sm:px-8">
              {loadingMessages && <div className="text-center text-xs text-slate-500">{tx('جارٍ تحميل الرسائل…', 'Loading messages…')}</div>}
              {!loadingMessages && messages.length === 0 && <div className="m-auto max-w-xs rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center text-sm text-slate-500">{tx('ابدأ المحادثة برسالة خاصة إلى', 'Start a private conversation with')} {active.other_user_name}.</div>}
              {messages.map((m) => {
                const mine = m.sender_id === user?.id;
                const isDeletedForAll = Boolean(m.deleted_for_everyone_at);
                const isEditing = editingMessageId === m.id;
                return (
                  <div key={m.id} className={`group flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                    {mine && !isEditing && (
                      <div className="flex items-center gap-1 opacity-80 sm:opacity-45 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        {!isDeletedForAll && (
                          <button
                            type="button"
                            onClick={() => startEdit(m)}
                            title={tx('تعديل الرسالة', 'Edit message')}
                            aria-label={tx('تعديل الرسالة', 'Edit message')}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-slate-50 hover:text-[#0B3B2E]"
                          >
                            <Icon name="edit" className="text-[14px]" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteModalMsg(m)}
                          title={tx('حذف الرسالة', 'Delete message')}
                          aria-label={tx('حذف الرسالة', 'Delete message')}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-red-50 hover:text-red-700"
                        >
                          <Icon name="delete" className="text-[14px]" />
                        </button>
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 shadow-xs sm:max-w-[70%] ${mine ? 'rounded-br-sm bg-[#E3F1EA] text-[#0B3B2E] border border-[#11694A]/15' : 'rounded-bl-sm bg-white text-slate-800 border border-slate-200'}`}>
                      {isDeletedForAll ? (
                        <p className="flex items-center gap-1.5 text-xs italic text-slate-500">
                          <Icon name="delete" className="text-[14px] text-slate-400" />
                          <span>{tx('تم حذف هذه الرسالة', 'This message was deleted')}</span>
                        </p>
                      ) : (
                        <>
                          {m.attachment_url && <AttachmentPreview msg={m} />}
                          {isEditing ? (
                            <form onSubmit={saveEdit} className="mt-1 space-y-2 min-w-[220px]">
                              <textarea
                                value={editingDraft}
                                onChange={(e) => setEditingDraft(e.target.value.slice(0, 4000))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    saveEdit();
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    cancelEdit();
                                  }
                                }}
                                rows={2}
                                autoFocus
                                maxLength={4000}
                                className="w-full rounded-xl border border-[#11694A]/40 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#11694A]"
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={savingEdit}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                  {tx('إلغاء', 'Cancel')}
                                </button>
                                <button
                                  type="submit"
                                  disabled={savingEdit || !editingDraft.trim()}
                                  className="rounded-lg bg-[#11694A] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0B3B2E] disabled:opacity-40"
                                >
                                  {savingEdit ? tx('جارٍ الحفظ…', 'Saving…') : tx('حفظ', 'Save')}
                                </button>
                              </div>
                            </form>
                          ) : (
                            m.body && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p>
                          )}
                        </>
                      )}
                      <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-slate-500">
                        {m.edited_at && !isDeletedForAll && (
                          <span className="italic text-slate-500">{tx('تم التعديل', 'Edited')}</span>
                        )}
                        <span>{timeLabel(m.created_at)}</span>
                        {mine && !isDeletedForAll && <MessageReceipt msg={m} />}
                      </div>
                    </div>
                    {!mine && !isEditing && (
                      <button
                        type="button"
                        onClick={() => setDeleteModalMsg(m)}
                        title={tx('حذف لي', 'Delete for me')}
                        aria-label={tx('حذف لي', 'Delete for me')}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 opacity-80 sm:opacity-45 sm:group-hover:opacity-100 focus:opacity-100 shadow-xs hover:bg-red-50 hover:text-red-700 transition-opacity"
                      >
                        <Icon name="delete" className="text-[14px]" />
                      </button>
                    )}
                  </div>
                );
              })}
              {hasOlder && (
                <button
                  type="button"
                  onClick={async () => {
                    const before = messages[0]?.created_at;
                    if (!before) return;
                    try {
                      const page = await listOlderChatMessages(selectedId, before, 100);
                      setMessages((current) => [...page, ...current]);
                      setHasOlder(page.length === 100);
                    } catch (pageError) {
                      setError(pageError.message || tx('تعذر تحميل المحادثة', 'Could not load conversation'));
                    }
                  }}
                  className="self-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-[#11694A] shadow-xs"
                >
                  {tx('تحميل رسائل أقدم', 'Load older messages')}
                </button>
              )}
              <div ref={endRef} />
            </div>
            <form onSubmit={submit} className="flex items-end gap-2 border-t border-slate-200 bg-white p-3 sm:p-4">
              <input ref={attachRef} type="file" accept="image/*,application/pdf,.doc,.docx" className="hidden" onChange={onAttachFile} />
              <button
                type="button"
                disabled={busy}
                onClick={() => attachRef.current?.click()}
                className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 text-xs font-semibold text-[#0B3B2E] shadow-xs hover:border-[#11694A] hover:bg-slate-50 disabled:opacity-40"
                title={tx('إرفاق صورة أو ملف PDF', 'Attach photo or PDF')}
                aria-label={tx('إرفاق صورة أو ملف PDF', 'Attach photo or PDF')}
              >
                <Icon name="attach_file" className="text-[18px] text-[#11694A]" />
                <span className="hidden sm:inline">{tx('إرفاق', 'Attach')}</span>
              </button>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 4000))} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} rows={1} maxLength={4000} placeholder={tx('اكتب رسالة…', 'Type a message…')} className="max-h-32 min-h-11 flex-1 resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-[#11694A] focus:bg-white" />
              <button type="submit" disabled={busy || !draft.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#11694A] text-white shadow-sm hover:bg-[#0B3B2E] disabled:cursor-not-allowed disabled:opacity-40" aria-label={tx('إرسال', 'Send')}><Icon name="send" className="text-lg" /></button>
            </form>
          </>
        ) : (
          <div className="hidden flex-1 flex-col items-center justify-center bg-[#F8FAFC] px-8 text-center md:flex"><Icon name="forum" className="text-6xl text-[#11694A]/40 mb-2" /><h1 className="mt-2 text-xl font-bold text-[#0B3B2E]">{tx('رسائل الكلية', 'College messages')}</h1><p className="mt-2 max-w-md text-sm text-slate-500">{(isParent || isStudent) ? tx('اختر محادثة أو ابحث عن إدارة الكلية أو مدرّس لبدء مراسلة خاصة.', 'Choose a chat or search for college admin or a tutor to start a private conversation.') : tx('اختر محادثة أو ابحث عن طالب أو ولي أمر أو موظف لبدء مراسلة خاصة وآمنة.', 'Choose a chat or search for a student, parent, or staff member to start a private conversation.')}</p></div>
        )}
      </section>
      {deleteModalMsg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          onClick={() => !deleting && setDeleteModalMsg(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-base font-bold text-[#0B3B2E]">{tx('حذف الرسالة', 'Delete message')}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {tx('اختر كيف تريد حذف هذه الرسالة:', 'Choose how you want to delete this message:')}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {deleteModalMsg.sender_id === user?.id && !deleteModalMsg.deleted_for_everyone_at && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={confirmDeleteForEveryone}
                  className="w-full rounded-xl bg-[#B3261E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                >
                  {tx('حذف للجميع', 'Delete for everyone')}
                </button>
              )}
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteForMe}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
              >
                {tx('حذف لي فقط', 'Delete for me')}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteModalMsg(null)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {tx('إلغاء', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        {chatShell}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</div>}
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] px-2 py-3 sm:p-6">
      <PageNavBar
        className="mx-auto max-w-7xl mb-3"
        home={{ to: portalHomeFor(auth), label: tx('بوابتي', 'My portal') }}
        crumbs={[{ label: tx('بوابتي', 'My portal'), to: portalHomeFor(auth) }, { label: tx('الرسائل', 'Messages') }]}
      />
      {chatShell}
      {error && <div role="alert" className="mx-auto mt-3 max-w-7xl rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</div>}
    </main>
  );
}

function MessageReceipt({ msg }) {
  if (msg.read_at) {
    return (
      <span className="inline-flex items-center gap-0.5 ms-1" title={tx('تمت القراءة', 'Seen')}>
        <Icon name="done_all" className="text-[14px] text-sky-600" />
        <Icon name="visibility" className="text-[12px] text-emerald-700" />
      </span>
    );
  }
  if (msg.delivered_at) {
    return <Icon name="done_all" className="text-[14px] ms-1 text-slate-400" title={tx('تم التسليم', 'Delivered')} />;
  }
  return <Icon name="done" className="text-[14px] ms-1 text-slate-400" title={tx('تم الإرسال', 'Sent')} />;
}

function AttachmentPreview({ msg }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let live = true;
    getChatAttachmentUrl(msg.attachment_url).then((u) => live && setUrl(u));
    return () => { live = false; };
  }, [msg.attachment_url]);

  if (!url) return null;
  const isImg = String(msg.attachment_type || '').startsWith('image/');
  if (isImg) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block mb-1.5 overflow-hidden rounded-xl border border-slate-200/80 bg-white">
        <img src={url} alt={msg.attachment_name || 'Attachment'} className="max-h-60 w-auto object-contain" />
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mb-1.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#0B3B2E] hover:bg-slate-50"
    >
      <Icon name="description" className="text-[18px] text-[#11694A]" />
      <span className="truncate max-w-[200px]">{msg.attachment_name || tx('مرفق', 'Attachment')}</span>
    </a>
  );
}

function Avatar({ name, online = false }) {
  return (
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#DCEBE2] font-bold text-[#11694A]">
      {(name || '?').trim().slice(0, 1).toUpperCase()}
      <span
        className={`absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full ring-2 ring-white ${online ? 'bg-emerald-500' : 'bg-slate-300'}`}
        aria-hidden="true"
      />
    </span>
  );
}

function roleName(type, role, assignedTutorRole) {
  if (role === 'admin') return tx('إدارة الكلية', 'College Admin');
  if (role === 'librarian') return tx('أمين المكتبة', 'Librarian');
  const dutyLabels = {
    principal: tx('المدير', 'Principal'),
    vice_principal: tx('نائب المدير', 'Vice Principal'),
    treasurer: tx('أمين الصندوق', 'Treasurer'),
    accountant: tx('المحاسب', 'Accountant'),
    hr_manager: tx('الموارد البشرية', 'HR Manager'),
    admissions_officer: tx('مسؤول القبول', 'Admissions Officer'),
    warden: tx('مشرف السكن', 'Warden'),
    counselor: tx('المرشد', 'Counselor'),
    exam_officer: tx('مسؤول الامتحانات', 'Exam Officer'),
    it_officer: tx('مسؤول التقنية', 'IT Officer'),
    librarian: tx('أمين المكتبة', 'Librarian'),
  };
  if (assignedTutorRole && assignedTutorRole !== 'none' && dutyLabels[assignedTutorRole]) {
    return dutyLabels[assignedTutorRole];
  }
  return ({ student: tx('طالب', 'Student'), parent: tx('ولي أمر', 'Parent'), tutor: tx('مدرس', 'Tutor'), staff: tx('موظف', 'Staff') })[type] || tx('مستخدم', 'User');
}
