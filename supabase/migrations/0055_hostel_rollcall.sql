-- Hostel emergency / scheduled roll-call.
set search_path = public, extensions, pg_temp;

create table if not exists public.hostel_rollcalls (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  hostel_id     uuid references public.hostels (id) on delete set null,
  kind          text not null default 'emergency'
                check (kind in ('scheduled', 'emergency', 'drill')),
  status        text not null default 'open'
                check (status in ('open', 'closed', 'cancelled')),
  started_at    timestamptz not null default now(),
  closed_at     timestamptz,
  started_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  closed_by     uuid references public.profiles (id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_hostel_rollcalls_org on public.hostel_rollcalls (org_id, started_at desc);

create table if not exists public.hostel_rollcall_marks (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  rollcall_id   uuid not null references public.hostel_rollcalls (id) on delete cascade,
  student_id    uuid not null references public.profiles (id) on delete restrict,
  allocation_id uuid references public.hostel_allocations (id) on delete set null,
  status        text not null default 'pending'
                check (status in ('pending', 'present', 'absent', 'on_leave', 'excused')),
  marked_at     timestamptz,
  marked_by     uuid references public.profiles (id) on delete set null,
  notes         text,
  unique (rollcall_id, student_id)
);
create index if not exists idx_hostel_rollcall_marks_roll on public.hostel_rollcall_marks (rollcall_id, status);

alter table public.hostel_rollcalls enable row level security;
alter table public.hostel_rollcall_marks enable row level security;

drop policy if exists "hostel_rollcalls: read" on public.hostel_rollcalls;
create policy "hostel_rollcalls: read" on public.hostel_rollcalls for select to authenticated
  using (org_id = (select public.current_org_id()) and public.is_employee());
drop policy if exists "hostel_rollcalls: no direct write" on public.hostel_rollcalls;
create policy "hostel_rollcalls: no direct write" on public.hostel_rollcalls for all to authenticated
  using (false) with check (false);

drop policy if exists "hostel_rollcall_marks: read" on public.hostel_rollcall_marks;
create policy "hostel_rollcall_marks: read" on public.hostel_rollcall_marks for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (public.is_employee() or student_id = auth.uid() or public.is_parent_of(student_id))
  );
drop policy if exists "hostel_rollcall_marks: no direct write" on public.hostel_rollcall_marks;
create policy "hostel_rollcall_marks: no direct write" on public.hostel_rollcall_marks for all to authenticated
  using (false) with check (false);

select public.apply_tenant_scope('hostel_rollcalls');
select public.apply_tenant_scope('hostel_rollcall_marks', 'student_id');
select public.apply_mfa_policy('hostel_rollcalls'::regclass);
select public.apply_mfa_policy('hostel_rollcall_marks'::regclass);
select public.attach_audit('hostel_rollcalls');
select public.attach_audit('hostel_rollcall_marks');

create or replace function public.start_hostel_rollcall(
  p_hostel uuid default null,
  p_kind text default 'emergency',
  p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_id uuid;
  v_kind text := coalesce(nullif(trim(p_kind), ''), 'emergency');
begin
  if not (public.is_admin() or public.has_staff_role(array['warden', 'principal', 'vice_principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_kind not in ('scheduled', 'emergency', 'drill') then
    raise exception 'Invalid roll-call kind';
  end if;
  if exists (
    select 1 from public.hostel_rollcalls
    where org_id = v_org and status = 'open'
      and (p_hostel is null or hostel_id is not distinct from p_hostel)
  ) then
    raise exception 'An open roll-call already exists for this hostel';
  end if;

  insert into public.hostel_rollcalls (org_id, hostel_id, kind, notes, started_by)
  values (v_org, p_hostel, v_kind, p_notes, auth.uid())
  returning id into v_id;

  insert into public.hostel_rollcall_marks (org_id, rollcall_id, student_id, allocation_id, status)
  select v_org, v_id, a.student_id, a.id,
         case when exists (
           select 1 from public.hostel_leave_passes lp
           where lp.student_id = a.student_id and lp.org_id = v_org
             and lp.status in ('approved', 'out', 'overdue')
         ) then 'on_leave' else 'pending' end
  from public.hostel_allocations a
  join public.hostel_rooms r on r.id = a.room_id
  where a.org_id = v_org and a.status = 'active'
    and (p_hostel is null or r.hostel_id = p_hostel);

  return v_id;
end;
$$;

create or replace function public.mark_hostel_rollcall(
  p_rollcall uuid, p_student uuid, p_status text, p_notes text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_status text := lower(trim(p_status));
begin
  if not (public.is_admin() or public.has_staff_role(array['warden', 'principal', 'vice_principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_status not in ('present', 'absent', 'on_leave', 'excused', 'pending') then
    raise exception 'Invalid mark status';
  end if;
  select * into r from public.hostel_rollcalls
  where id = p_rollcall and org_id = public.current_org_id() for update;
  if not found then raise exception 'Roll-call not found'; end if;
  if r.status <> 'open' then raise exception 'Roll-call is not open'; end if;

  update public.hostel_rollcall_marks
  set status = v_status, notes = p_notes, marked_at = now(), marked_by = auth.uid()
  where rollcall_id = p_rollcall and student_id = p_student and org_id = r.org_id;
  if not found then raise exception 'Student not on this roll-call'; end if;

  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

create or replace function public.close_hostel_rollcall(p_rollcall uuid, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_pending int;
begin
  if not (public.is_admin() or public.has_staff_role(array['warden', 'principal', 'vice_principal'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.hostel_rollcalls
  where id = p_rollcall and org_id = public.current_org_id() for update;
  if not found then raise exception 'Roll-call not found'; end if;
  if r.status <> 'open' then
    return jsonb_build_object('ok', true, 'status', r.status);
  end if;
  select count(*) into v_pending from public.hostel_rollcall_marks
  where rollcall_id = p_rollcall and status = 'pending';
  update public.hostel_rollcalls
  set status = 'closed', closed_at = now(), closed_by = auth.uid(),
      notes = coalesce(nullif(trim(p_notes), ''), notes)
  where id = p_rollcall;
  return jsonb_build_object('ok', true, 'status', 'closed', 'pending_left', v_pending);
end;
$$;

create or replace function public.hostel_rollcall_snapshot(p_rollcall uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r record;
begin
  if not (public.is_admin() or public.has_staff_role(array['warden', 'principal', 'vice_principal', 'teacher'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.hostel_rollcalls
  where id = p_rollcall and org_id = public.current_org_id();
  if not found then raise exception 'Roll-call not found'; end if;
  return jsonb_build_object(
    'rollcall', to_jsonb(r),
    'marks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'student_id', m.student_id, 'status', m.status, 'notes', m.notes,
        'marked_at', m.marked_at,
        'full_name', p.full_name, 'index_number', p.index_number,
        'emergency_contact', sd.emergency_contact, 'phone', p.phone
      ) order by p.full_name)
      from public.hostel_rollcall_marks m
      join public.profiles p on p.id = m.student_id
      left join public.student_details sd on sd.profile_id = p.id
      where m.rollcall_id = p_rollcall
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.start_hostel_rollcall(uuid, text, text) to authenticated;
grant execute on function public.mark_hostel_rollcall(uuid, uuid, text, text) to authenticated;
grant execute on function public.close_hostel_rollcall(uuid, text) to authenticated;
grant execute on function public.hostel_rollcall_snapshot(uuid) to authenticated;
