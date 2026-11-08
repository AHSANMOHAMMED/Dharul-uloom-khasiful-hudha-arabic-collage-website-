-- =============================================================================
-- 0026_security_mfa.sql
-- Two-factor authentication (TOTP) enforced in the database, not just the UI.
--
--   * A user who has enrolled a verified factor must present an aal2 session.
--     An aal1 token (password only) is treated as unprivileged everywhere:
--       - every permission helper (is_admin, has_staff_role, …) returns false,
--         so SECURITY DEFINER RPCs refuse privileged work, and
--       - a RESTRICTIVE policy on every RLS table denies row access
--         (except reading one's own profile, so the app can ask for the code).
--   * Organisations can require 2FA for privileged staff
--     (admins + treasurer/accountant/principal/VP/exam officer/HR). Such users
--     are locked out of privileged data until they enrol and verify.
--   * The requirement can only be switched on from an aal2 session, so an
--     admin cannot lock themselves out by enabling it before enrolling.
-- =============================================================================

alter table public.organizations
  add column if not exists require_mfa_for_staff boolean not null default false;

-- Roles whose holders handle money, exams or personnel records.
create or replace function public.mfa_sensitive_roles()
returns text[] language sql immutable as $$
  select array['treasurer', 'accountant', 'principal', 'vice_principal', 'exam_officer', 'hr_manager'];
$$;

-- Does the caller's organisation require them to use 2FA?
-- Reads profiles directly (no helper calls) to avoid recursion with mfa_ok().
create or replace function public.mfa_required()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select o.require_mfa_for_staff
       and (p.role in ('admin', 'super_admin')
            or (p.is_approved and p.account_type in ('tutor', 'staff')
                and (p.assigned_tutor_role = any (public.mfa_sensitive_roles())
                     or coalesce(p.extra_roles, '{}') && public.mfa_sensitive_roles())))
    from public.profiles p
    join public.organizations o on o.id = p.org_id
    where p.id = auth.uid()
  ), false);
$$;

create or replace function public.mfa_has_verified_factor()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from auth.mfa_factors f
    where f.user_id = auth.uid() and f.status::text = 'verified'
  );
$$;

-- True when the current session satisfies the caller's 2FA obligations.
-- Anonymous and service-role callers have no auth.uid() and are unaffected.
create or replace function public.mfa_ok()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select case
    when auth.uid() is null then true
    when coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' then true
    when public.mfa_has_verified_factor() then false
    when public.mfa_required() then false
    else true
  end;
$$;

-- What the UI needs to decide between "enter code", "set up 2FA" and "ok".
create or replace function public.my_mfa_status()
returns jsonb language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1'),
    'has_factor', public.mfa_has_verified_factor(),
    'required', public.mfa_required(),
    'ok', public.mfa_ok()
  );
$$;

grant execute on function public.mfa_ok(), public.mfa_required(), public.mfa_has_verified_factor(),
  public.my_mfa_status(), public.mfa_sensitive_roles() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Permission helpers: same logic as before, plus the 2FA gate.
-- (Composite helpers such as is_finance_staff call these, so they inherit it.)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.mfa_ok()
     and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'));
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.mfa_ok()
     and exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin');
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.mfa_ok()
     and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'));
$$;

create or replace function public.has_staff_role(p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_approved
      and account_type in ('tutor', 'staff')
      and (assigned_tutor_role = any (p_roles) or extra_roles && p_roles)
  );
$$;

create or replace function public.is_employee()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.mfa_ok() and exists (
    select 1 from public.profiles
    where id = auth.uid() and account_type in ('tutor', 'staff') and is_approved
  ));
$$;

create or replace function public.is_tutor()
returns boolean language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and exists (
    select 1 from public.profiles
    where id = auth.uid() and account_type = 'tutor' and is_approved
  );
$$;

create or replace function public.is_library_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select (public.mfa_ok()
          and exists (select 1 from public.profiles where id = auth.uid() and role in ('librarian', 'admin', 'super_admin')))
      or public.has_staff_role(array['librarian']);
$$;

create or replace function public.has_duty(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and exists (
    select 1 from public.duty_assignments a
    join public.duty_roles r on r.id = a.duty_role_id
    where a.assignee_id = auth.uid() and a.status = 'active' and r.code = p_code
      and a.org_id = public.current_org_id());
$$;

create or replace function public.has_leave_review_duty()
returns boolean language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and exists (
    select 1 from public.duty_assignments a
    join public.duty_roles r on r.id = a.duty_role_id
    where a.assignee_id = auth.uid() and a.status = 'active' and r.grants_leave_review
      and a.org_id = public.current_org_id());
$$;

create or replace function public.is_parent_of(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.mfa_ok() and exists (
    select 1 from public.parent_children
    where parent_id = auth.uid() and child_id = p_student_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Restrictive policy on every RLS-enabled table in public. Restrictive
-- policies are AND-ed with the existing permissive ones, so they can only
-- remove access, never grant it.
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists "mfa: enforced" on public.%I', t.relname);
    if t.relname = 'profiles' then
      -- Own profile stays readable so the app can show the 2FA prompt.
      execute 'create policy "mfa: enforced" on public.profiles as restrictive for all to authenticated
               using ((select public.mfa_ok()) or id = (select auth.uid()))
               with check ((select public.mfa_ok()))';
    else
      execute format('create policy "mfa: enforced" on public.%I as restrictive for all to authenticated
                      using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t.relname);
    end if;
  end loop;
end $$;

-- Tables created by later migrations must call this to stay covered.
create or replace function public.apply_mfa_policy(p_table regclass)
returns void language plpgsql security definer set search_path = public as $$
begin
  execute format('drop policy if exists "mfa: enforced" on %s', p_table);
  execute format('create policy "mfa: enforced" on %s as restrictive for all to authenticated
                  using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', p_table);
end $$;
revoke execute on function public.apply_mfa_policy(regclass) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Turning the requirement on needs an aal2 session (or the service role).
-- ---------------------------------------------------------------------------
create or replace function public.tg_org_mfa_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.require_mfa_for_staff and not coalesce(old.require_mfa_for_staff, false)
     and auth.uid() is not null
     and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Enable two-factor authentication on your own account before requiring it for staff'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists org_mfa_guard on public.organizations;
create trigger org_mfa_guard before update of require_mfa_for_staff on public.organizations
  for each row execute function public.tg_org_mfa_guard();
