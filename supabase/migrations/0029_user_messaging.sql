-- Secure direct messaging, per-user unread/read state, and a reliable outbound
-- notification queue. Message content stays in-app; WhatsApp gets a private
-- notification teaser only when the recipient opted in.

set search_path = public, extensions, pg_temp;

create table if not exists public.chat_conversations (
  id uuid primary key default extensions.gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  participant_low uuid not null references public.profiles(id) on delete cascade,
  participant_high uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  check (participant_low < participant_high),
  unique (org_id, participant_low, participant_high)
);

create table if not exists public.chat_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_conversations replica identity full;
alter table public.chat_messages replica identity full;
grant select on public.chat_conversations, public.chat_messages to authenticated;
revoke insert, update, delete on public.chat_conversations, public.chat_messages from anon, authenticated;

create index if not exists idx_chat_conversations_low_recent
  on public.chat_conversations (participant_low, last_message_at desc nulls last);
create index if not exists idx_chat_conversations_high_recent
  on public.chat_conversations (participant_high, last_message_at desc nulls last);
create index if not exists idx_chat_messages_conversation_recent
  on public.chat_messages (conversation_id, created_at desc);
create index if not exists idx_chat_messages_unread
  on public.chat_messages (conversation_id, created_at desc) where read_at is null;
create index if not exists idx_message_outbox_org_queue
  on public.message_outbox (org_id, created_at) where status in ('pending', 'blocked', 'sending');
create index if not exists idx_message_outbox_chat_link
  on public.message_outbox ((coalesce(metadata ->> 'message_id', metadata -> 'data' ->> 'message_id')))
  where channel in ('whatsapp', 'push') and status = 'pending';
create index if not exists idx_profiles_org_name_trgm
  on public.profiles using gin (lower(full_name) extensions.gin_trgm_ops);

do $$
begin
  if not exists (select 1 from pg_class where relname = 'profiles_org_id_id_uidx' and relkind = 'i') then
    create unique index profiles_org_id_id_uidx on public.profiles (org_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chat_conversations_participants_org_fk') then
    alter table public.chat_conversations add constraint chat_conversations_participants_org_fk
      foreign key (org_id, participant_low) references public.profiles (org_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chat_conversations_participants_high_org_fk') then
    alter table public.chat_conversations add constraint chat_conversations_participants_high_org_fk
      foreign key (org_id, participant_high) references public.profiles (org_id, id) on delete cascade;
  end if;
end $$;

-- The latest schemas layer MFA restrictively onto every RLS table, including
-- tables created by this migration.
create or replace function public.chat_can_contact(p_other uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  me record;
  other_user record;
begin
  if auth.uid() is null or p_other is null or p_other = auth.uid() or not public.mfa_ok() then
    return false;
  end if;
  select id, org_id, account_type, is_approved into me
  from public.profiles where id = auth.uid();
  select id, org_id, account_type, is_approved, role into other_user
  from public.profiles where id = p_other;
  if not found or not coalesce(me.is_approved, false) or not coalesce(other_user.is_approved, false)
     or me.org_id is distinct from other_user.org_id then
    return false;
  end if;
  if me.account_type = 'parent' and not exists (
    select 1 from public.parent_children pc where pc.parent_id = auth.uid()
  ) then return false; end if;
  if public.is_employee() then
    if public.is_super_admin() then
      return false;
    end if;
    if public.is_admin() then
      return other_user.role <> 'super_admin';
    end if;
    if public.is_tutor() and not public.is_admin() then
      if other_user.account_type = 'student' then
        return public.tutor_can_teach_student(p_other);
      elsif other_user.account_type = 'parent' then
        return exists (
          select 1 from public.parent_children pc
          where pc.parent_id = p_other and public.tutor_can_teach_student(pc.child_id)
        );
      end if;
    end if;
    return other_user.role = 'admin'
      or other_user.account_type in ('student', 'parent', 'tutor', 'staff');
  end if;
  return me.account_type in ('student', 'parent')
    and (other_user.role = 'admin' or other_user.account_type in ('tutor', 'staff'));
end;
$$;
revoke all on function public.chat_can_contact(uuid) from public, anon, authenticated;

create or replace function public.chat_is_member(p_conversation uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.chat_conversations c
    join public.profiles p on p.id = auth.uid() and p.org_id = c.org_id and p.is_approved
    where c.id = p_conversation and auth.uid() in (c.participant_low, c.participant_high)
  );
$$;
revoke all on function public.chat_is_member(uuid) from public, anon, authenticated;
grant execute on function public.chat_is_member(uuid) to authenticated;

drop policy if exists "chat conversations participants read" on public.chat_conversations;
create policy "chat conversations participants read" on public.chat_conversations
  for select to authenticated using (public.chat_is_member(id));
drop policy if exists "chat messages participants read" on public.chat_messages;
create policy "chat messages participants read" on public.chat_messages
  for select to authenticated using (public.chat_is_member(conversation_id));

select public.apply_mfa_policy('public.chat_conversations'::regclass);
select public.apply_mfa_policy('public.chat_messages'::regclass);

-- Search names within the caller's own institution, not the public profile
-- directory. Tutor-specific student/parent checks remain enforced at send.
drop policy if exists "profiles: org directory" on public.profiles;
create policy "profiles: org directory"
  on public.profiles for select to authenticated
  using (org_id = public.current_org_id() and is_approved);

drop trigger if exists trg_chat_message_org on public.chat_messages;
create trigger trg_chat_message_org before insert on public.chat_messages
  for each row execute function public.tg_set_org_id();

create or replace function public.tg_chat_message_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  if tg_op = 'UPDATE' then
    if (new.id, new.org_id, new.conversation_id, new.sender_id, new.body, new.created_at)
       is distinct from (old.id, old.org_id, old.conversation_id, old.sender_id, old.body, old.created_at)
       or new.read_at is null then
      raise exception 'Only the recipient may mark a message as read' using errcode = '42501';
    end if;
    select * into c from public.chat_conversations where id = old.conversation_id;
    if auth.uid() not in (c.participant_low, c.participant_high) or auth.uid() = old.sender_id then
      raise exception 'Only the recipient may mark a message as read' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.tg_chat_message_guard() from public, anon, authenticated;
drop trigger if exists trg_chat_message_guard on public.chat_messages;
create trigger trg_chat_message_guard before update on public.chat_messages
  for each row execute function public.tg_chat_message_guard();

-- Push is also an opt-in channel. Notifications always remain visible in-app.
create or replace function public.tg_notifications_push()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.user_id and p.org_id = new.org_id and p.notify_push
  ) then
    return null;
  end if;
  insert into public.message_outbox (user_id, channel, to_address, subject, body, metadata, org_id)
  select new.user_id, 'push', d.token, new.title, left(new.message, 900),
         jsonb_build_object('type', 'notification', 'notification_id', new.id, 'link', new.link,
                            'data', coalesce(new.data, '{}'::jsonb)), new.org_id
  from public.device_push_tokens d
  where d.user_id = new.user_id;
  return null;
end;
$$;

drop trigger if exists trg_notifications_push on public.notifications;
create trigger trg_notifications_push after insert on public.notifications
  for each row execute function public.tg_notifications_push();

create or replace function public.search_chat_contacts(p_search text default '')
returns table (user_id uuid, full_name text, account_type text, class_number int)
language plpgsql stable security definer set search_path = public as $$
declare
  me record;
  needle text := btrim(coalesce(p_search, ''));
  staff_caller boolean;
begin
  if auth.uid() is null or not public.mfa_ok() then
    raise exception 'Sign-in required' using errcode = '42501';
  end if;
  select id, org_id, account_type, is_approved into me
  from public.profiles where id = auth.uid();
  if not found or not me.is_approved then
    raise exception 'An approved account is required' using errcode = '42501';
  end if;
  staff_caller := public.is_employee();
  if not staff_caller and me.account_type not in ('student', 'parent') then
    raise exception 'Messaging is not enabled for this account' using errcode = '42501';
  end if;
  if staff_caller and public.is_super_admin() then
    raise exception 'Institution messaging is unavailable to super admins' using errcode = '42501';
  end if;
  if not staff_caller and me.account_type = 'parent' and not exists (
    select 1 from public.parent_children pc where pc.parent_id = auth.uid()
  ) then
    raise exception 'Link a student before using messages' using errcode = '42501';
  end if;
  return query
  select p.id, p.full_name, p.account_type, p.class_number
  from public.profiles p
  where p.org_id = me.org_id and p.id <> auth.uid() and p.is_approved
    and (p.role = 'admin' or p.account_type in ('student', 'parent', 'tutor', 'staff'))
    and (staff_caller or p.role = 'admin' or p.account_type in ('tutor', 'staff'))
    and (needle = '' or lower(p.full_name) like '%' || lower(needle) || '%')
    and public.chat_can_contact(p.id)
  order by p.full_name, p.id
  limit 30;
end;
$$;

create or replace function public.open_chat_conversation(p_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me_org uuid;
  v_low uuid;
  v_high uuid;
  v_id uuid;
begin
  if not public.chat_can_contact(p_other) then
    raise exception 'You cannot start a conversation with this user' using errcode = '42501';
  end if;
  select org_id into me_org from public.profiles where id = auth.uid();
  v_low := least(auth.uid(), p_other);
  v_high := greatest(auth.uid(), p_other);
  insert into public.chat_conversations (org_id, participant_low, participant_high)
  values (me_org, v_low, v_high)
  on conflict (org_id, participant_low, participant_high)
    do update set updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.my_chat_conversations()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_user_name text,
  other_account_type text,
  last_message_at timestamptz,
  last_message text,
  unread_count bigint
)
language sql stable security definer set search_path = public as $$
  select c.id,
         p.id,
         p.full_name,
         p.account_type,
         c.last_message_at,
         latest.body,
         (select count(*) from public.chat_messages unread
          where unread.conversation_id = c.id and unread.sender_id <> auth.uid() and unread.read_at is null)
  from public.chat_conversations c
  join public.profiles p on p.id = case when c.participant_low = auth.uid() then c.participant_high else c.participant_low end
  left join lateral (
    select m.body from public.chat_messages m
    where m.conversation_id = c.id order by m.created_at desc limit 1
  ) latest on true
  where public.mfa_ok()
    and auth.uid() in (c.participant_low, c.participant_high)
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_approved and me.org_id = c.org_id)
    and public.chat_can_contact(p.id)
  order by c.last_message_at desc nulls last, c.created_at desc
  limit 100;
$$;

create or replace function public.chat_messages_page(p_conversation uuid, p_before timestamptz default null, p_limit int default 100)
returns setof public.chat_messages language plpgsql stable security definer set search_path = public as $$
begin
  if not public.chat_is_member(p_conversation) then
    raise exception 'Conversation not found' using errcode = '42501';
  end if;
  return query
    select m.* from public.chat_messages m
    where m.conversation_id = p_conversation
      and (p_before is null or m.created_at < p_before)
    order by m.created_at desc limit greatest(1, least(coalesce(p_limit, 100), 100));
end;
$$;

create or replace function public.send_chat_message(p_conversation uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c record;
  recipient record;
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
  sender_name text;
  sender record;
begin
  if not public.chat_is_member(p_conversation) then
    raise exception 'Conversation not found' using errcode = '42501';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 4000 then
    raise exception 'Message must contain 1 to 4000 characters';
  end if;
  select * into c from public.chat_conversations where id = p_conversation for update;
  select id, org_id, account_type, is_approved, role
    into sender from public.profiles where id = auth.uid();
  select * into recipient from public.profiles
   where id = case when c.participant_low = auth.uid() then c.participant_high else c.participant_low end;
  if not public.chat_can_contact(recipient.id) or sender.org_id is distinct from c.org_id
     or not sender.is_approved or not recipient.is_approved then
    raise exception 'You cannot message this user' using errcode = '42501';
  end if;
  insert into public.chat_messages (org_id, conversation_id, sender_id, body)
  values (c.org_id, c.id, auth.uid(), v_body) returning id into v_id;
  update public.chat_conversations set last_message_at = now(), updated_at = now() where id = c.id;
  select full_name into sender_name from public.profiles where id = auth.uid();
  insert into public.notifications (user_id, title, message, data, link, org_id)
  values (recipient.id, 'New message', left(coalesce(sender_name, 'College user') || ' sent you a private message.', 900),
          jsonb_build_object('conversation_id', c.id, 'message_id', v_id), '/messages?conversation=' || c.id::text, c.org_id);
  insert into public.message_outbox (org_id, user_id, channel, to_address, subject, body, metadata)
  select c.org_id, recipient.id, 'whatsapp', recipient.phone, 'New message',
         'You have a new private message from ' || coalesce(sender_name, 'College user') || '. Open the college app to read and reply.',
         jsonb_build_object('type', 'chat_message', 'conversation_id', c.id, 'message_id', v_id)
  where recipient.notify_whatsapp and coalesce(trim(recipient.phone), '') <> '';
  return v_id;
end;
$$;

create or replace function public.assert_can_notify()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if public.is_privileged_caller() or public.is_employee() then return; end if;
  raise exception 'forbidden' using errcode = '42501';
end;
$$;

create or replace function public.mark_chat_read(p_conversation uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  changed integer;
begin
  if not public.chat_is_member(p_conversation) then raise exception 'Conversation not found' using errcode = '42501'; end if;
  update public.chat_messages set read_at = now()
    where conversation_id = p_conversation and sender_id <> auth.uid() and read_at is null;
  get diagnostics changed = row_count;
  update public.notifications set is_read = true
    where user_id = auth.uid() and data ->> 'conversation_id' = p_conversation::text and not is_read;
  return changed;
end;
$$;

create or replace function public.claim_chat_outbox(p_message_id uuid, p_sender_id uuid)
returns setof public.message_outbox language plpgsql security definer set search_path = public as $$
begin
  if p_sender_id is null or p_sender_id <> auth.uid() or not public.mfa_ok() then
    raise exception 'A verified sender is required' using errcode = '42501';
  end if;
  return query
  update public.message_outbox o
  set status = 'sending', claimed_at = now(), attempts = attempts + 1
  from public.chat_messages m
  join public.chat_conversations c on c.id = m.conversation_id
  where m.id = p_message_id and m.sender_id = p_sender_id
    and p_sender_id in (c.participant_low, c.participant_high)
    and o.channel in ('whatsapp', 'push') and o.status = 'pending'
    and o.attempts < 5
    and o.user_id = case when c.participant_low = p_sender_id then c.participant_high else c.participant_low end
    and (o.metadata ->> 'message_id' = m.id::text or o.metadata -> 'data' ->> 'message_id' = m.id::text)
  returning o.*;
end;
$$;
revoke all on function public.claim_chat_outbox(uuid, uuid) from public, anon;
grant execute on function public.claim_chat_outbox(uuid, uuid) to authenticated, service_role;

-- Broadcast through small tenant-scoped pages so 3k+ recipients do not exceed
-- the per-request API/statement budget or PostgREST's response row cap.
-- A stable id plus this partial key makes page retries safe after a client
-- timeout that happened after the database committed the original request.
create unique index if not exists idx_notifications_broadcast_once
  on public.notifications (user_id, (data ->> 'broadcast_id'))
  where data ->> 'type' = 'broadcast' and data ? 'broadcast_id';

-- Database sessions use only the app's approved profile channel selections;
-- the browser cannot opt itself into a provider by setting this request flag.
alter table public.profiles add column if not exists notify_broadcast_channels boolean not null default false;

create or replace function public.send_notification_broadcast(
  p_broadcast_id uuid,
  p_title text,
  p_message text,
  p_target text default 'all',
  p_after uuid default null,
  p_limit int default 150
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_sent int := 0;
  v_last uuid := p_after;
  v_more boolean := false;
  v_limit int := greatest(1, least(coalesce(p_limit, 150), 200));
  v_target text := coalesce(p_target, 'all');
begin
  if not public.is_admin() or public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if auth.uid() is null or not public.mfa_ok() then
    raise exception 'Sign-in and MFA required' using errcode = '42501';
  end if;
  if v_org is null then raise exception 'Institution not found'; end if;
  if v_target not in ('all', 'students', 'parents', 'tutors') then
    raise exception 'Invalid broadcast audience';
  end if;
  if p_broadcast_id is null then raise exception 'Broadcast id is required'; end if;
  if exists (select 1 from public.notifications n
    where n.user_id = auth.uid() and n.data ->> 'broadcast_id' = p_broadcast_id::text
      and (n.title is distinct from btrim(p_title) or n.message is distinct from btrim(p_message))) then
    raise exception 'Broadcast id is already used for another message';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 160
     or char_length(btrim(coalesce(p_message, ''))) not between 1 and 2000 then
    raise exception 'Title and message are required (maximum 160 / 2000 characters)';
  end if;

  with page as (
    select p.id, p.org_id from public.profiles p
    where p.org_id = v_org and p.is_approved
      and (p_after is null or p.id > p_after)
      and (v_target = 'all'
        or (v_target = 'students' and p.account_type = 'student')
        or (v_target = 'parents' and p.account_type = 'parent')
        or (v_target = 'tutors' and p.account_type = 'tutor'))
    order by p.id limit v_limit
  ), inserted as (
    insert into public.notifications (user_id, title, message, data, link, org_id)
    select page.id, btrim(p_title), btrim(p_message),
           jsonb_build_object('type', 'broadcast', 'external_channels', true, 'broadcast_id', p_broadcast_id),
           '/notifications', page.org_id
    from page
    on conflict do nothing
    returning user_id
  )
  select (select count(*)::int from inserted),
         (select page.id from page order by page.id desc limit 1)
    into v_sent, v_last;

  if v_last is null then v_last := p_after; end if;
  select exists (
    select 1 from public.profiles p
    where p.org_id = v_org and p.is_approved
      and (v_last is null or p.id > v_last)
      and (v_target = 'all'
        or (v_target = 'students' and p.account_type = 'student')
        or (v_target = 'parents' and p.account_type = 'parent')
        or (v_target = 'tutors' and p.account_type = 'tutor'))
  ) into v_more;
  return jsonb_build_object('sent', v_sent, 'next_after', v_last, 'has_more', v_more);
end;
$$;

create or replace function public.tg_notification_broadcast_outbox()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.data ->> 'external_channels' = 'true' then
    insert into public.message_outbox (user_id, channel, to_address, subject, body, metadata, org_id)
    select p.id, pref.channel, pref.address, new.title, new.message,
           jsonb_build_object('type', 'broadcast', 'notification_id', new.id, 'link', new.link), new.org_id
    from public.profiles p
    cross join lateral (
      select 'sms'::text channel, p.phone address where p.notify_sms and trim(coalesce(p.phone, '')) <> ''
      union all select 'whatsapp', p.phone where p.notify_whatsapp and trim(coalesce(p.phone, '')) <> ''
      union all select 'email', p.email where p.notify_email and trim(coalesce(p.email, '')) <> ''
    ) pref
    where p.id = new.user_id and p.org_id = new.org_id and p.notify_broadcast_channels;
  end if;
  return null;
end;
$$;
drop trigger if exists trg_notification_broadcast_outbox on public.notifications;
create trigger trg_notification_broadcast_outbox after insert on public.notifications
  for each row execute function public.tg_notification_broadcast_outbox();

create or replace function public.update_my_notification_preferences(
  p_sms boolean, p_whatsapp boolean, p_email boolean, p_push boolean,
  p_broadcast_channels boolean default false
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.mfa_ok() then
    raise exception 'Sign-in required' using errcode = '42501';
  end if;
  update public.profiles set notify_sms = coalesce(p_sms, false),
    notify_whatsapp = coalesce(p_whatsapp, false), notify_email = coalesce(p_email, false),
    notify_push = coalesce(p_push, false), notify_broadcast_channels = coalesce(p_broadcast_channels, false)
  where id = auth.uid();
end;
$$;
revoke all on function public.update_my_notification_preferences(boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.update_my_notification_preferences(boolean, boolean, boolean, boolean, boolean) to authenticated;

revoke all on function public.search_chat_contacts(text), public.open_chat_conversation(uuid),
  public.my_chat_conversations(), public.send_chat_message(uuid, text), public.mark_chat_read(uuid),
  public.chat_messages_page(uuid, timestamptz, int),
  public.send_notification_broadcast(uuid, text, text, text, uuid, int)
  from public, anon;
grant execute on function public.search_chat_contacts(text), public.open_chat_conversation(uuid),
  public.my_chat_conversations(), public.send_chat_message(uuid, text), public.mark_chat_read(uuid),
  public.chat_messages_page(uuid, timestamptz, int),
  public.send_notification_broadcast(uuid, text, text, text, uuid, int)
  to authenticated;

-- Chat notification claims are scoped to the exact message and its recipient.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages') then
      alter publication supabase_realtime add table public.chat_messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_conversations') then
      alter publication supabase_realtime add table public.chat_conversations;
    end if;
  end if;
end $$;

-- The retry cap must constrain pending/blocked rows too. Stale claims can be
-- recovered, while rows at five attempts stay failed for operator review.
create or replace function public.claim_outbox_batch(p_limit int default 50)
returns setof public.message_outbox language plpgsql security definer set search_path = public as $$
begin
  if not public.is_privileged_caller() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  update public.message_outbox m
  set status = 'sending', claimed_at = now(),
      attempts = case when m.status = 'blocked' then m.attempts else m.attempts + 1 end
  where m.id in (
    select q.id from public.message_outbox q
    where (q.status in ('pending', 'blocked')
       or (q.status = 'sending' and q.claimed_at < now() - interval '5 minutes'))
      and q.attempts < 5
    order by q.created_at
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    for update skip locked
  )
  returning m.*;
end;
$$;
revoke all on function public.claim_outbox_batch(int) from public, anon, authenticated;
grant execute on function public.claim_outbox_batch(int) to service_role;

-- An approved staff member may request processing only for their own college.
create or replace function public.claim_org_outbox_batch(p_requester uuid, p_limit int default 50)
returns setof public.message_outbox language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  select org_id into v_org from public.profiles
  where id = p_requester and is_approved
    and (role in ('admin', 'super_admin') or account_type in ('tutor', 'staff'));
  if v_org is null then
    raise exception 'An approved college staff account is required' using errcode = '42501';
  end if;
  return query
  update public.message_outbox m
  set status = 'sending', claimed_at = now(),
      attempts = case when m.status = 'blocked' then m.attempts else m.attempts + 1 end
  where m.id in (
    select q.id from public.message_outbox q
    where q.org_id = v_org
      and (q.status in ('pending', 'blocked')
       or (q.status = 'sending' and q.claimed_at < now() - interval '5 minutes'))
      and q.attempts < 5
    order by q.created_at
    limit greatest(1, least(coalesce(p_limit, 50), 100))
    for update skip locked
  ) returning m.*;
end;
$$;
revoke all on function public.claim_org_outbox_batch(uuid, int) from public, anon, authenticated;
grant execute on function public.claim_org_outbox_batch(uuid, int) to service_role;
