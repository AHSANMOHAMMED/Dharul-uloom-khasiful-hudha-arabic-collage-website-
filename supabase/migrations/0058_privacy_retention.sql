-- Org-editable privacy retention settings (no counsel-approved legal defaults).
set search_path = public, extensions, pg_temp;

create table if not exists public.org_privacy_retention (
  org_id            uuid primary key references public.organizations (id) on delete cascade,
  identity_days     int check (identity_days is null or identity_days >= 0),
  guardian_days     int check (guardian_days is null or guardian_days >= 0),
  academic_days     int check (academic_days is null or academic_days >= 0),
  financial_days    int check (financial_days is null or financial_days >= 0),
  welfare_days      int check (welfare_days is null or welfare_days >= 0),
  hostel_days       int check (hostel_days is null or hostel_days >= 0),
  comms_days        int check (comms_days is null or comms_days >= 0),
  auth_days         int check (auth_days is null or auth_days >= 0),
  notes             text,
  policy_signed_off boolean not null default false,
  updated_by        uuid references public.profiles (id) on delete set null,
  updated_at        timestamptz not null default now()
);

alter table public.org_privacy_retention enable row level security;
drop policy if exists "privacy_retention: read" on public.org_privacy_retention;
create policy "privacy_retention: read" on public.org_privacy_retention for select to authenticated
  using (org_id = (select public.current_org_id()) and (public.is_admin() or public.is_super_admin()));
drop policy if exists "privacy_retention: no direct write" on public.org_privacy_retention;
create policy "privacy_retention: no direct write" on public.org_privacy_retention for all to authenticated
  using (false) with check (false);

select public.apply_tenant_scope('org_privacy_retention');
select public.attach_audit('org_privacy_retention');

create or replace function public.upsert_privacy_retention(p_settings jsonb)
returns public.org_privacy_retention
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  r public.org_privacy_retention;
begin
  if not (public.is_admin() or public.is_super_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not public.mfa_ok() then
    raise exception 'MFA required' using errcode = '42501';
  end if;

  insert into public.org_privacy_retention as t (
    org_id, identity_days, guardian_days, academic_days, financial_days,
    welfare_days, hostel_days, comms_days, auth_days, notes, policy_signed_off, updated_by, updated_at
  ) values (
    v_org,
    nullif(p_settings->>'identity_days', '')::int,
    nullif(p_settings->>'guardian_days', '')::int,
    nullif(p_settings->>'academic_days', '')::int,
    nullif(p_settings->>'financial_days', '')::int,
    nullif(p_settings->>'welfare_days', '')::int,
    nullif(p_settings->>'hostel_days', '')::int,
    nullif(p_settings->>'comms_days', '')::int,
    nullif(p_settings->>'auth_days', '')::int,
    nullif(trim(coalesce(p_settings->>'notes', '')), ''),
    coalesce((p_settings->>'policy_signed_off')::boolean, false),
    auth.uid(),
    now()
  )
  on conflict (org_id) do update set
    identity_days = excluded.identity_days,
    guardian_days = excluded.guardian_days,
    academic_days = excluded.academic_days,
    financial_days = excluded.financial_days,
    welfare_days = excluded.welfare_days,
    hostel_days = excluded.hostel_days,
    comms_days = excluded.comms_days,
    auth_days = excluded.auth_days,
    notes = excluded.notes,
    policy_signed_off = excluded.policy_signed_off,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into r;
  return r;
end;
$$;

revoke all on function public.upsert_privacy_retention(jsonb) from public, anon;
grant execute on function public.upsert_privacy_retention(jsonb) to authenticated;

select public.apply_mfa_policy('org_privacy_retention'::regclass);
