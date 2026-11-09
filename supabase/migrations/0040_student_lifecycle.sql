-- Student lifecycle: audited status transitions (never delete to mean exit).
set search_path = public, extensions, pg_temp;

create table if not exists public.student_lifecycle_events (
  id           uuid primary key default extensions.gen_random_uuid(),
  org_id       uuid not null references public.organizations (id),
  student_id   uuid not null references public.profiles (id) on delete restrict,
  from_status  text,
  to_status    text not null
               check (to_status in ('active', 'suspended', 'graduated', 'withdrawn', 'transferred', 'alumni')),
  reason       text not null,
  evidence     jsonb not null default '{}'::jsonb,
  actor_id     uuid references public.profiles (id) on delete set null default auth.uid(),
  approved_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_student_lifecycle_student on public.student_lifecycle_events (student_id, created_at desc);
create index if not exists idx_student_lifecycle_org on public.student_lifecycle_events (org_id, created_at desc);

alter table public.student_lifecycle_events enable row level security;
drop policy if exists "lifecycle: read" on public.student_lifecycle_events;
create policy "lifecycle: read" on public.student_lifecycle_events for select to authenticated
  using (org_id = (select public.current_org_id()) and (public.is_employee() or student_id = auth.uid() or public.is_parent_of(student_id)));
drop policy if exists "lifecycle: no direct write" on public.student_lifecycle_events;
create policy "lifecycle: no direct write" on public.student_lifecycle_events for all to authenticated
  using (false) with check (false);

select public.apply_tenant_scope('student_lifecycle_events', 'student_id');
select public.apply_mfa_policy('student_lifecycle_events'::regclass);
select public.attach_audit('student_lifecycle_events');

create or replace function public.transition_student_status(
  p_student uuid,
  p_to_status text,
  p_reason text,
  p_evidence jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_from text;
  v_allowed boolean := false;
begin
  if not (public.is_admin() or public.has_staff_role(array['principal', 'vice_principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;
  if p_to_status not in ('active', 'suspended', 'graduated', 'withdrawn', 'transferred', 'alumni') then
    raise exception 'Invalid status';
  end if;
  if not exists (select 1 from public.profiles where id = p_student and org_id = v_org and account_type = 'student') then
    raise exception 'Student not found';
  end if;

  select coalesce(status, 'active') into v_from
  from public.student_details where profile_id = p_student;
  if not found then
    insert into public.student_details (profile_id, org_id, status, status_reason)
    values (p_student, v_org, 'active', null)
    on conflict (profile_id) do nothing;
    v_from := 'active';
  end if;

  if v_from = p_to_status then
    return jsonb_build_object('ok', true, 'status', v_from, 'unchanged', true);
  end if;

  v_allowed :=
    (v_from = 'active' and p_to_status in ('suspended', 'withdrawn', 'transferred', 'graduated', 'alumni'))
    or (v_from = 'suspended' and p_to_status in ('active', 'withdrawn'))
    or (v_from = 'alumni' and p_to_status = 'active'); -- rare re-enrolment

  if not v_allowed then
    raise exception 'Transition from % to % is not allowed', v_from, p_to_status;
  end if;

  update public.student_details
  set status = p_to_status, status_reason = p_reason, updated_at = now()
  where profile_id = p_student;

  insert into public.student_lifecycle_events (org_id, student_id, from_status, to_status, reason, evidence, actor_id, approved_by)
  values (v_org, p_student, v_from, p_to_status, p_reason, coalesce(p_evidence, '{}'::jsonb), auth.uid(), auth.uid());

  -- End open hostel beds on exit/transfer; do not touch paid fee receipts.
  if p_to_status in ('withdrawn', 'transferred', 'graduated', 'alumni') then
    update public.hostel_allocations
    set status = 'ended', end_date = coalesce(end_date, current_date)
    where student_id = p_student and org_id = v_org and status = 'active';
  end if;

  return jsonb_build_object('ok', true, 'from', v_from, 'to', p_to_status);
end;
$$;

grant execute on function public.transition_student_status(uuid, text, text, jsonb) to authenticated;
