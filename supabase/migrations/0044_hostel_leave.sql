-- Hostel overnight leave passes + overdue tracking.
set search_path = public, extensions, pg_temp;

create table if not exists public.hostel_leave_passes (
  id                uuid primary key default extensions.gen_random_uuid(),
  org_id            uuid not null references public.organizations (id),
  student_id        uuid not null references public.profiles (id) on delete restrict,
  allocation_id     uuid references public.hostel_allocations (id) on delete set null,
  depart_at         timestamptz not null,
  return_by         timestamptz not null,
  actual_return_at  timestamptz,
  destination       text,
  reason            text not null,
  status            text not null default 'approved'
                    check (status in ('approved', 'out', 'returned', 'overdue', 'cancelled')),
  approved_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  check (return_by > depart_at)
);
create index if not exists idx_hostel_leave_student on public.hostel_leave_passes (student_id, return_by desc);
create index if not exists idx_hostel_leave_status on public.hostel_leave_passes (org_id, status);

alter table public.hostel_leave_passes enable row level security;
drop policy if exists "hostel_leave: read" on public.hostel_leave_passes;
create policy "hostel_leave: read" on public.hostel_leave_passes for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (public.is_employee() or student_id = auth.uid() or public.is_parent_of(student_id))
  );
drop policy if exists "hostel_leave: no direct write" on public.hostel_leave_passes;
create policy "hostel_leave: no direct write" on public.hostel_leave_passes for all to authenticated
  using (false) with check (false);

select public.apply_tenant_scope('hostel_leave_passes', 'student_id');
select public.apply_mfa_policy('hostel_leave_passes'::regclass);
select public.attach_audit('hostel_leave_passes');

create or replace function public.approve_hostel_leave(
  p_student uuid,
  p_depart_at timestamptz,
  p_return_by timestamptz,
  p_reason text,
  p_destination text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_alloc uuid;
  v_id uuid;
begin
  if not (public.is_admin() or public.has_staff_role(array['warden', 'principal', 'vice_principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;
  if p_return_by <= p_depart_at then
    raise exception 'Return time must be after departure';
  end if;
  if not exists (select 1 from public.profiles where id = p_student and org_id = v_org and account_type = 'student') then
    raise exception 'Student not found';
  end if;

  select id into v_alloc from public.hostel_allocations
  where student_id = p_student and org_id = v_org and status = 'active' limit 1;
  if v_alloc is null then
    raise exception 'Student has no active hostel allocation';
  end if;

  if exists (
    select 1 from public.hostel_leave_passes
    where student_id = p_student and org_id = v_org and status in ('approved', 'out', 'overdue')
  ) then
    raise exception 'Student already has an open leave pass';
  end if;

  insert into public.hostel_leave_passes (
    org_id, student_id, allocation_id, depart_at, return_by, reason, destination, status, approved_by
  ) values (
    v_org, p_student, v_alloc, p_depart_at, p_return_by, p_reason, p_destination,
    case when p_depart_at <= now() then 'out' else 'approved' end,
    auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.mark_hostel_leave_return(p_leave uuid, p_returned_at timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l record;
begin
  if not (public.is_admin() or public.has_staff_role(array['warden', 'principal', 'vice_principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into l from public.hostel_leave_passes
  where id = p_leave and org_id = public.current_org_id() for update;
  if not found then raise exception 'Leave pass not found'; end if;
  if l.status = 'returned' then
    return jsonb_build_object('ok', true, 'status', 'returned');
  end if;
  if l.status = 'cancelled' then
    raise exception 'Leave pass was cancelled';
  end if;

  update public.hostel_leave_passes
  set status = 'returned', actual_return_at = coalesce(p_returned_at, now())
  where id = l.id;

  return jsonb_build_object('ok', true, 'status', 'returned');
end;
$$;

create or replace function public.refresh_hostel_leave_overdue()
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  update public.hostel_leave_passes
  set status = 'overdue'
  where org_id = public.current_org_id()
    and status in ('approved', 'out')
    and return_by < now()
    and actual_return_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.list_hostel_leave_overdue()
returns setof public.hostel_leave_passes
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.has_staff_role(array['warden', 'principal', 'vice_principal']) or public.is_employee()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public.refresh_hostel_leave_overdue();
  return query
    select * from public.hostel_leave_passes
    where org_id = public.current_org_id() and status = 'overdue'
    order by return_by;
end;
$$;

grant execute on function public.approve_hostel_leave(uuid, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.mark_hostel_leave_return(uuid, timestamptz) to authenticated;
grant execute on function public.refresh_hostel_leave_overdue() to authenticated;
grant execute on function public.list_hostel_leave_overdue() to authenticated;
