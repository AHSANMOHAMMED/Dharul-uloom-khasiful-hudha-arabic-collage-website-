-- Guardian link status, permissions, unlink, and ambiguous-match review.
set search_path = public, extensions, pg_temp;

alter table public.parent_children
  add column if not exists status text not null default 'active'
    check (status in ('active', 'revoked')),
  add column if not exists permissions jsonb not null default '{"fees":true,"results":true,"attendance":true,"leave":true}'::jsonb,
  add column if not exists relationship text default 'guardian',
  add column if not exists verified_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoke_reason text,
  add column if not exists revoked_by uuid references public.profiles (id) on delete set null;

update public.parent_children set verified_at = coalesce(verified_at, created_at) where status = 'active' and verified_at is null;

create index if not exists idx_parent_children_active
  on public.parent_children (parent_id, child_id) where status = 'active';

-- Active links only.
create or replace function public.is_parent_of(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and exists (
    select 1 from public.parent_children
    where parent_id = auth.uid() and child_id = p_student_id and status = 'active'
  );
$$;

create or replace function public.unlink_child(p_parent uuid, p_child uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_row record;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;
  if not (
    public.is_admin()
    or public.is_admissions_staff()
    or public.has_staff_role(array['principal', 'vice_principal'])
    or (auth.uid() = p_parent and public.is_parent_of(p_child))
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_row from public.parent_children
  where parent_id = p_parent and child_id = p_child and org_id = v_org and status = 'active'
  for update;
  if not found then
    raise exception 'Active guardian link not found';
  end if;

  update public.parent_children
  set status = 'revoked',
      revoked_at = now(),
      revoke_reason = p_reason,
      revoked_by = auth.uid()
  where id = v_row.id;

  return jsonb_build_object('ok', true, 'link_id', v_row.id);
end;
$$;

create or replace function public.set_guardian_permissions(p_parent uuid, p_child uuid, p_permissions jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_admissions_staff() or public.has_staff_role(array['principal', 'vice_principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.parent_children
  set permissions = coalesce(p_permissions, permissions)
  where parent_id = p_parent and child_id = p_child and org_id = public.current_org_id() and status = 'active';
  if not found then
    raise exception 'Active guardian link not found';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Auto-link only when exactly one admission contact match for that index;
-- multiple matching admission rows (shared phone ambiguity) → staff review.
create or replace function public.request_child_link(p_index text, p_relationship text default 'guardian', p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me     record;
  child  record;
  v_match_count int := 0;
  v_id   uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.account_type <> 'parent' then
    raise exception 'Only parent accounts can link children' using errcode = '42501';
  end if;

  select id, full_name, org_id into child from public.profiles
  where index_number = trim(p_index) and account_type = 'student' and org_id = me.org_id;

  if exists (
    select 1 from public.parent_children
    where parent_id = me.id and child_id = child.id and status = 'active'
  ) then
    return jsonb_build_object('ok', true, 'status', 'already_linked');
  end if;

  select count(*) into v_match_count
  from public.admissions a
  where a.enrolled_index = trim(p_index) and a.org_id = me.org_id
    and (
      (coalesce(me.phone, '') <> '' and regexp_replace(a.phone, '\D', '', 'g') = regexp_replace(me.phone, '\D', '', 'g'))
      or (coalesce(me.email, '') <> '' and lower(a.email) = lower(me.email))
    );

  -- Also refuse auto-link when the same contact matches more than one enrolled index in the org.
  if v_match_count = 1 and child.id is not null then
    if (
      select count(distinct a.enrolled_index) from public.admissions a
      where a.org_id = me.org_id and a.enrolled_index is not null
        and (
          (coalesce(me.phone, '') <> '' and regexp_replace(a.phone, '\D', '', 'g') = regexp_replace(me.phone, '\D', '', 'g'))
          or (coalesce(me.email, '') <> '' and lower(a.email) = lower(me.email))
        )
    ) > 1 then
      v_match_count := 0; -- force staff review
    end if;
  end if;

  if v_match_count = 1 and child.id is not null then
    insert into public.parent_children (parent_id, child_id, org_id, status, relationship, verified_at, permissions)
    values (me.id, child.id, me.org_id, 'active', coalesce(p_relationship, 'guardian'), now(),
            '{"fees":true,"results":true,"attendance":true,"leave":true}'::jsonb)
    on conflict (parent_id, child_id) do update
      set status = 'active', revoked_at = null, revoke_reason = null, revoked_by = null,
          verified_at = coalesce(public.parent_children.verified_at, now()),
          relationship = coalesce(excluded.relationship, public.parent_children.relationship);
    insert into public.parent_link_requests (org_id, parent_id, child_index, child_id, relationship, note, status, reviewed_at)
    values (me.org_id, me.id, trim(p_index), child.id, coalesce(p_relationship, 'guardian'), p_note, 'approved', now());
    insert into public.activation_events (profile_id, event_type, summary, details, org_id)
    values (child.id, 'linked_parent', format('Parent %s linked (verified contact)', coalesce(me.full_name, me.email)),
            jsonb_build_object('parent_id', me.id), me.org_id);
    return jsonb_build_object('ok', true, 'status', 'linked', 'child_name', child.full_name);
  end if;

  insert into public.parent_link_requests (org_id, parent_id, child_index, child_id, relationship, note)
  values (me.org_id, me.id, trim(p_index), child.id, coalesce(p_relationship, 'guardian'),
          case when v_match_count <> 1
               then coalesce(p_note, '') || ' [staff review: contact match ambiguous or missing]'
               else p_note end)
  on conflict (parent_id, child_index) where status = 'pending' do update set note = excluded.note
  returning id into v_id;

  return jsonb_build_object('ok', true, 'status', 'pending', 'request_id', v_id);
end;
$$;

create or replace function public.review_child_link(p_request_id uuid, p_approve boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  req   record;
  v_child uuid;
begin
  if not (public.is_admin() or public.is_admissions_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into req from public.parent_link_requests
  where id = p_request_id and org_id = public.current_org_id() and status = 'pending' for update;
  if not found then
    raise exception 'Request not found';
  end if;

  v_child := coalesce(req.child_id, (select id from public.profiles
     where index_number = req.child_index and account_type = 'student' and org_id = req.org_id));

  if p_approve and v_child is null then
    raise exception 'Student with index % has not registered yet', req.child_index;
  end if;

  update public.parent_link_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      child_id = v_child, reviewed_by = auth.uid(), reviewed_at = now()
  where id = req.id;

  if p_approve then
    insert into public.parent_children (parent_id, child_id, org_id, status, relationship, verified_at)
    values (req.parent_id, v_child, req.org_id, 'active', coalesce(req.relationship, 'guardian'), now())
    on conflict (parent_id, child_id) do update
      set status = 'active', revoked_at = null, revoke_reason = null, revoked_by = null,
          verified_at = coalesce(public.parent_children.verified_at, now());
    insert into public.notifications (user_id, title, message, org_id)
    values (req.parent_id, 'Child linked', format('Your request to link index %s was approved.', req.child_index), req.org_id);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.claim_parent_invite(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  inv record;
  v_student uuid;
  v_me record;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into v_me from public.profiles where id = auth.uid();
  if v_me.account_type <> 'parent' then
    return jsonb_build_object('ok', false, 'error', 'Only parent accounts can claim invites');
  end if;
  select * into inv from public.parent_invites
  where token = p_token and claimed_by is null and expires_at > now() for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Invalid or expired invite');
  end if;
  if inv.org_id is distinct from v_me.org_id then
    return jsonb_build_object('ok', false, 'error', 'Invite belongs to another institution');
  end if;
  select id into v_student from public.profiles
  where index_number = inv.child_index and account_type = 'student' and org_id = inv.org_id
  limit 1;
  if v_student is null then
    return jsonb_build_object('ok', false,
      'error', 'Student has not registered yet. Link by index after the student creates an account.',
      'child_index', inv.child_index);
  end if;
  insert into public.parent_children (parent_id, child_id, org_id, status, relationship, verified_at)
  values (auth.uid(), v_student, inv.org_id, 'active', 'guardian', now())
  on conflict (parent_id, child_id) do update
    set status = 'active', revoked_at = null, revoke_reason = null, revoked_by = null,
        verified_at = coalesce(public.parent_children.verified_at, now());
  update public.parent_invites set claimed_by = auth.uid(), claimed_at = now() where id = inv.id;
  insert into public.activation_events (profile_id, event_type, summary, details, org_id)
  values (v_student, 'linked_parent', format('Parent linked via invite for %s', coalesce(inv.child_name, inv.child_index)),
          jsonb_build_object('parent_id', auth.uid()), inv.org_id);
  return jsonb_build_object('ok', true, 'child_id', v_student, 'child_index', inv.child_index);
end;
$$;

grant execute on function public.unlink_child(uuid, uuid, text) to authenticated;
grant execute on function public.set_guardian_permissions(uuid, uuid, jsonb) to authenticated;
grant execute on function public.request_child_link(text, text, text) to authenticated;
grant execute on function public.review_child_link(uuid, boolean) to authenticated;
grant execute on function public.claim_parent_invite(text) to authenticated;
