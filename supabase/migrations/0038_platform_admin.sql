-- =============================================================================
-- 0038_platform_admin.sql
-- Super Admin tools that complement 0035_platform_control_plane:
--   * edit institution details; invite / revoke institution admins
--   * platform health: message delivery per channel, failures, per-college load
--   * broadcast a notice to college admins / staff / everyone
-- User editing and the audit feed come from 0035 (platform_update_user,
-- platform_audit_feed); every action here is written to audit_logs so it
-- appears in that same feed.
--
-- Also: tables created by 0035/0036 did not get the two-step-verification
-- policy from 0026. Apply "mfa: enforced" to every RLS table still missing it.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 2FA policy catch-up (idempotent; safe to re-run after later migrations)
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select c.oid::regclass as rel
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
      and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname and p.policyname = 'mfa: enforced')
  loop
    perform public.apply_mfa_policy(t.rel);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Audit helper → audit_logs (shown by platform_audit_feed)
-- ---------------------------------------------------------------------------
create or replace function public.platform_log(p_actor uuid, p_action text, p_table text, p_record uuid, p_org uuid, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (org_id, table_name, record_id, action, actor_id, actor_role, new_data)
  values (p_org, p_table, p_record::text,
          case when p_action like 'invite%' then 'INSERT' else 'UPDATE' end,
          p_actor, 'super_admin',
          jsonb_build_object('source', p_action) || coalesce(p_detail, '{}'::jsonb));
$$;
revoke execute on function public.platform_log(uuid, text, text, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.platform_log(uuid, text, text, uuid, uuid, jsonb) to service_role;

create or replace function public.platform_require_super_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only the platform super admin can do this' using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Institutions
-- ---------------------------------------------------------------------------
create or replace function public.platform_update_org(p_org uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o record;
  allowed text[] := array['name_en', 'name_ar', 'code', 'contact_email', 'contact_phone', 'address', 'country',
                          'currency', 'timezone', 'custom_domain', 'plan', 'max_students', 'admission_min_age', 'admission_max_age'];
  k text;
  v_tz text := p_patch ->> 'timezone';
begin
  perform public.platform_require_super_admin();
  select * into o from public.organizations where id = p_org for update;
  if not found then raise exception 'Institution not found'; end if;
  for k in select jsonb_object_keys(p_patch) loop
    if not (k = any (allowed)) then raise exception 'Field % cannot be edited here', k; end if;
  end loop;
  if v_tz is not null and not exists (select 1 from pg_timezone_names where name = v_tz) then
    raise exception 'Unknown time zone %', v_tz;
  end if;
  if p_patch ? 'name_en' and coalesce(trim(p_patch ->> 'name_en'), '') = '' then
    raise exception 'The English name is required';
  end if;
  if p_patch ? 'code' and (p_patch ->> 'code') !~ '^[A-Z0-9]{2,6}$' then
    raise exception 'Code must be 2–6 capital letters or digits';
  end if;
  if p_patch ? 'contact_email' and nullif(p_patch ->> 'contact_email', '') is not null
     and (p_patch ->> 'contact_email') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Contact e-mail is not valid';
  end if;

  update public.organizations set
    name_en       = coalesce(nullif(trim(p_patch ->> 'name_en'), ''), name_en),
    name_ar       = case when p_patch ? 'name_ar' then nullif(trim(p_patch ->> 'name_ar'), '') else name_ar end,
    code          = coalesce(nullif(p_patch ->> 'code', ''), code),
    contact_email = case when p_patch ? 'contact_email' then nullif(trim(p_patch ->> 'contact_email'), '') else contact_email end,
    contact_phone = case when p_patch ? 'contact_phone' then nullif(trim(p_patch ->> 'contact_phone'), '') else contact_phone end,
    address       = case when p_patch ? 'address' then nullif(trim(p_patch ->> 'address'), '') else address end,
    country       = coalesce(nullif(p_patch ->> 'country', ''), country),
    currency      = coalesce(nullif(p_patch ->> 'currency', ''), currency),
    timezone      = coalesce(v_tz, timezone),
    custom_domain = case when p_patch ? 'custom_domain' then nullif(lower(trim(p_patch ->> 'custom_domain')), '') else custom_domain end,
    plan          = coalesce(nullif(p_patch ->> 'plan', ''), plan),
    max_students  = case when p_patch ? 'max_students' then nullif(p_patch ->> 'max_students', '')::int else max_students end,
    settings      = settings
                    || case when p_patch ? 'admission_min_age' then jsonb_build_object('admission_min_age', (p_patch ->> 'admission_min_age')::int) else '{}'::jsonb end
                    || case when p_patch ? 'admission_max_age' then jsonb_build_object('admission_max_age', (p_patch ->> 'admission_max_age')::int) else '{}'::jsonb end,
    updated_at    = now()
  where id = p_org;

  perform public.platform_log(auth.uid(), 'platform_update_org', 'organizations', p_org, p_org, p_patch);
  return (select to_jsonb(x) - 'branding' from public.organizations x where id = p_org);
end $$;

create or replace function public.platform_org_invitations(p_org uuid)
returns table (id uuid, email text, full_name text, role text, account_type text, assigned_tutor_role text,
               token text, expires_at timestamptz, accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.platform_require_super_admin();
  return query
    select i.id, i.email, i.full_name, i.role, i.account_type, i.assigned_tutor_role, i.token,
           i.expires_at, i.accepted_at, i.revoked_at, i.created_at
    from public.org_invitations i where i.org_id = p_org
    order by i.created_at desc limit 100;
end $$;

create or replace function public.platform_invite_admin(p_org uuid, p_email text, p_full_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  inv record;
begin
  perform public.platform_require_super_admin();
  if not exists (select 1 from public.organizations where id = p_org) then raise exception 'Institution not found'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid e-mail'; end if;
  if exists (select 1 from public.profiles where lower(email) = v_email) then
    raise exception 'This e-mail already has an account — change its role under Users & roles instead';
  end if;
  update public.org_invitations set revoked_at = now()
  where org_id = p_org and lower(email) = v_email and accepted_at is null and revoked_at is null;
  insert into public.org_invitations (org_id, email, full_name, account_type, role, assigned_tutor_role, invited_by)
  values (p_org, v_email, nullif(trim(p_full_name), ''), 'staff', 'admin', 'none', auth.uid())
  returning * into inv;
  perform public.platform_log(auth.uid(), 'invite_admin', 'org_invitations', inv.id, p_org, jsonb_build_object('email', v_email));
  return jsonb_build_object('id', inv.id, 'email', inv.email, 'token', inv.token, 'expires_at', inv.expires_at);
end $$;

create or replace function public.platform_revoke_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  inv record;
begin
  perform public.platform_require_super_admin();
  update public.org_invitations set revoked_at = now()
  where id = p_invitation and accepted_at is null and revoked_at is null
  returning * into inv;
  if not found then raise exception 'Invitation not found or already used'; end if;
  perform public.platform_log(auth.uid(), 'revoke_invitation', 'org_invitations', p_invitation, inv.org_id, jsonb_build_object('email', inv.email));
end $$;

-- ---------------------------------------------------------------------------
-- Health
-- ---------------------------------------------------------------------------
create or replace function public.platform_health()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  perform public.platform_require_super_admin();
  select jsonb_build_object(
    'generated_at', now(),
    'outbox', coalesce((
      select jsonb_agg(jsonb_build_object('channel', channel, 'status', status, 'count', n) order by channel, status)
      from (select channel, status, count(*) n from public.message_outbox
            where created_at > now() - interval '7 days' group by channel, status) x), '[]'::jsonb),
    'stuck', (select count(*) from public.message_outbox where status = 'pending' and created_at < now() - interval '1 hour'),
    'recent_failures', coalesce((
      select jsonb_agg(f order by f.created_at desc) from (
        select m.created_at, m.channel, o.name_en as org,
               regexp_replace(coalesce(m.to_address, ''), '(.{3}).*(.{2})$', '\1•••\2') as to_masked,
               left(coalesce(m.error, ''), 200) as error, m.attempts
        from public.message_outbox m left join public.organizations o on o.id = m.org_id
        where m.status = 'failed' order by m.created_at desc limit 25) f), '[]'::jsonb),
    'colleges', coalesce((
      select jsonb_agg(c order by c.name_en) from (
        select o.id, o.name_en, o.status,
               (select count(*) from public.profiles p where p.org_id = o.id and not p.is_approved and p.account_type in ('student', 'tutor', 'staff')) as pending_approvals,
               (select count(*) from public.profiles p where p.org_id = o.id and p.created_at > now() - interval '7 days') as new_users_7d,
               (select count(*) from public.message_outbox m where m.org_id = o.id and m.status = 'failed' and m.created_at > now() - interval '7 days') as failed_messages_7d,
               (select count(*) from public.org_invitations i where i.org_id = o.id and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()) as open_invitations
        from public.organizations o) c), '[]'::jsonb)
  ) into v;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Broadcast
-- ---------------------------------------------------------------------------
create or replace function public.platform_broadcast(p_title text, p_message text, p_audience text default 'admins', p_orgs uuid[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  perform public.platform_require_super_admin();
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_message), '') = '' then
    raise exception 'Title and message are required';
  end if;
  if p_audience not in ('admins', 'staff', 'everyone') then raise exception 'Unknown audience'; end if;
  insert into public.notifications (user_id, title, message, data, org_id)
  select p.id, left(trim(p_title), 200), left(trim(p_message), 4000), jsonb_build_object('type', 'platform_broadcast'), p.org_id
  from public.profiles p
  join public.organizations o on o.id = p.org_id and o.status in ('trial', 'active')
  where p.role is distinct from 'super_admin'
    and (p_orgs is null or cardinality(p_orgs) = 0 or p.org_id = any (p_orgs))
    and case p_audience
          when 'admins' then p.role = 'admin'
          when 'staff' then p.role = 'admin' or (p.is_approved and p.account_type in ('tutor', 'staff'))
          else p.is_approved or p.account_type in ('guest', 'parent')
        end;
  get diagnostics n = row_count;
  perform public.platform_log(auth.uid(), 'platform_broadcast', 'notifications', null, null,
    jsonb_build_object('title', p_title, 'audience', p_audience, 'orgs', p_orgs, 'recipients', n));
  return n;
end $$;

grant execute on function
  public.platform_update_org(uuid, jsonb),
  public.platform_org_invitations(uuid),
  public.platform_invite_admin(uuid, text, text),
  public.platform_revoke_invitation(uuid),
  public.platform_health(),
  public.platform_broadcast(text, text, text, uuid[])
to authenticated;
