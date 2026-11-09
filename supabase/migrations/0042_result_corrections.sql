-- Audited mark corrections after exam publication.
set search_path = public, extensions, pg_temp;

create table if not exists public.result_corrections (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  result_id     uuid not null references public.student_results (id) on delete restrict,
  exam_id       uuid references public.exams (id) on delete set null,
  student_id    uuid not null references public.profiles (id) on delete restrict,
  old_marks     numeric(8,2) not null,
  new_marks     numeric(8,2) not null,
  old_grade     text,
  new_grade     text,
  reason        text not null,
  requester_id  uuid references public.profiles (id) on delete set null default auth.uid(),
  approver_id   uuid references public.profiles (id) on delete set null,
  status        text not null default 'draft'
                check (status in ('draft', 'approved', 'applied', 'rejected')),
  created_at    timestamptz not null default now(),
  applied_at    timestamptz
);
create index if not exists idx_result_corrections_result on public.result_corrections (result_id, created_at desc);

alter table public.result_corrections enable row level security;
drop policy if exists "result_corrections: read" on public.result_corrections;
create policy "result_corrections: read" on public.result_corrections for select to authenticated
  using (org_id = (select public.current_org_id()) and public.is_employee());
drop policy if exists "result_corrections: no direct write" on public.result_corrections;
create policy "result_corrections: no direct write" on public.result_corrections for all to authenticated
  using (false) with check (false);

select public.apply_tenant_scope('result_corrections', 'result_id', 'student_results');
select public.apply_mfa_policy('result_corrections'::regclass);
select public.attach_audit('result_corrections');

-- Published exams: block direct mark edits unless app.result_correction = on.
create or replace function public.tg_student_results_prepare()
returns trigger language plpgsql set search_path = public as $$
declare
  v_status text;
begin
  if new.marks_obtained < 0 or new.marks_obtained > new.max_marks then
    raise exception 'Marks must be between 0 and %', new.max_marks;
  end if;

  if new.subject_id is not null and coalesce(new.subject, '') = '' then
    select name_en into new.subject from public.subjects where id = new.subject_id;
  end if;

  if new.exam_id is not null then
    select status into v_status from public.exams where id = new.exam_id;
    if v_status = 'published'
       and current_user in ('anon', 'authenticated')
       and tg_op = 'UPDATE'
       and (new.marks_obtained is distinct from old.marks_obtained or new.max_marks is distinct from old.max_marks)
       and coalesce(current_setting('app.result_correction', true), '') <> 'on' then
      raise exception 'Published results require apply_result_correction' using errcode = '42501';
    end if;
    if coalesce(new.exam_name, '') = '' then
      select name into new.exam_name from public.exams where id = new.exam_id;
    end if;
  end if;

  if tg_op = 'INSERT' and new.org_id is null then
    select org_id into new.org_id from public.profiles where id = new.student_id;
  end if;

  if coalesce(new.grade, '') = '' or (tg_op = 'UPDATE' and new.marks_obtained is distinct from old.marks_obtained and new.grade = old.grade) then
    new.grade := public.compute_grade(new.org_id, round(new.marks_obtained * 100.0 / new.max_marks, 2));
  end if;
  new.entered_by := coalesce(new.entered_by, auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.request_result_correction(
  p_result uuid, p_new_marks numeric, p_reason text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_id uuid;
  v_exam_status text;
begin
  if not public.is_employee() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;
  select * into r from public.student_results where id = p_result and org_id = public.current_org_id();
  if not found then raise exception 'Result not found'; end if;
  select status into v_exam_status from public.exams where id = r.exam_id;
  if v_exam_status is distinct from 'published' then
    raise exception 'Use normal marks entry until the exam is published';
  end if;
  if p_new_marks < 0 or p_new_marks > r.max_marks then
    raise exception 'Marks must be between 0 and %', r.max_marks;
  end if;

  insert into public.result_corrections (org_id, result_id, exam_id, student_id, old_marks, new_marks, old_grade, reason, status)
  values (r.org_id, r.id, r.exam_id, r.student_id, r.marks_obtained, p_new_marks, r.grade, p_reason, 'draft')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.apply_result_correction(p_correction uuid, p_approve boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c record;
  v_grade text;
begin
  if not public.is_academic_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into c from public.result_corrections
  where id = p_correction and org_id = public.current_org_id() and status = 'draft' for update;
  if not found then raise exception 'Correction not found'; end if;

  if not p_approve then
    update public.result_corrections set status = 'rejected', approver_id = auth.uid() where id = c.id;
    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;

  -- Prefer a second approver when the requester is not an academic admin.
  if c.requester_id is not null and c.requester_id = auth.uid()
     and not public.is_academic_admin() then
    raise exception 'A different academic admin must approve this correction';
  end if;

  perform set_config('app.result_correction', 'on', true);
  update public.student_results
  set marks_obtained = c.new_marks
  where id = c.result_id
  returning grade into v_grade;
  perform set_config('app.result_correction', 'off', true);

  update public.result_corrections
  set status = 'applied', approver_id = auth.uid(), applied_at = now(), new_grade = v_grade
  where id = c.id;

  return jsonb_build_object('ok', true, 'status', 'applied', 'grade', v_grade);
end;
$$;

grant execute on function public.request_result_correction(uuid, numeric, text) to authenticated;
grant execute on function public.apply_result_correction(uuid, boolean) to authenticated;
