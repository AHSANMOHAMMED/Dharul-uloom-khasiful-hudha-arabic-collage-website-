-- Student/parent result appeals and resit scheduling (ties to 0042 corrections).
set search_path = public, extensions, pg_temp;

create table if not exists public.result_appeals (
  id              uuid primary key default extensions.gen_random_uuid(),
  org_id          uuid not null references public.organizations (id),
  result_id       uuid not null references public.student_results (id) on delete restrict,
  exam_id         uuid references public.exams (id) on delete set null,
  student_id      uuid not null references public.profiles (id) on delete restrict,
  filed_by        uuid references public.profiles (id) on delete set null default auth.uid(),
  reason          text not null,
  status          text not null default 'filed'
                  check (status in ('filed', 'under_review', 'accepted', 'rejected', 'resit_scheduled', 'withdrawn')),
  reviewer_id     uuid references public.profiles (id) on delete set null,
  review_notes    text,
  resit_exam_id   uuid references public.exams (id) on delete set null,
  correction_id   uuid references public.result_corrections (id) on delete set null,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
create index if not exists idx_result_appeals_student on public.result_appeals (student_id, created_at desc);
create index if not exists idx_result_appeals_status on public.result_appeals (org_id, status);

alter table public.result_appeals enable row level security;
drop policy if exists "result_appeals: read" on public.result_appeals;
create policy "result_appeals: read" on public.result_appeals for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (public.is_employee() or student_id = auth.uid() or public.is_parent_of(student_id) or filed_by = auth.uid())
  );
drop policy if exists "result_appeals: no direct write" on public.result_appeals;
create policy "result_appeals: no direct write" on public.result_appeals for all to authenticated
  using (false) with check (false);

select public.apply_tenant_scope('result_appeals', 'result_id', 'student_results');
select public.apply_mfa_policy('result_appeals'::regclass);
select public.attach_audit('result_appeals');

create or replace function public.file_result_appeal(p_result uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_id uuid;
  v_org uuid := public.current_org_id();
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;
  select * into r from public.student_results where id = p_result;
  if not found then raise exception 'Result not found'; end if;
  if r.org_id is distinct from v_org then raise exception 'forbidden' using errcode = '42501'; end if;
  if not (r.student_id = auth.uid() or public.is_parent_of(r.student_id) or public.is_admin()
          or public.has_staff_role(array['principal', 'vice_principal', 'exam_officer'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.result_appeals
    where result_id = p_result and status in ('filed', 'under_review', 'resit_scheduled')
  ) then
    raise exception 'An open appeal already exists for this result';
  end if;

  insert into public.result_appeals (org_id, result_id, exam_id, student_id, reason, filed_by)
  values (r.org_id, r.id, r.exam_id, r.student_id, trim(p_reason), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.review_result_appeal(
  p_appeal uuid,
  p_decision text,
  p_notes text default null,
  p_resit_exam uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a record;
  v_decision text := lower(trim(p_decision));
begin
  if not (public.is_admin() or public.has_staff_role(array['principal', 'vice_principal', 'exam_officer'])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_decision not in ('accepted', 'rejected', 'resit_scheduled', 'under_review') then
    raise exception 'Invalid decision';
  end if;
  select * into a from public.result_appeals
  where id = p_appeal and org_id = public.current_org_id() for update;
  if not found then raise exception 'Appeal not found'; end if;
  if a.status in ('accepted', 'rejected', 'withdrawn') then
    raise exception 'Appeal already resolved';
  end if;
  if v_decision = 'resit_scheduled' and p_resit_exam is null then
    raise exception 'Resit exam is required';
  end if;

  update public.result_appeals
  set status = v_decision,
      reviewer_id = auth.uid(),
      review_notes = p_notes,
      resit_exam_id = case when v_decision = 'resit_scheduled' then p_resit_exam else resit_exam_id end,
      resolved_at = case when v_decision in ('accepted', 'rejected', 'resit_scheduled') then now() else resolved_at end
  where id = p_appeal;

  return jsonb_build_object('ok', true, 'status', v_decision);
end;
$$;

grant execute on function public.file_result_appeal(uuid, text) to authenticated;
grant execute on function public.review_result_appeal(uuid, text, text, uuid) to authenticated;
