-- ============================================================================
-- 0079_fix_chat_delete_body_check.sql
-- Fix delete_chat_message_for_everyone violating chat_messages_body_check
-- (char_length(body) between 1 and 4000).
-- ============================================================================

alter table public.chat_messages
  drop constraint if exists chat_messages_body_check;

alter table public.chat_messages
  add constraint chat_messages_body_check
  check (deleted_for_everyone_at is not null or char_length(body) between 1 and 4000);

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
         body = 'This message was deleted',
         attachment_url = null,
         attachment_name = null,
         attachment_type = null,
         attachment_size = null
   where id = p_message_id
   returning * into v_msg;
  return v_msg;
end;
$$;
