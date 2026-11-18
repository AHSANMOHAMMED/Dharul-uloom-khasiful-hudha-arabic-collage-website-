-- Purpose-level notification consent flags + quiet hours on org settings.
set search_path = public, extensions, pg_temp;

alter table public.profiles
  add column if not exists notify_purpose_fees boolean not null default true,
  add column if not exists notify_purpose_attendance boolean not null default true,
  add column if not exists notify_purpose_results boolean not null default true,
  add column if not exists notify_purpose_marketing boolean not null default false;

create or replace function public.set_notify_purposes(
  p_fees boolean default null,
  p_attendance boolean default null,
  p_results boolean default null,
  p_marketing boolean default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.profiles set
    notify_purpose_fees = coalesce(p_fees, notify_purpose_fees),
    notify_purpose_attendance = coalesce(p_attendance, notify_purpose_attendance),
    notify_purpose_results = coalesce(p_results, notify_purpose_results),
    notify_purpose_marketing = coalesce(p_marketing, notify_purpose_marketing)
  where id = auth.uid();
end;
$$;

-- Gate outbox enqueue for purpose-tagged messages (metadata.purpose).
create or replace function public.purpose_notify_allowed(p_user uuid, p_purpose text)
returns boolean language sql stable security definer set search_path = public as $$
  select case coalesce(p_purpose, 'general')
    when 'fees' then coalesce((select notify_purpose_fees from public.profiles where id = p_user), true)
    when 'attendance' then coalesce((select notify_purpose_attendance from public.profiles where id = p_user), true)
    when 'results' then coalesce((select notify_purpose_results from public.profiles where id = p_user), true)
    when 'marketing' then coalesce((select notify_purpose_marketing from public.profiles where id = p_user), false)
    else true
  end;
$$;

create or replace function public.set_org_quiet_hours(
  p_start_hour int,
  p_end_hour int,
  p_tz text default 'Asia/Colombo'
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_settings jsonb;
begin
  if not (public.is_admin() or public.is_super_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_start_hour is null or p_end_hour is null
     or p_start_hour < 0 or p_start_hour > 23
     or p_end_hour < 0 or p_end_hour > 23 then
    raise exception 'Hours must be 0–23';
  end if;
  select settings into v_settings from public.organizations where id = v_org for update;
  v_settings := coalesce(v_settings, '{}'::jsonb)
    || jsonb_build_object(
      'quiet_hours', jsonb_build_object(
        'start_hour', p_start_hour,
        'end_hour', p_end_hour,
        'tz', coalesce(nullif(trim(p_tz), ''), 'Asia/Colombo')
      )
    );
  update public.organizations set settings = v_settings where id = v_org;
end;
$$;

revoke all on function public.set_notify_purposes(boolean, boolean, boolean, boolean) from public, anon;
revoke all on function public.purpose_notify_allowed(uuid, text) from public, anon, authenticated;
revoke all on function public.set_org_quiet_hours(int, int, text) from public, anon;
grant execute on function public.set_notify_purposes(boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.set_org_quiet_hours(int, int, text) to authenticated;
grant execute on function public.purpose_notify_allowed(uuid, text) to service_role;
