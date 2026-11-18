-- Time-boxed break-glass elevated access (policy gate required before production use).
set search_path = public, extensions, pg_temp;

create table if not exists public.break_glass_requests (
  id              uuid primary key default extensions.gen_random_uuid(),
  org_id          uuid not null references public.organizations (id),
  requester_id    uuid not null references public.profiles (id) on delete restrict default auth.uid(),
  reason          text not null,
  scope           text not null default 'read_student_records'
                  check (scope in ('read_student_records', 'read_finance', 'read_welfare', 'read_all')),
  target_student  uuid references public.profiles (id) on delete set null,
  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'denied', 'expired', 'revoked')),
  approver_id     uuid references public.profiles (id) on delete set null,
  approved_at     timestamptz,
  expires_at      timestamptz,
  decision_notes  text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_break_glass_org on public.break_glass_requests (org_id, status, created_at desc);

alter table public.break_glass_requests enable row level security;
drop policy if exists "break_glass: read" on public.break_glass_requests;
create policy "break_glass: read" on public.break_glass_requests for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (requester_id = auth.uid() or public.is_admin() or public.is_super_admin())
  );
drop policy if exists "break_glass: no direct write" on public.break_glass_requests;
create policy "break_glass: no direct write" on public.break_glass_requests for all to authenticated
  using (false) with check (false);

select public.apply_tenant_scope('break_glass_requests');
select public.apply_mfa_policy('break_glass_requests'::regclass);
select public.attach_audit('break_glass_requests');

create or replace function public.request_break_glass(
  p_reason text,
  p_scope text default 'read_student_records',
  p_target_student uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_org uuid := public.current_org_id();
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if not public.is_employee() then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  if p_scope not in ('read_student_records', 'read_finance', 'read_welfare', 'read_all') then
    raise exception 'Invalid scope';
  end if;

  insert into public.break_glass_requests (org_id, requester_id, reason, scope, target_student)
  values (v_org, auth.uid(), trim(p_reason), p_scope, p_target_student)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.decide_break_glass(
  p_request uuid,
  p_approve boolean,
  p_hours int default 4,
  p_notes text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_hours int := greatest(coalesce(p_hours, 4), 1);
begin
  if not (public.is_admin() or public.is_super_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not public.mfa_ok() then
    raise exception 'MFA required' using errcode = '42501';
  end if;
  select * into r from public.break_glass_requests
  where id = p_request and org_id = public.current_org_id() for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'Request is not pending'; end if;

  if p_approve then
    update public.break_glass_requests
    set status = 'approved',
        approver_id = auth.uid(),
        approved_at = now(),
        expires_at = now() + make_interval(hours => least(v_hours, 24)),
        decision_notes = p_notes
    where id = p_request;
    return jsonb_build_object('ok', true, 'status', 'approved', 'expires_at', now() + make_interval(hours => least(v_hours, 24)));
  end if;

  update public.break_glass_requests
  set status = 'denied', approver_id = auth.uid(), approved_at = now(), decision_notes = p_notes
  where id = p_request;
  return jsonb_build_object('ok', true, 'status', 'denied');
end;
$$;

create or replace function public.expire_break_glass()
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not public.is_privileged_caller() and not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  with upd as (
    update public.break_glass_requests
    set status = 'expired'
    where status = 'approved' and expires_at < now()
    returning 1
  )
  select count(*)::int into v_n from upd;
  return coalesce(v_n, 0);
end;
$$;

create or replace function public.has_active_break_glass(p_scope text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.break_glass_requests
    where requester_id = auth.uid()
      and org_id = public.current_org_id()
      and status = 'approved'
      and expires_at > now()
      and (p_scope is null or scope = p_scope or scope = 'read_all')
  );
$$;

grant execute on function public.request_break_glass(text, text, uuid) to authenticated;
grant execute on function public.decide_break_glass(uuid, boolean, int, text) to authenticated;
grant execute on function public.expire_break_glass() to authenticated;
grant execute on function public.has_active_break_glass(text) to authenticated;
