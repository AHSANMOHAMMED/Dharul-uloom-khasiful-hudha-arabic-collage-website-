-- ============================================================================
-- 0078_chat_edit_delete.sql
-- Support editing sent messages (with edited_at) and deleting messages
-- ("Delete for me" and "Delete for everyone").
-- ============================================================================

alter table public.chat_messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_for_everyone_at timestamptz,
  add column if not exists deleted_for_user_ids uuid[] not null default '{}'::uuid[];

create or replace function public.tg_chat_message_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  if tg_op = 'UPDATE' then
    -- Trusted RPCs set app.chat_rpc = '1' for controlled edit/delete/delivery updates.
    if current_setting('app.chat_rpc', true) = '1' then
      return new;
    end if;
    if (new.id, new.org_id, new.conversation_id, new.sender_id, new.body, new.created_at,
        new.edited_at, new.deleted_for_everyone_at, new.deleted_for_user_ids)
       is distinct from (old.id, old.org_id, old.conversation_id, old.sender_id, old.body, old.created_at,
        old.edited_at, old.deleted_for_everyone_at, old.deleted_for_user_ids)
       or (new.read_at is null and new.delivered_at is null) then
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

create or replace function public.chat_messages_page(p_conversation uuid, p_before timestamptz default null, p_limit int default 100)
returns setof public.chat_messages language plpgsql stable security definer set search_path = public as $$
begin
  if not public.chat_is_member(p_conversation) then
    raise exception 'Conversation not found' using errcode = '42501';
  end if;
  return query
    select m.* from public.chat_messages m
    where m.conversation_id = p_conversation
      and not (auth.uid() = any(m.deleted_for_user_ids))
      and (p_before is null or m.created_at < p_before)
    order by m.created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 100));
end;
$$;

drop function if exists public.my_chat_conversations();
create or replace function public.my_chat_conversations()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_user_name text,
  other_account_type text,
  other_role text,
  other_assigned_tutor_role text,
  last_message_at timestamptz,
  last_message text,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         p.id,
         p.full_name,
         p.account_type,
         p.role,
         p.assigned_tutor_role,
         c.last_message_at,
         case
           when latest.deleted_for_everyone_at is not null then 'This message was deleted'
           else latest.body
         end,
         (select count(*) from public.chat_messages unread
          where unread.conversation_id = c.id
            and unread.sender_id <> auth.uid()
            and unread.read_at is null
            and unread.deleted_for_everyone_at is null
            and not (auth.uid() = any(unread.deleted_for_user_ids)))
  from public.chat_conversations c
  join public.profiles p on p.id = case when c.participant_low = auth.uid() then c.participant_high else c.participant_low end
  left join lateral (
    select m.body, m.deleted_for_everyone_at
    from public.chat_messages m
    where m.conversation_id = c.id
      and not (auth.uid() = any(m.deleted_for_user_ids))
    order by m.created_at desc
    limit 1
  ) latest on true
  where public.mfa_ok()
    and auth.uid() in (c.participant_low, c.participant_high)
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_approved and me.org_id = c.org_id)
    and public.chat_can_contact(p.id)
  order by c.last_message_at desc nulls last, c.created_at desc
  limit 100;
$$;

create or replace function public.edit_chat_message(p_message_id uuid, p_body text)
returns public.chat_messages language plpgsql security definer set search_path = public as $$
declare
  v_msg public.chat_messages;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if char_length(v_body) < 1 or char_length(v_body) > 4000 then
    raise exception 'Message must contain 1 to 4000 characters';
  end if;
  select * into v_msg from public.chat_messages where id = p_message_id for update;
  if not found or not public.chat_is_member(v_msg.conversation_id) then
    raise exception 'Message not found' using errcode = '42501';
  end if;
  if v_msg.sender_id <> auth.uid() then
    raise exception 'You can only edit your own messages' using errcode = '42501';
  end if;
  if v_msg.deleted_for_everyone_at is not null then
    raise exception 'Deleted messages cannot be edited';
  end if;

  perform set_config('app.chat_rpc', '1', true);
  update public.chat_messages
     set body = v_body,
         edited_at = now()
   where id = p_message_id
   returning * into v_msg;
  return v_msg;
end;
$$;

create or replace function public.delete_chat_message_for_everyone(p_message_id uuid)
returns public.chat_messages language plpgsql security definer set search_path = public as $$
declare
  v_msg public.chat_messages;
begin
  select * into v_msg from public.chat_messages where id = p_message_id for update;
  if not found or not public.chat_is_member(v_msg.conversation_id) then
    raise exception 'Message not found' using errcode = '42501';
  end if;
  if v_msg.sender_id <> auth.uid() then
    raise exception 'You can only delete your own messages for everyone' using errcode = '42501';
  end if;

  perform set_config('app.chat_rpc', '1', true);
  update public.chat_messages
     set deleted_for_everyone_at = now(),
         body = '',
         attachment_url = null,
         attachment_name = null,
         attachment_type = null,
         attachment_size = null
   where id = p_message_id
   returning * into v_msg;
  return v_msg;
end;
$$;

create or replace function public.delete_chat_message_for_me(p_message_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_msg public.chat_messages;
begin
  select * into v_msg from public.chat_messages where id = p_message_id for update;
  if not found or not public.chat_is_member(v_msg.conversation_id) then
    raise exception 'Message not found' using errcode = '42501';
  end if;

  perform set_config('app.chat_rpc', '1', true);
  update public.chat_messages
     set deleted_for_user_ids = case
       when auth.uid() = any(deleted_for_user_ids) then deleted_for_user_ids
       else array_append(deleted_for_user_ids, auth.uid())
     end
   where id = p_message_id;
  return p_message_id;
end;
$$;

revoke all on function public.my_chat_conversations() from public, anon;
grant execute on function public.my_chat_conversations() to authenticated;

revoke all on function public.edit_chat_message(uuid, text) from public, anon;
grant execute on function public.edit_chat_message(uuid, text) to authenticated;

revoke all on function public.delete_chat_message_for_everyone(uuid) from public, anon;
grant execute on function public.delete_chat_message_for_everyone(uuid) to authenticated;

revoke all on function public.delete_chat_message_for_me(uuid) from public, anon;
grant execute on function public.delete_chat_message_for_me(uuid) to authenticated;
