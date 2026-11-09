-- Fix PL/pgSQL ambiguity: RETURNS TABLE (... account_type ...) conflicts with
-- profiles.account_type in RETURN QUERY / WHERE, causing:
--   column reference "account_type" is ambiguous
-- when parents/staff search College Messages contacts.

create or replace function public.search_chat_contacts(p_search text default '')
returns table (user_id uuid, full_name text, account_type text, class_number int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  me record;
  needle text := btrim(coalesce(p_search, ''));
  staff_caller boolean;
begin
  if auth.uid() is null or not public.mfa_ok() then
    raise exception 'Sign-in required' using errcode = '42501';
  end if;
  select p.id, p.org_id, p.account_type, p.is_approved into me
  from public.profiles p where p.id = auth.uid();
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

revoke all on function public.search_chat_contacts(text) from public, anon;
grant execute on function public.search_chat_contacts(text) to authenticated;

-- Same class of conflict can surface when listing conversations if OUT names overlap.
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

revoke all on function public.my_chat_conversations() from public, anon;
grant execute on function public.my_chat_conversations() to authenticated;
