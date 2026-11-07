-- =============================================================================
-- 0016_academics.sql
-- Student management + academic structure: academic years, terms, subjects,
-- class-subject-teacher assignments, student records, enrolments/promotion,
-- exams with publish workflow, grading scales, report cards.
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- Relax class_number 1..7 → 1..20 (SaaS: other institutions have more grades)
-- ---------------------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select con.conname, rel.relname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ~ 'class_number.*BETWEEN 1 AND 7|class_number >= 1\).*class_number <= 7'
  loop
    execute format('alter table public.%I drop constraint %I', c.relname, c.conname);
    execute format('alter table public.%I add constraint %I check (class_number between 1 and 20)', c.relname, c.conname);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Academic years & terms
-- ---------------------------------------------------------------------------
create table if not exists public.academic_years (
  id          uuid primary key default extensions.gen_random_uuid(),
  org_id      uuid not null references public.organizations (id),
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  is_current  boolean not null default false,
  status      text not null default 'planned' check (status in ('planned', 'active', 'closed')),
  created_at  timestamptz not null default now(),
  check (end_date > start_date),
  unique (org_id, name)
);
create unique index if not exists idx_academic_years_current on public.academic_years (org_id) where is_current;

create table if not exists public.terms (
  id               uuid primary key default extensions.gen_random_uuid(),
  org_id           uuid not null references public.organizations (id),
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  name             text not null,
  sequence         int  not null default 1,
  start_date       date not null,
  end_date         date not null,
  created_at       timestamptz not null default now(),
  check (end_date > start_date),
  unique (academic_year_id, name)
);

-- ---------------------------------------------------------------------------
-- Subjects & class/teacher assignment
-- ---------------------------------------------------------------------------
create table if not exists public.subjects (
  id            uuid primary key default extensions.gen_random_uuid(),
  org_id        uuid not null references public.organizations (id),
  code          text not null,
  name_en       text not null,
  name_ar       text,
  category      text not null default 'general'
                check (category in ('quran', 'arabic', 'hadith', 'fiqh', 'aqeedah', 'tafseer', 'seerah', 'tajweed', 'general', 'language', 'science', 'other')),
  credit_hours  numeric(4,1) not null default 1,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (org_id, code)
);

create table if not exists public.class_subjects (
  id               uuid primary key default extensions.gen_random_uuid(),
  org_id           uuid not null references public.organizations (id),
  class_number     int  not null check (class_number between 1 and 20),
  subject_id       uuid not null references public.subjects (id) on delete cascade,
  tutor_id         uuid references public.profiles (id) on delete set null,
  academic_year_id uuid references public.academic_years (id) on delete cascade,
  weekly_periods   int  not null default 1 check (weekly_periods between 0 and 40),
  created_at       timestamptz not null default now()
);
create unique index if not exists idx_class_subjects_unique
  on public.class_subjects (org_id, class_number, subject_id, coalesce(academic_year_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.class_schedules
  add column if not exists subject_id uuid references public.subjects (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Student records (1:1 with profiles of account_type = student)
-- ---------------------------------------------------------------------------
create table if not exists public.student_details (
  profile_id            uuid primary key references public.profiles (id) on delete cascade,
  org_id                uuid not null references public.organizations (id),
  admission_no          text,
  admission_date        date,
  date_of_birth         date,
  gender                text check (gender in ('male', 'female')),
  nationality           text default 'Sri Lankan',
  national_id           text,
  address               text,
  city                  text,
  guardian_name         text,
  guardian_relationship text,
  guardian_phone        text,
  guardian_email        text,
  emergency_contact     text,
  blood_group           text,
  medical_notes         text,
  previous_school       text,
  photo_url             text,
  status                text not null default 'active'
                        check (status in ('active', 'suspended', 'graduated', 'withdrawn', 'transferred', 'alumni')),
  status_reason         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index if not exists idx_student_details_admission_no
  on public.student_details (org_id, admission_no) where admission_no is not null;

drop trigger if exists trg_student_details_updated_at on public.student_details;
create trigger trg_student_details_updated_at before update on public.student_details
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Enrolments per academic year
-- ---------------------------------------------------------------------------
create table if not exists public.student_enrollments (
  id               uuid primary key default extensions.gen_random_uuid(),
  org_id           uuid not null references public.organizations (id),
  student_id       uuid not null references public.profiles (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  class_number     int  not null check (class_number between 1 and 20),
  section          text,
  roll_no          int,
  status           text not null default 'active'
                   check (status in ('active', 'promoted', 'repeated', 'graduated', 'withdrawn', 'transferred')),
  enrolled_on      date not null default current_date,
  left_on          date,
  remarks          text,
  created_at       timestamptz not null default now(),
  unique (student_id, academic_year_id)
);
create index if not exists idx_enrollments_year_class on public.student_enrollments (academic_year_id, class_number);

-- ---------------------------------------------------------------------------
-- Grading & exams
-- ---------------------------------------------------------------------------
create table if not exists public.grade_scales (
  id          uuid primary key default extensions.gen_random_uuid(),
  org_id      uuid not null references public.organizations (id),
  min_percent numeric(5,2) not null check (min_percent between 0 and 100),
  max_percent numeric(5,2) not null check (max_percent between 0 and 100),
  grade       text not null,
  grade_point numeric(3,2),
  remark      text,
  check (max_percent >= min_percent),
  unique (org_id, grade)
);

create table if not exists public.exams (
  id               uuid primary key default extensions.gen_random_uuid(),
  org_id           uuid not null references public.organizations (id),
  academic_year_id uuid references public.academic_years (id) on delete set null,
  term_id          uuid references public.terms (id) on delete set null,
  name             text not null,
  exam_type        text not null default 'term'
                   check (exam_type in ('term', 'midterm', 'final', 'monthly', 'quiz', 'hifz_test', 'oral', 'other')),
  class_number     int check (class_number between 1 and 20),
  start_date       date,
  end_date         date,
  status           text not null default 'draft' check (status in ('draft', 'scheduled', 'marking', 'published')),
  published_at     timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists trg_exams_updated_at on public.exams;
create trigger trg_exams_updated_at before update on public.exams
  for each row execute function public.set_updated_at();

create table if not exists public.exam_subjects (
  id          uuid primary key default extensions.gen_random_uuid(),
  org_id      uuid not null references public.organizations (id),
  exam_id     uuid not null references public.exams (id) on delete cascade,
  subject_id  uuid not null references public.subjects (id) on delete cascade,
  exam_date   date,
  max_marks   numeric(6,2) not null default 100 check (max_marks > 0),
  pass_marks  numeric(6,2) not null default 40 check (pass_marks >= 0),
  unique (exam_id, subject_id)
);

alter table public.student_results
  add column if not exists exam_id    uuid references public.exams (id) on delete cascade,
  add column if not exists subject_id uuid references public.subjects (id) on delete set null,
  add column if not exists entered_by uuid references public.profiles (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

-- Non-partial so clients can upsert on (exam_id, subject_id, student_id);
-- legacy rows with NULL exam/subject stay unconstrained (NULLs are distinct).
alter table public.student_results drop constraint if exists student_results_exam_subject_student_key;
alter table public.student_results add constraint student_results_exam_subject_student_key
  unique (exam_id, subject_id, student_id);
create index if not exists idx_student_results_student on public.student_results (student_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Tenant scope for all new tables
-- ---------------------------------------------------------------------------
select public.apply_tenant_scope('academic_years');
select public.apply_tenant_scope('terms', 'academic_year_id', 'academic_years');
select public.apply_tenant_scope('subjects');
select public.apply_tenant_scope('class_subjects', 'subject_id', 'subjects');
select public.apply_tenant_scope('student_details', 'profile_id');
select public.apply_tenant_scope('student_enrollments', 'student_id');
select public.apply_tenant_scope('grade_scales');
select public.apply_tenant_scope('exams');
select public.apply_tenant_scope('exam_subjects', 'exam_id', 'exams');

-- ---------------------------------------------------------------------------
-- Grade computation
-- ---------------------------------------------------------------------------
create or replace function public.compute_grade(p_org uuid, p_percent numeric)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select grade from public.grade_scales
     where org_id = p_org and p_percent between min_percent and max_percent
     order by min_percent desc limit 1),
    case
      when p_percent >= 85 then 'A+'
      when p_percent >= 75 then 'A'
      when p_percent >= 65 then 'B'
      when p_percent >= 55 then 'C'
      when p_percent >= 40 then 'S'
      else 'F'
    end);
$$;

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
    if v_status = 'published' and current_user in ('anon', 'authenticated') and not public.is_academic_admin() then
      raise exception 'Results of a published exam can only be changed by the exam officer/principal' using errcode = '42501';
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
drop trigger if exists trg_student_results_prepare on public.student_results;
create trigger trg_student_results_prepare before insert or update on public.student_results
  for each row execute function public.tg_student_results_prepare();

alter table public.student_results alter column grade set default '';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.academic_years      enable row level security;
alter table public.terms               enable row level security;
alter table public.subjects            enable row level security;
alter table public.class_subjects      enable row level security;
alter table public.student_details     enable row level security;
alter table public.student_enrollments enable row level security;
alter table public.grade_scales        enable row level security;
alter table public.exams               enable row level security;
alter table public.exam_subjects       enable row level security;

-- structure tables: any org member reads; academic admins write
do $$
declare
  t text;
begin
  foreach t in array array['academic_years', 'terms', 'subjects', 'class_subjects', 'grade_scales', 'exam_subjects'] loop
    execute format('drop policy if exists "%1$s: org read" on public.%1$I', t);
    execute format('create policy "%1$s: org read" on public.%1$I for select to authenticated using (true)', t);
    execute format('drop policy if exists "%1$s: academic admin write" on public.%1$I', t);
    execute format('create policy "%1$s: academic admin write" on public.%1$I for all to authenticated
                    using (public.is_academic_admin()) with check (public.is_academic_admin())', t);
  end loop;
end $$;

drop policy if exists "exams: read" on public.exams;
create policy "exams: read" on public.exams for select to authenticated
  using (public.is_employee() or status in ('scheduled', 'marking', 'published'));
drop policy if exists "exams: academic admin write" on public.exams;
create policy "exams: academic admin write" on public.exams for all to authenticated
  using (public.is_academic_admin()) with check (public.is_academic_admin());

drop policy if exists "student_details: read" on public.student_details;
create policy "student_details: read" on public.student_details for select to authenticated
  using (profile_id = auth.uid() or public.is_parent_of(profile_id) or public.is_employee());
drop policy if exists "student_details: staff write" on public.student_details;
create policy "student_details: staff write" on public.student_details for all to authenticated
  using (public.is_academic_admin() or public.is_admissions_staff())
  with check (public.is_academic_admin() or public.is_admissions_staff());

drop policy if exists "student_enrollments: read" on public.student_enrollments;
create policy "student_enrollments: read" on public.student_enrollments for select to authenticated
  using (student_id = auth.uid() or public.is_parent_of(student_id) or public.is_employee());
drop policy if exists "student_enrollments: staff write" on public.student_enrollments;
create policy "student_enrollments: staff write" on public.student_enrollments for all to authenticated
  using (public.is_academic_admin() or public.is_admissions_staff())
  with check (public.is_academic_admin() or public.is_admissions_staff());

-- results: students/parents only see published exams
drop policy if exists "results: view own or children" on public.student_results;
create policy "results: view own or children" on public.student_results for select to authenticated
  using (
    public.is_employee()
    or ((student_id = auth.uid() or public.is_parent_of(student_id))
        and (exam_id is null or exists (select 1 from public.exams e where e.id = exam_id and e.status = 'published')))
  );
drop policy if exists "results: academic admin write" on public.student_results;
create policy "results: academic admin write" on public.student_results for all to authenticated
  using (public.is_academic_admin()) with check (public.is_academic_admin());

-- Tutors write only for classes they teach (class_subjects / timetable).
-- Bootstrap: a class with no teacher assignments yet is open to any tutor of
-- the institution, so existing deployments keep working until the principal
-- assigns teachers.
create or replace function public.tutor_can_teach_student(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_tutor() and exists (
    select 1 from public.profiles s
    where s.id = p_student and s.org_id = public.current_org_id() and s.account_type = 'student'
      and (
        exists (select 1 from public.class_subjects cs
                where cs.org_id = s.org_id and cs.class_number = s.class_number and cs.tutor_id = auth.uid())
        or exists (select 1 from public.class_schedules sc
                   where sc.org_id = s.org_id and sc.class_number = s.class_number and sc.tutor_id = auth.uid())
        or (not exists (select 1 from public.class_subjects cs
                        where cs.org_id = s.org_id and cs.class_number = s.class_number and cs.tutor_id is not null)
            and not exists (select 1 from public.class_schedules sc
                            where sc.org_id = s.org_id and sc.class_number = s.class_number))
      )
  );
$$;

drop policy if exists "attendance: tutor manage own" on public.attendance;
create policy "attendance: tutor manage own" on public.attendance for all to authenticated
  using (public.is_staff() or public.tutor_can_teach_student(student_id))
  with check (public.is_staff() or public.tutor_can_teach_student(student_id));
drop policy if exists "results: tutor write" on public.student_results;
create policy "results: tutor write" on public.student_results for all to authenticated
  using (public.is_staff() or public.tutor_can_teach_student(student_id))
  with check (public.is_staff() or public.tutor_can_teach_student(student_id));
drop policy if exists "leaves: tutor review" on public.leave_requests;
create policy "leaves: tutor review" on public.leave_requests for update to authenticated
  using (public.is_staff() or public.tutor_can_teach_student(student_id))
  with check (public.is_staff() or public.tutor_can_teach_student(student_id));

drop policy if exists "attendance: academic admin" on public.attendance;
create policy "attendance: academic admin" on public.attendance for all to authenticated
  using (public.is_academic_admin()) with check (public.is_academic_admin());
drop policy if exists "attendance: employee read" on public.attendance;
create policy "attendance: employee read" on public.attendance for select to authenticated
  using (public.is_employee());
drop policy if exists "schedules: academic admin" on public.class_schedules;
create policy "schedules: academic admin" on public.class_schedules for all to authenticated
  using (public.is_academic_admin()) with check (public.is_academic_admin());
-- tutors may only create periods for themselves
drop policy if exists "schedules: staff write" on public.class_schedules;
create policy "schedules: staff write" on public.class_schedules for insert to authenticated
  with check (public.is_staff() or (public.is_tutor() and tutor_id = auth.uid()));

-- admissions: a college takes adult learners too (was age 5–15)
alter table public.admissions drop constraint if exists admissions_age_check;
alter table public.admissions add constraint admissions_age_check check (age between 3 and 80);

drop policy if exists "leaves: academic admin review" on public.leave_requests;
create policy "leaves: academic admin review" on public.leave_requests for all to authenticated
  using (public.is_academic_admin()) with check (public.is_academic_admin());

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.set_current_academic_year(p_year_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
begin
  if not public.is_academic_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.academic_years where id = p_year_id and org_id = v_org) then
    raise exception 'Academic year not found';
  end if;
  update public.academic_years set is_current = false, status = case when status = 'active' then 'closed' else status end
  where org_id = v_org and is_current and id <> p_year_id;
  update public.academic_years set is_current = true, status = 'active' where id = p_year_id;
end;
$$;

-- Promote/repeat/graduate students from one year to the next.
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
    if e.student_id = any (p_repeat_ids) then
      v_next := e.class_number;
      update public.student_enrollments set status = 'repeated' where id = e.id;
      v_repeated := v_repeated + 1;
    elsif e.class_number >= p_max_class then
      update public.student_enrollments set status = 'graduated', left_on = current_date where id = e.id;
      update public.student_details set status = 'graduated' where profile_id = e.student_id;
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

-- Enrol every approved student without an enrolment into a given year (bootstrap).
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
  where p.org_id = v_org and p.account_type = 'student' and p.is_approved
    and exists (select 1 from public.academic_years y where y.id = p_year_id and y.org_id = v_org)
  on conflict (student_id, academic_year_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.can_view_student(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_student = auth.uid()
      or public.is_parent_of(p_student)
      or (public.is_employee() and exists (select 1 from public.profiles where id = p_student and org_id = public.current_org_id()))
      or public.is_super_admin();
$$;

-- Report card for one student in one exam (with class rank).
create or replace function public.student_report_card(p_student uuid, p_exam uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_exam record;
  v_subjects jsonb;
  v_total numeric;
  v_max numeric;
  v_rank int;
  v_count int;
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

  with totals as (
    select r.student_id, sum(r.marks_obtained) as total
    from public.student_results r
    where r.exam_id = p_exam
    group by r.student_id
  )
  select (select count(*) + 1 from totals t2 where t2.total > t.total), (select count(*) from totals)
    into v_rank, v_count
  from totals t where t.student_id = p_student;

  return jsonb_build_object(
    'exam', jsonb_build_object('id', v_exam.id, 'name', v_exam.name, 'type', v_exam.exam_type, 'status', v_exam.status),
    'student', (select jsonb_build_object('id', id, 'full_name', full_name, 'index_number', index_number, 'class_number', class_number)
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

create or replace function public.attendance_summary(p_student uuid, p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if not public.can_view_student(p_student) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
           'present', count(*) filter (where status = 'present'),
           'absent',  count(*) filter (where status = 'absent'),
           'late',    count(*) filter (where status = 'late'),
           'excused', count(*) filter (where status = 'excused'),
           'total',   count(*),
           'rate',    case when count(*) > 0
                        then round(count(*) filter (where status in ('present', 'late')) * 100.0 / count(*), 1) end)
    into v
  from public.attendance
  where student_id = p_student
    and (p_from is null or date >= p_from)
    and (p_to is null or date <= p_to);
  return v;
end;
$$;

-- Class-wide attendance for a date (tutor marking screen)
create or replace function public.class_attendance_sheet(p_class int, p_date date default current_date)
returns table (student_id uuid, full_name text, index_number text, status text, excuse_note text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.index_number, a.status, a.excuse_note
  from public.profiles p
  left join public.attendance a on a.student_id = p.id and a.date = p_date
  where public.is_employee()
    and p.org_id = public.current_org_id()
    and p.account_type = 'student' and p.is_approved and p.class_number = p_class
  order by p.full_name;
$$;

grant execute on function public.set_current_academic_year(uuid) to authenticated;
grant execute on function public.promote_students(uuid, uuid, int, uuid[], int) to authenticated;
grant execute on function public.enroll_active_students(uuid) to authenticated;
grant execute on function public.student_report_card(uuid, uuid) to authenticated;
grant execute on function public.attendance_summary(uuid, date, date) to authenticated;
grant execute on function public.class_attendance_sheet(int, date) to authenticated;

select public.attach_audit(t) from unnest(array['student_details', 'student_enrollments', 'exams']) t;

-- Seed default grade scale for every org that has none
insert into public.grade_scales (org_id, min_percent, max_percent, grade, grade_point, remark)
select o.id, v.min_p, v.max_p, v.grade, v.gp, v.remark
from public.organizations o
cross join (values
  (85::numeric, 100::numeric, 'A+', 4.00, 'Excellent'),
  (75, 84.99, 'A', 3.70, 'Very good'),
  (65, 74.99, 'B', 3.00, 'Good'),
  (55, 64.99, 'C', 2.00, 'Satisfactory'),
  (40, 54.99, 'S', 1.00, 'Pass'),
  (0, 39.99, 'F', 0.00, 'Fail')
) as v(min_p, max_p, grade, gp, remark)
on conflict (org_id, grade) do nothing;
