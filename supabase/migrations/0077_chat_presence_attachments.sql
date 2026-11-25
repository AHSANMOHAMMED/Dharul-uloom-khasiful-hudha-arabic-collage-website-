-- ============================================================================
-- 0077_chat_presence_attachments.sql
-- Live chat delivery/read receipts, attachments bucket, and online presence.
-- ============================================================================

alter table public.chat_messages
  add column if not exists delivered_at timestamptz,
  add column if not exists attachment_url text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text,
  add column if not exists attachment_size bigint;

alter table public.profiles
  add column if not exists last_seen_at timestamptz default now();

-- Storage bucket for chat images, scanned exam papers, and PDFs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/html', 'text/plain']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat-attachments: org members read" on storage.objects;
create policy "chat-attachments: org members read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_approved
        and p.org_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "chat-attachments: org members upload" on storage.objects;
create policy "chat-attachments: org members upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_approved
        and p.org_id::text = (storage.foldername(name))[1]
    )
  );

drop function if exists public.send_chat_message(uuid, text);
create or replace function public.send_chat_message(
  p_conversation uuid,
  p_body text,
  p_attachment_url text default null,
  p_attachment_name text default null,
  p_attachment_type text default null,
  p_attachment_size bigint default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c record;
  recipient record;
  v_body text := btrim(coalesce(p_body, ''));
  v_att_url text := nullif(btrim(coalesce(p_attachment_url, '')), '');
  v_id uuid;
  sender_name text;
  sender record;
begin
  if not public.chat_is_member(p_conversation) then
    raise exception 'Conversation not found' using errcode = '42501';
  end if;
  if v_body = '' and v_att_url is not null then
    v_body := coalesce(nullif(btrim(p_attachment_name), ''), 'Attachment');
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
  insert into public.chat_messages (
    org_id, conversation_id, sender_id, body,
    attachment_url, attachment_name, attachment_type, attachment_size
  )
  values (
    c.org_id, c.id, auth.uid(), v_body,
    v_att_url, nullif(btrim(coalesce(p_attachment_name, '')), ''),
    nullif(btrim(coalesce(p_attachment_type, '')), ''), p_attachment_size
  ) returning id into v_id;
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

create or replace function public.mark_chat_delivered(p_conversation uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
begin
  update public.chat_messages m
     set delivered_at = now()
    from public.chat_conversations c
   where m.conversation_id = c.id
     and auth.uid() in (c.participant_low, c.participant_high)
     and m.sender_id <> auth.uid()
     and m.delivered_at is null
     and (p_conversation is null or m.conversation_id = p_conversation);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.touch_my_presence()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

revoke all on function public.send_chat_message(uuid, text, text, text, text, bigint) from public, anon;
grant execute on function public.send_chat_message(uuid, text, text, text, text, bigint) to authenticated;

revoke all on function public.mark_chat_delivered(uuid) from public, anon;
grant execute on function public.mark_chat_delivered(uuid) to authenticated;

revoke all on function public.touch_my_presence() from public, anon;
grant execute on function public.touch_my_presence() to authenticated;
