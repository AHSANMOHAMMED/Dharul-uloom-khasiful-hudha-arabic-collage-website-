-- =============================================================================
-- 0051_academics_logic.sql
-- Business-logic fixes for academics & campus. Idempotent (create or replace /
-- drop-if-exists). Builds on the FINAL definitions from 0016/0020/0025/0015.
-- Does NOT touch tg_student_results_prepare.
--
--  1. compute_grade: a percentage that falls in a gap of a custom scale
--     (e.g. 79.5 with bands 60–79 / 80–100) fell through to the hard-coded
--     A+/A/B/C/S/F ladder and produced a grade that is not in the org's scale.
--  2. student_report_card: "class rank" / class_size ranked the student
--     against every student in the exam (all classes for a school-wide exam).
--  3. class_attendance_sheet: graduated / withdrawn / transferred / alumni
--     students stayed on the daily register forever (profiles stay approved
--     and graduates keep their final class_number); default date was UTC.
--  4. enroll_active_students: same exited students were re-enrolled into the
--     new year by "Enrol all un-enrolled students".
--  5. promote_students: from-year = to-year silently promoted the student a
--     second time inside the same year; graduates without a student_details
--     row were never marked graduated (so they kept appearing everywhere).
--  6. academic_analytics: latest-exam pass rate ignored exam_subjects.pass_marks
--     (hard-coded 40%).
--  7. class_schedules: no clash detection (same class / same teacher / same
--     room double-booked at overlapping times).
--  8. leave_requests: end_date before start_date accepted.
--  9. enroll_admission: an already-enrolled application could be enrolled
--     again (second index number + second parent invite).
-- 10. lms submissions: a student could rewrite a submission after it was
--     graded and keep the grade.
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- 1 --------------------------------------------------------------------------
create or replace function public.compute_grade(p_org uuid, p_percent numeric)
returns text language sql stable security definer set search_path = public as $$
  select case when p_percent is null then null else coalesce(
    -- exact band first, then the highest band whose lower bound is reached
    -- (covers gaps such as 79.5 between 60–79 and 80–100)
    (select grade from public.grade_scales
     where org_id = p_org and p_percent between min_percent and max_percent
     order by min_percent desc limit 1),
    (select grade from public.grade_scales
     where org_id = p_org and min_percent <= p_percent
     order by min_percent desc limit 1),
    (select grade from public.grade_scales
     where org_id = p_org order by min_percent asc limit 1),
    case
      when p_percent >= 85 then 'A+'
      when p_percent >= 75 then 'A'
      when p_percent >= 65 then 'B'
      when p_percent >= 55 then 'C'
      when p_percent >= 40 then 'S'
      else 'F'
    end) end;
$$;

-- 2 --------------------------------------------------------------------------
create or replace function public.student_report_card(p_student uuid, p_exam uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_exam record;
  v_subjects jsonb;
  v_total numeric;
  v_max numeric;
  v_rank int;
  v_count int;
  v_class int;
begin
  if not public.can_view_student(p_student) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_exam from public.exams where id = p_exam;
  if not found then
    raise exception 'Exam not found';
  end if;
  if v_exam.status <> 'published' and not public.is_employee() then
    raise exception 'Results are not published yet';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'subject', r.subject, 'marks', r.marks_obtained, 'max', r.max_marks,
           'grade', r.grade, 'remarks', r.remarks) order by r.subject), '[]'::jsonb),
         coalesce(sum(r.marks_obtained), 0), coalesce(sum(r.max_marks), 0)
    into v_subjects, v_total, v_max
  from public.student_results r
  where r.student_id = p_student and r.exam_id = p_exam;

  -- The student's class for this exam: enrolment in the exam's year, else profile.
  select coalesce(
           (select e.class_number from public.student_enrollments e
            where e.student_id = p_student and e.academic_year_id = v_exam.academic_year_id),
           (select class_number from public.profiles where id = p_student))
    into v_class;

  with totals as (
    select r.student_id, sum(r.marks_obtained) as total
    from public.student_results r
    join public.profiles p on p.id = r.student_id
    left join public.student_enrollments en
      on en.student_id = r.student_id and en.academic_year_id = v_exam.academic_year_id
    where r.exam_id = p_exam
      and coalesce(en.class_number, p.class_number) is not distinct from v_class
    group by r.student_id
  )
  select (select count(*) + 1 from totals t2 where t2.total > t.total), (select count(*) from totals)
    into v_rank, v_count
  from totals t where t.student_id = p_student;

  return jsonb_build_object(
    'exam', jsonb_build_object('id', v_exam.id, 'name', v_exam.name, 'type', v_exam.exam_type, 'status', v_exam.status),
    'student', (select jsonb_build_object('id', id, 'full_name', full_name, 'index_number', index_number,
                                          'class_number', coalesce(v_class, class_number))
                from public.profiles where id = p_student),
    'subjects', v_subjects,
    'total', v_total,
    'max_total', v_max,
    'percentage', case when v_max > 0 then round(v_total * 100 / v_max, 2) else null end,
    'overall_grade', case when v_max > 0 then public.compute_grade(v_exam.org_id, round(v_total * 100 / v_max, 2)) end,
    'rank', v_rank,
    'class_size', v_count
  );
end;
$$;

-- 3 --------------------------------------------------------------------------
create or replace function public.class_attendance_sheet(p_class int, p_date date default null)
returns table (student_id uuid, full_name text, index_number text, status text, excuse_note text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.index_number, a.status, a.excuse_note
  from public.profiles p
  left join public.student_details d on d.profile_id = p.id
  left join public.attendance a on a.student_id = p.id and a.date = coalesce(p_date, public.org_today())
  where public.is_employee()
    and p.org_id = public.current_org_id()
    and p.account_type = 'student' and p.is_approved and p.class_number = p_class
    -- exited students leave the register (but a mark already saved that day stays visible)
    and (coalesce(d.status, 'active') not in ('graduated', 'withdrawn', 'transferred', 'alumni') or a.id is not null)
  order by p.full_name;
$$;
grant execute on function public.class_attendance_sheet(int, date) to authenticated;

-- 4 --------------------------------------------------------------------------
create or replace function public.enroll_active_students(p_year_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_count int;
begin
  if not (public.is_academic_admin() or public.is_admissions_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.student_enrollments (org_id, student_id, academic_year_id, class_number)
  select v_org, p.id, p_year_id, coalesce(p.class_number, 1)
  from public.profiles p
  left join public.student_details d on d.profile_id = p.id
  where p.org_id = v_org and p.account_type = 'student' and p.is_approved
    and coalesce(d.status, 'active') not in ('graduated', 'withdrawn', 'transferred', 'alumni')
    and exists (select 1 from public.academic_years y where y.id = p_year_id and y.org_id = v_org)
  on conflict (student_id, academic_year_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 5 --------------------------------------------------------------------------
create or replace function public.promote_students(
  p_from_year uuid,
  p_to_year uuid,
  p_class_number int default null,
  p_repeat_ids uuid[] default '{}'::uuid[],
  p_max_class int default 7
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  e record;
  v_promoted int := 0;
  v_repeated int := 0;
  v_graduated int := 0;
  v_next int;
begin
  if not public.is_academic_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_from_year is not distinct from p_to_year then
    raise exception 'Choose two different academic years';
  end if;
  if not exists (select 1 from public.academic_years where id = p_from_year and org_id = v_org)
     or not exists (select 1 from public.academic_years where id = p_to_year and org_id = v_org) then
    raise exception 'Academic year not found';
  end if;

  for e in
    select * from public.student_enrollments
    where academic_year_id = p_from_year and org_id = v_org and status = 'active'
      and (p_class_number is null or class_number = p_class_number)
    for update
  loop
    if e.student_id = any (coalesce(p_repeat_ids, '{}'::uuid[])) then
      v_next := e.class_number;
      update public.student_enrollments set status = 'repeated' where id = e.id;
      v_repeated := v_repeated + 1;
    elsif e.class_number >= coalesce(p_max_class, 7) then
      update public.student_enrollments set status = 'graduated', left_on = public.org_today() where id = e.id;
      insert into public.student_details (profile_id, org_id, status, status_reason)
      values (e.student_id, v_org, 'graduated', 'Year-end promotion')
      on conflict (profile_id) do update set status = 'graduated',
        status_reason = coalesce(public.student_details.status_reason, excluded.status_reason);
      v_graduated := v_graduated + 1;
      continue;
    else
      v_next := e.class_number + 1;
      update public.student_enrollments set status = 'promoted' where id = e.id;
      v_promoted := v_promoted + 1;
    end if;

    insert into public.student_enrollments (org_id, student_id, academic_year_id, class_number, section)
    values (v_org, e.student_id, p_to_year, v_next, e.section)
    on conflict (student_id, academic_year_id) do update set class_number = excluded.class_number, status = 'active';

    update public.profiles set class_number = v_next where id = e.student_id;
  end loop;

  return jsonb_build_object('promoted', v_promoted, 'repeated', v_repeated, 'graduated', v_graduated);
end;
$$;
grant execute on function public.promote_students(uuid, uuid, int, uuid[], int) to authenticated;

-- 6 --------------------------------------------------------------------------
create or replace function public.academic_analytics(p_days int default 180)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_today date := public.org_today();
  v_from date := v_today - greatest(7, least(coalesce(p_days, 180), 730));
begin
  if not (public.is_academic_admin() or public.is_admin() or public.is_admissions_staff() or public.is_hr_staff()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'as_of', v_today,
    'attendance_by_month', coalesce((
      select jsonb_agg(jsonb_build_object('month', mon, 'marked', n,
               'rate', case when n > 0 then round(present * 100.0 / n, 1) end) order by mon)
      from (select to_char(date, 'YYYY-MM') mon, count(*) n, count(*) filter (where status in ('present', 'late')) present
            from public.attendance where org_id = v_org and date >= v_from group by 1) x), '[]'::jsonb),
    'attendance_by_class', coalesce((
      select jsonb_agg(jsonb_build_object('class_number', class_number, 'rate', rate, 'marked', n) order by class_number)
      from (select p.class_number, count(*) n,
                   round(count(*) filter (where a.status in ('present', 'late')) * 100.0 / nullif(count(*), 0), 1) rate
            from public.attendance a join public.profiles p on p.id = a.student_id
            where a.org_id = v_org and a.date >= v_today - 30 group by p.class_number) x), '[]'::jsonb),
    'chronic_absentees', coalesce((
      select jsonb_agg(x order by x.rate) from (
        select p.id student_id, p.full_name, p.class_number, count(*) marked,
               round(count(*) filter (where a.status in ('present', 'late')) * 100.0 / count(*), 1) rate
        from public.attendance a join public.profiles p on p.id = a.student_id
        where a.org_id = v_org and a.date >= v_today - 30
        group by p.id, p.full_name, p.class_number
        having count(*) >= 5 and count(*) filter (where a.status in ('present', 'late')) * 100.0 / count(*) < 75
        order by 5 limit 15) x), '[]'::jsonb),
    'latest_exam', (
      select jsonb_build_object('exam_id', e.id, 'name', e.name, 'class_number', e.class_number,
        'subjects', coalesce((select jsonb_agg(jsonb_build_object('subject', subject, 'average', avg_pct, 'pass_rate', pass_rate, 'entries', n) order by subject)
                     from (select r.subject, count(*) n,
                                  round(avg(r.marks_obtained * 100.0 / nullif(r.max_marks, 0)), 1) avg_pct,
                                  -- pass = the paper's own pass mark (fallback 40% for legacy rows)
                                  round(count(*) filter (where r.marks_obtained >= coalesce(es.pass_marks, r.max_marks * 0.4)) * 100.0 / count(*), 1) pass_rate
                           from public.student_results r
                           left join public.exam_subjects es on es.exam_id = r.exam_id and es.subject_id = r.subject_id
                           where r.exam_id = e.id group by r.subject) s), '[]'::jsonb))
      from public.exams e where e.org_id = v_org and e.status = 'published'
      order by coalesce(e.published_at, e.created_at) desc limit 1),
    'admissions_funnel', coalesce((
      select jsonb_object_agg(stage, n) from (
        select coalesce(pipeline_stage, 'submitted') stage, count(*) n from public.admissions
        where org_id = v_org and created_at >= v_from group by 1) x), '{}'::jsonb),
    'admissions_conversion', (
      select case when count(*) > 0 then round(count(*) filter (where pipeline_stage = 'enrolled') * 100.0 / count(*), 1) end
      from public.admissions where org_id = v_org and created_at >= v_from),
    'enrolment_by_class', coalesce((
      select jsonb_agg(jsonb_build_object('class_number', class_number, 'students', n) order by class_number)
      from (select class_number, count(*) n from public.profiles
            where org_id = v_org and account_type = 'student' and is_approved group by class_number) x), '[]'::jsonb),
    'staff_leave_days', coalesce((
      select jsonb_object_agg(code, days) from (
        select t.code, sum(r.days) days from public.staff_leave_requests r
        join public.staff_leave_types t on t.id = r.leave_type_id
        where r.org_id = v_org and r.status = 'approved' and extract(year from r.start_date) = extract(year from v_today)
        group by t.code) x), '{}'::jsonb),
    'tasks', (select jsonb_build_object(
        'open', count(*) filter (where status <> 'done'),
        'overdue', count(*) filter (where status <> 'done' and due_date < v_today),
        'done_30d', count(*) filter (where status = 'done' and completed_at > now() - interval '30 days'))
      from public.tasks where org_id = v_org));
end;
$$;
grant execute on function public.academic_analytics(int) to authenticated;

-- 7 --------------------------------------------------------------------------
create or replace function public.tg_class_schedules_clash()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  if new.end_time <= new.start_time then
    raise exception 'End time must be after start time';
  end if;
  select s.class_number, s.tutor_id, s.room, s.subject, s.start_time, s.end_time,
         case when s.class_number = new.class_number then 'class'
              when s.tutor_id = new.tutor_id then 'teacher'
              else 'room' end as kind
    into c
  from public.class_schedules s
  where s.id <> new.id
    and s.org_id = new.org_id
    and s.academic_year = new.academic_year
    and s.day_of_week = new.day_of_week
    and s.start_time < new.end_time and s.end_time > new.start_time
    and (s.class_number = new.class_number
         or s.tutor_id = new.tutor_id
         or (nullif(trim(new.room), '') is not null and lower(trim(s.room)) = lower(trim(new.room))))
  limit 1;
  if found then
    raise exception 'Timetable clash (%): % % %-% already booked (class %, room %)',
      c.kind, new.day_of_week, c.subject, to_char(c.start_time, 'HH24:MI'), to_char(c.end_time, 'HH24:MI'),
      c.class_number, coalesce(c.room, '—')
      using errcode = '23P01';
  end if;
  return new;
end;
$$;
-- "z" so it runs after the tenant trigger has set org_id
drop trigger if exists trg_class_schedules_z_clash on public.class_schedules;
create trigger trg_class_schedules_z_clash
  before insert or update of day_of_week, start_time, end_time, class_number, tutor_id, room, academic_year
  on public.class_schedules
  for each row execute function public.tg_class_schedules_clash();

-- 8 --------------------------------------------------------------------------
alter table public.leave_requests drop constraint if exists leave_requests_date_order;
alter table public.leave_requests add constraint leave_requests_date_order
  check (end_date >= start_date) not valid;

-- 9 --------------------------------------------------------------------------
create or replace function public.enroll_admission(
  p_admission_id uuid, p_index_number text, p_class_number int default 1, p_default_fee numeric default 2000)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  adm record;
  invite_token text;
begin
  if not public.is_admissions_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into adm from public.admissions where id = p_admission_id and org_id = public.current_org_id() for update;
  if not found then
    raise exception 'admission not found';
  end if;
  if adm.pipeline_stage = 'enrolled' or adm.status = 'enrolled' or adm.enrolled_index is not null then
    raise exception 'This application is already enrolled (index %)', coalesce(adm.enrolled_index, '—');
  end if;
  if adm.pipeline_stage = 'rejected' then
    raise exception 'A rejected application cannot be enrolled; move it back to a review stage first';
  end if;
  if coalesce(trim(p_index_number), '') = '' then
    raise exception 'An index number is required';
  end if;

  if exists (select 1 from public.valid_index_numbers
             where index_number = p_index_number and (org_id <> adm.org_id or is_registered)) then
    raise exception 'Index number % is already in use', p_index_number;
  end if;
  insert into public.valid_index_numbers (index_number, student_name, class_number, is_registered, org_id)
  values (p_index_number, adm.student_name, p_class_number, false, adm.org_id)
  on conflict (index_number) do update
    set student_name = excluded.student_name, class_number = excluded.class_number
    where public.valid_index_numbers.org_id = adm.org_id and not public.valid_index_numbers.is_registered;

  update public.admissions
  set status = 'enrolled', pipeline_stage = 'enrolled', enrolled_index = p_index_number,
      enrolled_class = p_class_number, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_admission_id;

  insert into public.admission_status_history (admission_id, from_stage, to_stage, changed_by, note, org_id)
  values (p_admission_id, adm.pipeline_stage, 'enrolled', auth.uid(),
          format('Enrolled index %s class %s', p_index_number, p_class_number), adm.org_id);

  insert into public.parent_invites (child_index, child_name, admission_id, created_by, org_id)
  values (p_index_number, adm.student_name, p_admission_id, auth.uid(), adm.org_id)
  returning token into invite_token;

  if coalesce(adm.phone, '') <> '' then
    insert into public.message_outbox (channel, to_address, subject, body, metadata, org_id)
    values ('sms', adm.phone, 'Parent portal invite',
            format('Your child %s is enrolled (index %s). Register as a parent and use invite code %s to link.',
                   adm.student_name, p_index_number, invite_token),
            jsonb_build_object('type', 'parent_invite', 'index', p_index_number, 'token', invite_token), adm.org_id);
  end if;
  if coalesce(adm.email, '') <> '' then
    insert into public.message_outbox (channel, to_address, subject, body, metadata, org_id)
    values ('email', adm.email, 'Parent portal invite',
            format(E'Assalamu alaikum %s,\n\nYour child %s has been enrolled.\nIndex number: %s\nClass: %s\nInvite code: %s\n\nPlease register as a parent and link this index in the Parent Portal.',
                   adm.parent_name, adm.student_name, p_index_number, p_class_number, invite_token),
            jsonb_build_object('type', 'parent_invite', 'index', p_index_number, 'token', invite_token), adm.org_id);
  end if;

  return jsonb_build_object('ok', true, 'index_number', p_index_number, 'class_number', p_class_number,
                            'fee_month', to_char(public.org_now(), 'YYYY-MM'), 'suggested_fee', p_default_fee,
                            'parent_invite_token', invite_token, 'org_id', adm.org_id);
end;
$$;

-- 10 -------------------------------------------------------------------------
create or replace function public.tg_lms_submission_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  if exists (select 1 from public.lms_assignments a where a.id = new.assignment_id and a.tutor_id = auth.uid()) then
    if tg_op = 'UPDATE' and (new.student_id, new.assignment_id, new.content, new.file_url)
       is distinct from (old.student_id, old.assignment_id, old.content, old.file_url) then
      raise exception 'Tutors may only grade submissions' using errcode = '42501';
    end if;
    return new;
  end if;
  -- student path
  if new.student_id <> auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.grade := null;
    new.feedback := null;
  elsif (new.grade, new.feedback, new.assignment_id, new.student_id)
        is distinct from (old.grade, old.feedback, old.assignment_id, old.student_id) then
    raise exception 'Students cannot change grades or feedback' using errcode = '42501';
  elsif nullif(trim(coalesce(old.grade, '')), '') is not null
        and (new.content, new.file_url) is distinct from (old.content, old.file_url) then
    raise exception 'This submission has already been graded and can no longer be changed';
  end if;
  return new;
end;
$$;
