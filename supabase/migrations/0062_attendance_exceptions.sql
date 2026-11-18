-- Attendance session exceptions (late / excused / corrected / substitute) with audit.
set search_path = public, extensions, pg_temp;

create table if not exists public.attendance_sessions (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  class_number  int not null check (class_number between 1 and 12),
  session_date  date not null,
  period_label  text not null default 'day',
  subject       text,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  unique (org_id, class_number, session_date, period_label)
);

create table if not exists public.attendance_exceptions (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  attendance_id uuid references public.attendance (id) on delete set null,
  student_id    uuid not null references public.profiles (id) on delete restrict,
  session_id    uuid references public.attendance_sessions (id) on delete set null,
  session_date  date not null,
  kind          text not null check (kind in ('late', 'excused', 'corrected', 'substitute')),
  from_status   text,
  to_status     text not null,
  reason        text not null,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);
create index if not exists idx_att_exc_org on public.attendance_exceptions (org_id, session_date desc);

alter table public.attendance_sessions enable row level security;
alter table public.attendance_exceptions enable row level security;

drop policy if exists "att_sessions: read" on public.attendance_sessions;
create policy "att_sessions: read" on public.attendance_sessions for select to authenticated
  using (org_id = (select public.current_org_id()) and public.is_employee());
drop policy if exists "att_sessions: no direct write" on public.attendance_sessions;
create policy "att_sessions: no direct write" on public.attendance_sessions for all to authenticated
  using (false) with check (false);

drop policy if exists "att_exc: read" on public.attendance_exceptions;
create policy "att_exc: read" on public.attendance_exceptions for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (public.is_employee() or student_id = auth.uid() or public.is_parent_of(student_id))
  );
drop policy if exists "att_exc: no direct write" on public.attendance_exceptions;
create policy "att_exc: no direct write" on public.attendance_exceptions for all to authenticated
  using (false) with check (false);

select public.apply_tenant_scope('attendance_sessions');
select public.apply_tenant_scope('attendance_exceptions');
select public.attach_audit('attendance_exceptions');

create or replace function public.correct_attendance(
  p_student uuid,
  p_date date,
  p_to_status text,
  p_kind text,
  p_reason text,
  p_class int default null,
  p_period text default 'day'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_att record;
  v_session uuid;
  v_exc uuid;
  v_from text;
begin
  if not public.is_employee() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_to_status not in ('present', 'absent', 'late', 'excused') then
    raise exception 'Invalid status';
  end if;
  if p_kind not in ('late', 'excused', 'corrected', 'substitute') then
    raise exception 'Invalid exception kind';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Reason required'; end if;

  select * into v_att from public.attendance
  where student_id = p_student and date = p_date for update;
  v_from := v_att.status;

  if found then
    update public.attendance set
      status = p_to_status,
      excuse_note = case when p_kind in ('excused', 'corrected') then trim(p_reason) else excuse_note end,
      marked_by = auth.uid()
    where id = v_att.id;
  else
    insert into public.attendance (student_id, date, status, excuse_note, marked_by, org_id)
    values (p_student, p_date, p_to_status, trim(p_reason), auth.uid(), v_org)
    returning * into v_att;
  end if;

  if p_class is not null then
    insert into public.attendance_sessions (org_id, class_number, session_date, period_label)
    values (v_org, p_class, p_date, coalesce(nullif(trim(p_period), ''), 'day'))
    on conflict (org_id, class_number, session_date, period_label) do update set created_by = auth.uid()
    returning id into v_session;
  end if;

  insert into public.attendance_exceptions (
    org_id, attendance_id, student_id, session_id, session_date, kind, from_status, to_status, reason
  ) values (
    v_org, v_att.id, p_student, v_session, p_date, p_kind, v_from, p_to_status, trim(p_reason)
  ) returning id into v_exc;

  return v_exc;
end;
$$;

revoke all on function public.correct_attendance(uuid, date, text, text, text, int, text) from public, anon;
grant execute on function public.correct_attendance(uuid, date, text, text, text, int, text) to authenticated;

select public.apply_mfa_policy('attendance_sessions'::regclass);
select public.apply_mfa_policy('attendance_exceptions'::regclass);
