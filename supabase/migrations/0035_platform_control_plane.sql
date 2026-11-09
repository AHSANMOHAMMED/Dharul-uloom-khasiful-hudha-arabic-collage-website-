-- Super Admin control plane: identity CRUD, role/user feature ACL,
-- campus communities, audit feed, hard-delete helper.

-- ---------------------------------------------------------------------------
-- Feature catalog additions
-- ---------------------------------------------------------------------------
create or replace function public.platform_default_features()
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'public_site', true,
    'admissions_form', true,
    'library', true,
    'library_reader', true,
    'registrations', true,
    'student_portal', true,
    'parent_portal', true,
    'staff_portal', true,
    'mobile_app', true,
    'messaging', true,
    'payments', true,
    'erp', true,
    'erp_dashboard', true,
    'erp_analytics', true,
    'erp_reports', true,
    'erp_import', true,
    'erp_documents', true,
    'erp_tasks', true,
    'erp_students', true,
    'erp_academics', true,
    'erp_crm', true,
    'erp_fees', true,
    'erp_accounting', true,
    'erp_cheques', true,
    'erp_expenses', true,
    'erp_donations', true,
    'erp_payroll', true,
    'erp_hr', true,
    'erp_hostel', true,
    'erp_welfare', true,
    'erp_certificates', true,
    'erp_duties', true,
    'erp_activities', true,
    'erp_mashoora', true,
    'erp_pettycash', true,
    'erp_audit', true,
    'erp_billing_jobs', true,
    'erp_quotations', true,
    'erp_finance_hub', true
  );
$$;

-- ---------------------------------------------------------------------------
-- Role templates + per-user overrides
-- ---------------------------------------------------------------------------
create table if not exists public.role_feature_templates (
  role_key text not null,
  feature_key text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (role_key, feature_key)
);

create table if not exists public.user_feature_overrides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  primary key (user_id, feature_key)
);

alter table public.role_feature_templates enable row level security;
alter table public.user_feature_overrides enable row level security;

drop policy if exists "role_feature_templates: sa" on public.role_feature_templates;
create policy "role_feature_templates: sa" on public.role_feature_templates for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "role_feature_templates: read" on public.role_feature_templates;
create policy "role_feature_templates: read" on public.role_feature_templates for select to authenticated
  using (true);

drop policy if exists "user_feature_overrides: sa" on public.user_feature_overrides;
create policy "user_feature_overrides: sa" on public.user_feature_overrides for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists "user_feature_overrides: self read" on public.user_feature_overrides;
create policy "user_feature_overrides: self read" on public.user_feature_overrides for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin() or public.is_admin());

create or replace function public.role_keys_for_profile(p profiles)
returns text[] language sql stable set search_path = public as $$
  select array_remove(array[
    case when p.role = 'admin' then 'admin'
         when p.role = 'librarian' then 'librarian'
         when p.role = 'super_admin' then 'super_admin'
         else null end,
    case when p.account_type in ('student','parent','tutor','staff','guest') then p.account_type else null end,
    case when coalesce(p.assigned_tutor_role, 'none') <> 'none' then p.assigned_tutor_role else null end
  ] || coalesce(p.extra_roles, '{}'::text[]), null);
$$;

create or replace function public.resolve_role_feature_overlay(p_roles text[])
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r record;
  out jsonb := '{}'::jsonb;
begin
  for r in
    select feature_key, bool_or(enabled) as enabled
    from public.role_feature_templates
    where role_key = any (p_roles)
    group by feature_key
  loop
    out := out || jsonb_build_object(r.feature_key, r.enabled);
  end loop;
  return out;
end;
$$;

create or replace function public.resolve_user_feature_overlay(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r record;
  out jsonb := '{}'::jsonb;
begin
  for r in select feature_key, enabled from public.user_feature_overrides where user_id = p_user
  loop
    out := out || jsonb_build_object(r.feature_key, r.enabled);
  end loop;
  return out;
end;
$$;

create or replace function public.my_features()
returns jsonb language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_org uuid;
  v_global jsonb;
  v_defaults jsonb := public.platform_default_features();
  me public.profiles%rowtype;
  v_base jsonb;
begin
  if auth.uid() is null then
    return v_defaults;
  end if;
  select * into me from public.profiles where id = auth.uid();
  begin
    v_org := public.current_org_id();
  exception when others then
    v_org := null;
  end;
  if v_org is not null then
    v_base := public.resolve_org_features(v_org);
  else
    select coalesce(features, '{}'::jsonb) into v_global from public.platform_settings where id = 1;
    v_base := v_defaults || coalesce(v_global, '{}'::jsonb);
  end if;
  if me.id is null then
    return v_base;
  end if;
  return v_base
    || public.resolve_role_feature_overlay(public.role_keys_for_profile(me))
    || public.resolve_user_feature_overlay(me.id);
end;
$$;

create or replace function public.platform_set_role_feature(p_role text, p_key text, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not (public.platform_default_features() ? p_key) then
    raise exception 'Unknown feature %', p_key using errcode = '22023';
  end if;
  insert into public.role_feature_templates(role_key, feature_key, enabled, updated_at)
  values (p_role, p_key, p_enabled, now())
  on conflict (role_key, feature_key) do update
    set enabled = excluded.enabled, updated_at = now();
end;
$$;

create or replace function public.platform_set_user_feature(p_user uuid, p_key text, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not (public.platform_default_features() ? p_key) then
    raise exception 'Unknown feature %', p_key using errcode = '22023';
  end if;
  insert into public.user_feature_overrides(user_id, feature_key, enabled, updated_at, updated_by)
  values (p_user, p_key, p_enabled, now(), auth.uid())
  on conflict (user_id, feature_key) do update
    set enabled = excluded.enabled, updated_at = now(), updated_by = auth.uid();
end;
$$;

create or replace function public.platform_clear_user_feature(p_user uuid, p_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.user_feature_overrides where user_id = p_user and feature_key = p_key;
end;
$$;

create or replace function public.platform_list_role_features(p_role text default null)
returns table(role_key text, feature_key text, enabled boolean)
language sql stable security definer set search_path = public as $$
  select t.role_key, t.feature_key, t.enabled
  from public.role_feature_templates t
  where public.is_super_admin()
    and (p_role is null or t.role_key = p_role)
  order by t.role_key, t.feature_key;
$$;

create or replace function public.platform_list_user_features(p_user uuid)
returns table(feature_key text, enabled boolean)
language sql stable security definer set search_path = public as $$
  select o.feature_key, o.enabled
  from public.user_feature_overrides o
  where public.is_super_admin() and o.user_id = p_user
  order by o.feature_key;
$$;

grant execute on function public.platform_set_role_feature(text, text, boolean) to authenticated;
grant execute on function public.platform_set_user_feature(uuid, text, boolean) to authenticated;
grant execute on function public.platform_clear_user_feature(uuid, text) to authenticated;
grant execute on function public.platform_list_role_features(text) to authenticated;
grant execute on function public.platform_list_user_features(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Identity: invite / update / deactivate
-- ---------------------------------------------------------------------------
create or replace function public.platform_invite_user(
  p_org uuid,
  p_email text,
  p_full_name text default null,
  p_account_type text default 'staff',
  p_role text default 'user',
  p_assigned_tutor_role text default 'none',
  p_extra_roles text[] default '{}',
  p_approve boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(btrim(p_email));
  v_id uuid;
  v_token text;
begin
  if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_email is null or v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Valid email required' using errcode = '22023';
  end if;
  if p_org is null or not exists (select 1 from public.organizations o where o.id = p_org) then
    raise exception 'Organization required' using errcode = '22023';
  end if;
  if p_account_type not in ('guest','student','parent','tutor','staff') then
    raise exception 'Invalid account_type' using errcode = '22023';
  end if;
  if p_role not in ('user','librarian','admin') then
    raise exception 'Invalid role (super_admin cannot be invited)' using errcode = '22023';
  end if;

  insert into public.org_invitations (
    org_id, email, full_name, account_type, role, assigned_tutor_role, extra_roles, invited_by, details
  ) values (
    p_org, v_email, nullif(btrim(p_full_name), ''), p_account_type, p_role,
    coalesce(nullif(p_assigned_tutor_role, ''), 'none'),
    coalesce(p_extra_roles, '{}'::text[]),
    auth.uid(),
    jsonb_build_object('pre_approve', p_approve)
  )
  returning id, token into v_id, v_token;

  return jsonb_build_object('invitation_id', v_id, 'token', v_token, 'email', v_email);
end;
$$;

create or replace function public.platform_update_user(
  p_profile uuid,
  p_org uuid default null,
  p_account_type text default null,
  p_role text default null,
  p_assigned_tutor_role text default null,
  p_extra_roles text[] default null,
  p_full_name text default null,
  p_class_number int default null,
  p_is_approved boolean default null
) returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  u public.profiles;
begin
  if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into u from public.profiles where id = p_profile;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
  if u.role = 'super_admin' and u.id <> auth.uid() then
    raise exception 'Cannot edit another super admin' using errcode = '42501';
  end if;

  update public.profiles set
    org_id = coalesce(p_org, org_id),
    account_type = coalesce(p_account_type, account_type),
    role = case when p_role is null then role
                when p_role = 'super_admin' then role
                else p_role end,
    assigned_tutor_role = coalesce(p_assigned_tutor_role, assigned_tutor_role),
    extra_roles = coalesce(p_extra_roles, extra_roles),
    full_name = coalesce(nullif(btrim(p_full_name), ''), full_name),
    class_number = coalesce(p_class_number, class_number),
    is_approved = coalesce(p_is_approved, is_approved),
    updated_at = now()
  where id = p_profile
  returning * into u;

  insert into public.audit_logs (org_id, table_name, record_id, action, actor_id, actor_role, new_data)
  values (u.org_id, 'profiles', u.id::text, 'UPDATE', auth.uid(), 'super_admin',
    jsonb_build_object('source', 'platform_update_user'));

  return u;
end;
$$;

create or replace function public.platform_deactivate_user(p_profile uuid, p_reason text default null)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  u public.profiles;
begin
  if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.profiles set is_approved = false, updated_at = now()
  where id = p_profile and role <> 'super_admin'
  returning * into u;
  if not found then raise exception 'User not found or cannot deactivate' using errcode = 'P0002'; end if;
  insert into public.audit_logs (org_id, table_name, record_id, action, actor_id, actor_role, new_data)
  values (u.org_id, 'profiles', u.id::text, 'UPDATE', auth.uid(), 'super_admin',
    jsonb_build_object('deactivated', true, 'reason', p_reason));
  return u;
end;
$$;

grant execute on function public.platform_invite_user(uuid, text, text, text, text, text, text[], boolean) to authenticated;
grant execute on function public.platform_update_user(uuid, uuid, text, text, text, text[], text, int, boolean) to authenticated;
grant execute on function public.platform_deactivate_user(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Campus communities
-- ---------------------------------------------------------------------------
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('alumni','staff_team','club','custom')),
  name_en text not null,
  name_ar text,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner','moderator','member')),
  status text not null default 'active' check (status in ('active','invited','removed')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_communities_org on public.communities (org_id, kind);
create index if not exists idx_community_members_user on public.community_members (user_id);
create index if not exists idx_community_posts_community on public.community_posts (community_id, created_at desc);

alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_posts enable row level security;

drop policy if exists "communities: tenant" on public.communities;
create policy "communities: tenant" on public.communities for all to authenticated
  using (public.is_super_admin() or org_id = public.current_org_id())
  with check (public.is_super_admin() or (org_id = public.current_org_id() and (public.is_admin() or public.is_employee())));

drop policy if exists "community_members: tenant" on public.community_members;
create policy "community_members: tenant" on public.community_members for all to authenticated
  using (
    public.is_super_admin()
    or exists (select 1 from public.communities c where c.id = community_id and c.org_id = public.current_org_id())
  )
  with check (
    public.is_super_admin()
    or exists (select 1 from public.communities c where c.id = community_id and c.org_id = public.current_org_id()
      and (public.is_admin() or public.is_employee() or user_id = auth.uid()))
  );

drop policy if exists "community_posts: tenant" on public.community_posts;
create policy "community_posts: tenant" on public.community_posts for all to authenticated
  using (public.is_super_admin() or org_id = public.current_org_id())
  with check (public.is_super_admin() or org_id = public.current_org_id());

create or replace function public.platform_list_communities(p_org uuid default null)
returns setof public.communities language sql stable security definer set search_path = public as $$
  select c.* from public.communities c
  where public.is_super_admin()
    and (p_org is null or c.org_id = p_org)
  order by c.created_at desc;
$$;

grant execute on function public.platform_list_communities(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Hard delete + audit feed
-- ---------------------------------------------------------------------------
create or replace function public.platform_can_hard_delete()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() and public.mfa_ok();
$$;

create or replace function public.platform_audit_feed(
  p_org uuid default null,
  p_table text default null,
  p_limit int default 50
) returns setof public.audit_logs
language sql stable security definer set search_path = public as $$
  select a.*
  from public.audit_logs a
  where public.is_super_admin()
    and (p_org is null or a.org_id = p_org)
    and (p_table is null or a.table_name = p_table)
  order by a.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

grant execute on function public.platform_can_hard_delete() to authenticated;
grant execute on function public.platform_audit_feed(uuid, text, int) to authenticated;
