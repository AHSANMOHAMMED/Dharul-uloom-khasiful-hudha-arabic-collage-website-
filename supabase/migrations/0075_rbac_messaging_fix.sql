-- =============================================================================
-- 0075_rbac_messaging_fix.sql — Symmetric role-based messaging permissions,
-- active-parent & librarian support, and role metadata in chat RPCs.
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- Staff/leadership/admin/librarian who can converse across the institution
-- (unlike plain class tutors, who are scoped to classes they teach).
create or replace function public.is_messaging_staff_privileged(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user
      and coalesce(p.is_approved, false)
      and (
        p.role in ('admin', 'librarian')
        or (p.account_type = 'staff')
        or (
          p.account_type in ('tutor', 'staff')
          and (
            p.assigned_tutor_role = any (array[
              'principal', 'vice_principal', 'treasurer', 'accountant',
              'hr_manager', 'admissions_officer', 'warden', 'counselor',
              'exam_officer', 'it_officer', 'librarian'
            ])
            or p.extra_roles && array[
              'principal', 'vice_principal', 'treasurer', 'accountant',
              'hr_manager', 'admissions_officer', 'warden', 'counselor',
              'exam_officer', 'it_officer', 'librarian'
            ]
          )
        )
      )
  );
$$;
revoke all on function public.is_messaging_staff_privileged(uuid) from public, anon, authenticated;

-- Helper: true when p_tutor teaches p_student (used symmetrically by both sides).
create or replace function public._tutor_teaches_student(p_tutor uuid, p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles t
    join public.profiles s on s.id = p_student
    where t.id = p_tutor
      and coalesce(t.is_approved, false)
      and t.account_type = 'tutor'
      and s.account_type = 'student'
      and coalesce(s.is_approved, false)
      and t.org_id = s.org_id
      and (
        exists (
          select 1 from public.class_subjects cs
          where cs.org_id = s.org_id and cs.class_number = s.class_number and cs.tutor_id = p_tutor
        )
        or exists (
          select 1 from public.class_schedules sc
          where sc.org_id = s.org_id and sc.class_number = s.class_number and sc.tutor_id = p_tutor
        )
        or (
          not exists (
            select 1 from public.class_subjects cs
            where cs.org_id = s.org_id and cs.class_number = s.class_number and cs.tutor_id is not null
          )
          and not exists (
            select 1 from public.class_schedules sc
            where sc.org_id = s.org_id and sc.class_number = s.class_number
          )
        )
      )
  );
$$;
revoke all on function public._tutor_teaches_student(uuid, uuid) from public, anon, authenticated;

-- Symmetric contact eligibility within the same approved institution.
create or replace function public.chat_can_contact(p_other uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me record;
  other_user record;
  me_employee boolean;
  other_employee boolean;
  me_priv boolean;
  other_priv boolean;
begin
  if auth.uid() is null or p_other is null or p_other = auth.uid() or not public.mfa_ok() then
    return false;
  end if;

  select id, org_id, account_type, is_approved, role, assigned_tutor_role, extra_roles
    into me
  from public.profiles where id = auth.uid();

  select id, org_id, account_type, is_approved, role, assigned_tutor_role, extra_roles
    into other_user
  from public.profiles where id = p_other;

  if not found
     or not coalesce(me.is_approved, false)
     or not coalesce(other_user.is_approved, false)
     or me.org_id is distinct from other_user.org_id
     or me.role = 'super_admin'
     or other_user.role = 'super_admin' then
    return false;
  end if;

  me_employee := (me.role in ('admin', 'librarian') or me.account_type in ('tutor', 'staff'));
  other_employee := (other_user.role in ('admin', 'librarian') or other_user.account_type in ('tutor', 'staff'));

  -- Non-employees must be students or active linked parents.
  if not me_employee then
    if me.account_type not in ('student', 'parent') then
      return false;
    end if;
    if me.account_type = 'parent' and not exists (
      select 1 from public.parent_children pc
      where pc.parent_id = me.id and pc.org_id = me.org_id and pc.status = 'active'
    ) then
      return false;
    end if;
  end if;

  if not other_employee then
    if other_user.account_type not in ('student', 'parent') then
      return false;
    end if;
    if other_user.account_type = 'parent' and not exists (
      select 1 from public.parent_children pc
      where pc.parent_id = other_user.id and pc.org_id = other_user.org_id and pc.status = 'active'
    ) then
      return false;
    end if;
  end if;

  me_priv := public.is_messaging_staff_privileged(me.id);
  other_priv := public.is_messaging_staff_privileged(other_user.id);

  -- Employee ↔ Employee (admin, librarian, staff, tutor) is always allowed in-org.
  if me_employee and other_employee then
    return true;
  end if;

  -- Privileged staff/admin/librarian ↔ Student/Active Parent is allowed in-org.
  if (me_employee and me_priv) or (other_employee and other_priv) then
    return true;
  end if;

  -- Plain class tutor ↔ Student / Active Parent (symmetric).
  if me.account_type = 'tutor' and not me_priv then
    if other_user.account_type = 'student' then
      return public._tutor_teaches_student(me.id, other_user.id);
    elsif other_user.account_type = 'parent' then
      return exists (
        select 1 from public.parent_children pc
        where pc.parent_id = other_user.id
          and pc.org_id = me.org_id
          and pc.status = 'active'
          and public._tutor_teaches_student(me.id, pc.child_id)
      );
    end if;
  end if;

  if other_user.account_type = 'tutor' and not other_priv then
    if me.account_type = 'student' then
      return public._tutor_teaches_student(other_user.id, me.id);
    elsif me.account_type = 'parent' then
      return exists (
        select 1 from public.parent_children pc
        where pc.parent_id = me.id
          and pc.org_id = me.org_id
          and pc.status = 'active'
          and public._tutor_teaches_student(other_user.id, pc.child_id)
      );
    end if;
  end if;

  return false;
end;
$$;
revoke all on function public.chat_can_contact(uuid) from public, anon, authenticated;

-- Drop & recreate search_chat_contacts and my_chat_conversations to include role metadata.
drop function if exists public.search_chat_contacts(text);
create or replace function public.search_chat_contacts(p_search text default '')
returns table (
  user_id uuid,
  full_name text,
  account_type text,
  class_number int,
  role text,
  assigned_tutor_role text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  me record;
  needle text := btrim(coalesce(p_search, ''));
  staff_caller boolean;
begin
  if auth.uid() is null or not public.mfa_ok() then
    raise exception 'Sign-in required' using errcode = '42501';
  end if;
  select p.id, p.org_id, p.account_type, p.is_approved, p.role
    into me
  from public.profiles p where p.id = auth.uid();
  if not found or not me.is_approved then
    raise exception 'An approved account is required' using errcode = '42501';
  end if;
  if public.is_super_admin() or me.role = 'super_admin' then
    raise exception 'Institution messaging is unavailable to super admins' using errcode = '42501';
  end if;
  staff_caller := public.is_employee() or me.role in ('admin', 'librarian');
  if not staff_caller and me.account_type not in ('student', 'parent') then
    raise exception 'Messaging is not enabled for this account' using errcode = '42501';
  end if;
  if not staff_caller and me.account_type = 'parent' and not exists (
    select 1 from public.parent_children pc
    where pc.parent_id = auth.uid() and pc.org_id = me.org_id and pc.status = 'active'
  ) then
    raise exception 'Link a student before using messages' using errcode = '42501';
  end if;

  return query
  select p.id, p.full_name, p.account_type, p.class_number, p.role, p.assigned_tutor_role
  from public.profiles p
  where p.org_id = me.org_id
    and p.id <> auth.uid()
    and p.is_approved
    and p.role <> 'super_admin'
    and (p.role in ('admin', 'librarian') or p.account_type in ('student', 'parent', 'tutor', 'staff'))
    and (staff_caller or p.role in ('admin', 'librarian') or p.account_type in ('tutor', 'staff'))
    and (needle = '' or lower(p.full_name) like '%' || lower(needle) || '%')
    and public.chat_can_contact(p.id)
  order by p.full_name, p.id
  limit 30;
end;
$$;
revoke all on function public.search_chat_contacts(text) from public, anon;
grant execute on function public.search_chat_contacts(text) to authenticated;

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
