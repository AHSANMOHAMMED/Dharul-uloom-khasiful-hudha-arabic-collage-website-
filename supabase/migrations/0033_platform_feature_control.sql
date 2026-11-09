-- 0033_platform_feature_control.sql
-- Super-admin platform controls: global + per-org feature enable/disable,
-- cross-tenant directory, and helpers the UI can query.

-- ---------------------------------------------------------------------------
-- Catalog of controllable features (documentation + defaults)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_settings (
  id              int primary key default 1 check (id = 1),
  features        jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id) on delete set null
);

insert into public.platform_settings (id, features)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists "platform_settings: super admin all" on public.platform_settings;
create policy "platform_settings: super admin all"
  on public.platform_settings for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "platform_settings: authenticated read" on public.platform_settings;
create policy "platform_settings: authenticated read"
  on public.platform_settings for select
  to authenticated
  using (true);

-- Audit of feature toggles
create table if not exists public.platform_control_log (
  id           uuid primary key default extensions.gen_random_uuid(),
  actor_id     uuid references public.profiles (id) on delete set null,
  org_id       uuid references public.organizations (id) on delete set null,
  scope        text not null check (scope in ('global', 'org')),
  feature_key  text not null,
  enabled      boolean not null,
  note         text,
  created_at   timestamptz not null default now()
);

alter table public.platform_control_log enable row level security;

drop policy if exists "platform_control_log: super admin" on public.platform_control_log;
create policy "platform_control_log: super admin"
  on public.platform_control_log for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Default feature map
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
    'erp_audit', true
  );
$$;

create or replace function public.platform_feature_catalog()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  -- Any authenticated user may read the catalog (labels live in the client).
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return public.platform_default_features();
end;
$$;

grant execute on function public.platform_feature_catalog() to authenticated;

-- Resolve effective features for an organization (global defaults ⊕ global overrides ⊕ org.settings.features)
create or replace function public.resolve_org_features(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_global jsonb;
  v_org jsonb;
  v_defaults jsonb := public.platform_default_features();
begin
  select coalesce(features, '{}'::jsonb) into v_global from public.platform_settings where id = 1;
  select coalesce(settings -> 'features', '{}'::jsonb) into v_org
  from public.organizations where id = p_org;
  return v_defaults || coalesce(v_global, '{}'::jsonb) || coalesce(v_org, '{}'::jsonb);
end;
$$;

-- Current caller's effective features (tenant-aware; super admin without acting org → globals only)
create or replace function public.my_features()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid;
  v_global jsonb;
  v_defaults jsonb := public.platform_default_features();
begin
  if auth.uid() is null then
    return v_defaults;
  end if;
  begin
    v_org := public.current_org_id();
  exception when others then
    v_org := null;
  end;
  if v_org is not null then
    return public.resolve_org_features(v_org);
  end if;
  select coalesce(features, '{}'::jsonb) into v_global from public.platform_settings where id = 1;
  return v_defaults || coalesce(v_global, '{}'::jsonb);
end;
$$;

grant execute on function public.my_features() to authenticated, anon;

create or replace function public.feature_enabled(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((public.my_features() ->> p_key)::boolean, true);
$$;

grant execute on function public.feature_enabled(text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Super-admin control RPCs
-- ---------------------------------------------------------------------------
create or replace function public.get_platform_controls()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_global jsonb;
  v_orgs jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce(features, '{}'::jsonb) into v_global from public.platform_settings where id = 1;
  select coalesce(jsonb_agg(jsonb_build_object(
      'org_id', o.id,
      'slug', o.slug,
      'name_en', o.name_en,
      'status', o.status,
      'plan', o.plan,
      'features', coalesce(o.settings -> 'features', '{}'::jsonb),
      'effective', public.resolve_org_features(o.id)
    ) order by o.created_at), '[]'::jsonb)
  into v_orgs
  from public.organizations o;
  return jsonb_build_object(
    'defaults', public.platform_default_features(),
    'global', coalesce(v_global, '{}'::jsonb),
    'organizations', coalesce(v_orgs, '[]'::jsonb),
    'updated_at', (select updated_at from public.platform_settings where id = 1)
  );
end;
$$;

grant execute on function public.get_platform_controls() to authenticated;

create or replace function public.set_platform_feature(p_key text, p_enabled boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_features jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_key is null or length(trim(p_key)) < 2 then
    raise exception 'invalid feature key';
  end if;
  if not (public.platform_default_features() ? p_key) then
    raise exception 'unknown feature key: %', p_key;
  end if;

  update public.platform_settings
  set features = coalesce(features, '{}'::jsonb) || jsonb_build_object(p_key, p_enabled),
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1
  returning features into v_features;

  insert into public.platform_control_log (actor_id, scope, feature_key, enabled, note)
  values (auth.uid(), 'global', p_key, p_enabled, p_note);

  return coalesce(v_features, '{}'::jsonb);
end;
$$;

grant execute on function public.set_platform_feature(text, boolean, text) to authenticated;

create or replace function public.set_org_feature(p_org uuid, p_key text, p_enabled boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_settings jsonb;
  v_features jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not (public.platform_default_features() ? p_key) then
    raise exception 'unknown feature key: %', p_key;
  end if;

  select coalesce(settings, '{}'::jsonb) into v_settings from public.organizations where id = p_org;
  if v_settings is null then
    raise exception 'organization not found';
  end if;
  v_features := coalesce(v_settings -> 'features', '{}'::jsonb) || jsonb_build_object(p_key, p_enabled);
  v_settings := v_settings || jsonb_build_object('features', v_features);

  update public.organizations
  set settings = v_settings, updated_at = now()
  where id = p_org;

  insert into public.platform_control_log (actor_id, org_id, scope, feature_key, enabled, note)
  values (auth.uid(), p_org, 'org', p_key, p_enabled, p_note);

  return public.resolve_org_features(p_org);
end;
$$;

grant execute on function public.set_org_feature(uuid, text, boolean, text) to authenticated;

create or replace function public.clear_org_feature(p_org uuid, p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_settings jsonb;
  v_features jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce(settings, '{}'::jsonb) into v_settings from public.organizations where id = p_org;
  if v_settings is null then
    raise exception 'organization not found';
  end if;
  v_features := coalesce(v_settings -> 'features', '{}'::jsonb) - p_key;
  v_settings := v_settings || jsonb_build_object('features', v_features);
  update public.organizations set settings = v_settings, updated_at = now() where id = p_org;
  insert into public.platform_control_log (actor_id, org_id, scope, feature_key, enabled, note)
  values (auth.uid(), p_org, 'org', p_key, coalesce((public.resolve_org_features(p_org) ->> p_key)::boolean, true), 'cleared org override');
  return public.resolve_org_features(p_org);
end;
$$;

grant execute on function public.clear_org_feature(uuid, text) to authenticated;

-- Cross-tenant user directory (super admin)
create or replace function public.platform_user_directory(p_search text default null, p_limit int default 100)
returns table (
  id uuid, email text, full_name text, role text, account_type text,
  assigned_tutor_role text, is_approved boolean, org_id uuid, org_slug text, org_name text, created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select p.id, p.email, p.full_name, p.role, p.account_type, p.assigned_tutor_role, p.is_approved,
         p.org_id, o.slug, o.name_en, p.created_at
  from public.profiles p
  left join public.organizations o on o.id = p.org_id
  where p.role is distinct from 'super_admin'
    and (
      p_search is null or length(trim(p_search)) = 0
      or p.email ilike '%' || trim(p_search) || '%'
      or p.full_name ilike '%' || trim(p_search) || '%'
      or coalesce(o.slug, '') ilike '%' || trim(p_search) || '%'
    )
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

grant execute on function public.platform_user_directory(text, int) to authenticated;

create or replace function public.platform_set_user_approved(p_profile uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.profiles
  set is_approved = p_approve, updated_at = now()
  where id = p_profile and role is distinct from 'super_admin';
end;
$$;

grant execute on function public.platform_set_user_approved(uuid, boolean) to authenticated;

create or replace function public.platform_control_history(p_limit int default 50)
returns setof public.platform_control_log
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select * from public.platform_control_log
  order by created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

grant execute on function public.platform_control_history(int) to authenticated;
