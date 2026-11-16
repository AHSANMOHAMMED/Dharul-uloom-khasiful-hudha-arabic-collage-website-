-- 0045 Security hardening (audit 2026-11)
--
-- 1. Invitations can no longer be hijacked by signing up first with the
--    invited e-mail. At signup an invitation is applied only when the matching
--    invite token is presented (raw_user_meta_data.invite_token). Otherwise it
--    is applied once Supabase Auth confirms the e-mail address.
-- 2. Parent auto-linking only trusts *verified* contact details from auth.users
--    (not profile fields the user can edit).
-- 3. Org admins can no longer override platform-controlled settings
--    (settings.features / settings.site_url).

-- ---------------------------------------------------------------------------
-- 1a. Signup trigger: invitation requires its token
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_type      text  := coalesce(nullif(meta ->> 'account_type', ''), 'guest');
  v_index     text  := nullif(trim(coalesce(meta ->> 'index_number', '')), '');
  v_token     text  := nullif(trim(coalesce(meta ->> 'invite_token', '')), '');
  v_org       uuid;
  v_class     int;
  v_approved  boolean;
  v_role      text := 'user';
  v_assigned  text := 'none';
  v_extra     text[] := '{}'::text[];
  v_inv_id    uuid;
  v_inv_name  text;
  inv         record;
  idx         record;
begin
  if v_type not in ('guest', 'student', 'parent', 'tutor', 'staff') then
    v_type := 'guest';
  end if;

  -- Owning the invite token proves the invitation was delivered to this person.
  -- Without it, the e-mail alone proves nothing until Auth confirms it
  -- (see apply_pending_invitation below).
  if v_token is not null then
    select * into inv
    from public.org_invitations
    where token = v_token
      and lower(email) = lower(new.email)
      and accepted_at is null and revoked_at is null and expires_at > now()
    limit 1
    for update;
    if found then
      v_inv_id   := inv.id;
      v_inv_name := inv.full_name;
    end if;
  end if;

  if v_inv_id is not null then
    v_org      := inv.org_id;
    v_type     := inv.account_type;
    v_role     := inv.role;
    v_assigned := inv.assigned_tutor_role;
    v_extra    := inv.extra_roles;
    v_approved := true;
  else
    select id into v_org from public.organizations
    where slug = nullif(meta ->> 'org_slug', '') and status in ('trial', 'active');
    v_org := coalesce(v_org, public.default_org_id());
    v_approved := v_type in ('guest', 'parent');
  end if;

  if v_type = 'student' then
    if v_index is null then
      raise exception 'Index number is required for student accounts';
    end if;
    select * into idx from public.valid_index_numbers where index_number = v_index for update;
    if not found or idx.is_registered then
      raise exception 'Invalid or already registered index number';
    end if;
    v_org   := idx.org_id;
    v_class := idx.class_number;
    if v_inv_id is null then
      v_approved := false;
    end if;
  else
    v_index := null;
  end if;

  insert into public.profiles (id, email, full_name, account_type, is_approved, index_number,
                               class_number, phone, org_id, role, assigned_tutor_role, extra_roles)
  values (
    new.id,
    new.email,
    coalesce(nullif(meta ->> 'full_name', ''), v_inv_name, ''),
    v_type,
    v_approved,
    v_index,
    v_class,
    nullif(meta ->> 'phone', ''),
    v_org,
    v_role,
    v_assigned,
    v_extra
  )
  on conflict (id) do nothing;

  if v_inv_id is not null then
    update public.org_invitations set accepted_at = now(), accepted_by = new.id where id = v_inv_id;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1b. Apply an e-mail invitation once Auth has confirmed the address
-- ---------------------------------------------------------------------------
create or replace function public.apply_pending_invitation(p_user uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  inv  record;
  prof record;
begin
  select * into prof from public.profiles where id = p_user for update;
  if prof.id is null
     or prof.role = 'super_admin'
     or prof.account_type = 'student'      -- students are bound to their index number
     or exists (select 1 from public.org_invitations where accepted_by = p_user) then
    return;
  end if;

  select * into inv
  from public.org_invitations
  where lower(email) = lower(p_email)
    and accepted_at is null and revoked_at is null and expires_at > now()
    and account_type <> 'student'
  order by created_at desc
  limit 1
  for update;
  if inv.id is null then
    return;
  end if;

  update public.profiles
     set org_id              = inv.org_id,
         account_type        = inv.account_type,
         role                = inv.role,
         assigned_tutor_role = inv.assigned_tutor_role,
         extra_roles         = inv.extra_roles,
         is_approved         = true,
         full_name           = coalesce(nullif(prof.full_name, ''), inv.full_name, '')
   where id = p_user;

  update public.org_invitations set accepted_at = now(), accepted_by = p_user where id = inv.id;
end;
$$;
revoke all on function public.apply_pending_invitation(uuid, text) from public, anon, authenticated;

create or replace function public.tg_auth_user_email_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.apply_pending_invitation(new.id, new.email);
  return new;
end;
$$;
revoke all on function public.tg_auth_user_email_confirmed() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.tg_auth_user_email_confirmed();

-- ---------------------------------------------------------------------------
-- 2. Parent auto-link: only verified contact details count
-- ---------------------------------------------------------------------------
-- Built on 0041_guardian_relationship's version (guardian status, permissions,
-- ambiguous-contact check); only the contact source changes.
create or replace function public.request_child_link(p_index text, p_relationship text default 'guardian', p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me     record;
  child  record;
  v_match_count int := 0;
  v_id   uuid;
  v_email text;
  v_phone text;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null or me.account_type <> 'parent' then
    raise exception 'Only parent accounts can link children' using errcode = '42501';
  end if;

  -- Profile phone/e-mail are user-editable; only contact details that Auth has
  -- verified may auto-link a child (security fix, audit 2026-11).
  select case when u.email_confirmed_at is not null then u.email end,
         case when u.phone_confirmed_at is not null then u.phone end
    into v_email, v_phone
  from auth.users u where u.id = me.id;

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
      (coalesce(v_phone, '') <> '' and regexp_replace(coalesce(a.phone, ''), '\D', '', 'g') <> '' and regexp_replace(a.phone, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g'))
      or (coalesce(v_email, '') <> '' and lower(a.email) = lower(v_email))
    );

  -- Also refuse auto-link when the same contact matches more than one enrolled index in the org.
  if v_match_count = 1 and child.id is not null then
    if (
      select count(distinct a.enrolled_index) from public.admissions a
      where a.org_id = me.org_id and a.enrolled_index is not null
        and (
          (coalesce(v_phone, '') <> '' and regexp_replace(coalesce(a.phone, ''), '\D', '', 'g') <> '' and regexp_replace(a.phone, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g'))
          or (coalesce(v_email, '') <> '' and lower(a.email) = lower(v_email))
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

-- ---------------------------------------------------------------------------
-- 3. Org admins cannot override platform-controlled settings
-- ---------------------------------------------------------------------------
create or replace function public.tg_organizations_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_super_admin() then
    return new;
  end if;
  if (new.slug, new.code, new.status, new.plan, new.max_students, new.custom_domain,
      new.settings -> 'features', new.settings -> 'site_url')
     is distinct from
     (old.slug, old.code, old.status, old.plan, old.max_students, old.custom_domain,
      old.settings -> 'features', old.settings -> 'site_url') then
    raise exception 'Subscription and platform-controlled settings can only be changed by the platform operator'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
