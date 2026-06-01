-- =============================================================================
-- 0006_role_based_portal.sql
-- Phase 3: Setup database tables and RLS for the Student-Parent-Tutor Portal.
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- profiles extensions
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_approved boolean not null default false,
  add column if not exists index_number text unique,
  add column if not exists assigned_tutor_role text not null default 'none'
    check (assigned_tutor_role in ('none', 'principal', 'vice_principal', 'treasurer')),
  add column if not exists class_number int check (class_number between 1 and 7),
  add column if not exists phone text;

-- Update profiles table check constraint to support the 'tutor' account type
alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add constraint profiles_account_type_check
    check (account_type in ('guest', 'student', 'parent', 'tutor'));

-- Update the new user creation trigger to populate the additional fields and
-- automatically approve parents and guests, while leaving students and tutors
-- unapproved by default.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_type text;
  v_is_approved boolean;
  v_role text;
begin
  v_account_type := coalesce(nullif(new.raw_user_meta_data ->> 'account_type', ''), 'guest');
  v_role := 'user';
  
  -- If signup is done using the admin email, make them admin immediately
  if new.email = 'admin@kashifulhudha.lk' then
    v_is_approved := true;
    v_role := 'admin';
  elsif v_account_type in ('student', 'tutor') then
    v_is_approved := false;
  else
    v_is_approved := true;
  end if;

  insert into public.profiles (id, email, full_name, account_type, is_approved, index_number, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    v_account_type,
    v_is_approved,
    nullif(new.raw_user_meta_data ->> 'index_number', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- valid_index_numbers
-- ---------------------------------------------------------------------------
create table if not exists public.valid_index_numbers (
  index_number text primary key,
  student_name text not null,
  class_number int not null check (class_number between 1 and 7),
  is_registered boolean not null default false,
  created_at timestamptz not null default now()
);

-- Seed some test student index numbers
insert into public.valid_index_numbers (index_number, student_name, class_number)
values
  ('KASHIF-2026-001', 'Ahmad Abdullah', 5),
  ('KASHIF-2026-002', 'Fatima Zahra', 3),
  ('KASHIF-2026-003', 'Muhammad Razi', 6),
  ('KASHIF-2026-004', 'Zayd ibn Haritha', 2),
  ('KASHIF-2026-005', 'Aisha Siddiqa', 7)
on conflict (index_number) do nothing;

-- ---------------------------------------------------------------------------
-- parent_children
-- ---------------------------------------------------------------------------
create table if not exists public.parent_children (
  id uuid primary key default extensions.gen_random_uuid(),
  parent_id uuid not null references public.profiles (id) on delete cascade,
  child_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (parent_id, child_id)
);

-- ---------------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------------
create table if not exists public.attendance (
  id uuid primary key default extensions.gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  date date not null default current_date,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  excuse_note text,
  marked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id, date)
);

create trigger trg_attendance_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- leave_requests
-- ---------------------------------------------------------------------------
create table if not exists public.leave_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null,
  status text not null check (status in ('pending', 'approved', 'rejected')) default 'pending',
  response_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_leave_requests_updated_at
  before update on public.leave_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- student_results
-- ---------------------------------------------------------------------------
create table if not exists public.student_results (
  id uuid primary key default extensions.gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  exam_name text not null,
  subject text not null,
  marks_obtained numeric(5,2) not null,
  max_marks numeric(5,2) not null default 100.00,
  grade text not null,
  remarks text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- student_fees
-- ---------------------------------------------------------------------------
create table if not exists public.student_fees (
  id uuid primary key default extensions.gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  month text not null, -- format: 'YYYY-MM'
  total_due numeric(10,2) not null default 5000.00,
  paid_amount numeric(10,2) not null default 0.00,
  payments jsonb not null default '[]'::jsonb, -- logs of partial payments [{amount, date, note}]
  status text not null check (status in ('unpaid', 'partial', 'completed')) default 'unpaid',
  updated_at timestamptz not null default now(),
  unique (student_id, month)
);

create trigger trg_student_fees_updated_at
  before update on public.student_fees
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tutor_salaries
-- ---------------------------------------------------------------------------
create table if not exists public.tutor_salaries (
  id uuid primary key default extensions.gen_random_uuid(),
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  month text not null, -- format: 'YYYY-MM'
  amount numeric(10,2) not null,
  status text not null check (status in ('pending', 'paid')) default 'pending',
  updated_at timestamptz not null default now(),
  unique (tutor_id, month)
);

create trigger trg_tutor_salaries_updated_at
  before update on public.tutor_salaries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tutor_jobs
-- ---------------------------------------------------------------------------
create table if not exists public.tutor_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  academic_year int not null default 2026,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default extensions.gen_random_uuid(),
  title text not null,
  description text not null,
  event_date timestamptz not null,
  created_at timestamptz not null default now()
);

-- Seed some test events
insert into public.events (title, description, event_date)
values
  ('Annual Quran Competition 2026', 'Join our students for the annual Hifz and Tajweed competition with special guest speakers.', now() + interval '14 days'),
  ('Admissions Open for Year 2026/2027', 'Applications are now open for Class 1 to Class 7 preliminary studies.', now() + interval '30 days'),
  ('Islamic Calligraphy Exhibition', 'Showcase of calligraphy works completed by our students during the semester.', now() + interval '45 days')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RPC helper for index number verification (Publicly accessible)
-- ---------------------------------------------------------------------------
create or replace function public.verify_student_index(p_index_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_class int;
  v_registered boolean;
begin
  select student_name, class_number, is_registered
  into v_name, v_class, v_registered
  from public.valid_index_numbers
  where index_number = p_index_number;
  
  if not found then
    return jsonb_build_object('valid', false, 'error', 'Index number not found');
  elsif v_registered then
    return jsonb_build_object('valid', false, 'error', 'Index number is already registered');
  else
    return jsonb_build_object('valid', true, 'name', v_name, 'class', v_class);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger to automatically lock/use index number when a student profile is inserted
-- ---------------------------------------------------------------------------
create or replace function public.auto_register_index_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.index_number is not null then
    update public.valid_index_numbers
    set is_registered = true
    where index_number = new.index_number;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_register_index
  after insert on public.profiles
  for each row execute function public.auto_register_index_number();

-- ---------------------------------------------------------------------------
-- Row Level Security (RLS) Configuration & Policies
-- ---------------------------------------------------------------------------
alter table public.valid_index_numbers enable row level security;
alter table public.parent_children      enable row level security;
alter table public.attendance           enable row level security;
alter table public.leave_requests       enable row level security;
alter table public.student_results      enable row level security;
alter table public.student_fees         enable row level security;
alter table public.tutor_salaries       enable row level security;
alter table public.tutor_jobs           enable row level security;
alter table public.notifications        enable row level security;
alter table public.events               enable row level security;

-- 1. Helper function: is_treasurer()
create or replace function public.is_treasurer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'user'
      and account_type = 'tutor'
      and assigned_tutor_role = 'treasurer'
  );
$$;

-- 2. Helper function: is_tutor()
create or replace function public.is_tutor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'user'
      and account_type = 'tutor'
  );
$$;

-- 3. Helper function: is_parent_of(student_id)
create or replace function public.is_parent_of(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.parent_children
    where parent_id = auth.uid() and child_id = p_student_id
  );
$$;

-- Valid Index Numbers policies
create policy "valid_indexes: staff read all"
  on public.valid_index_numbers for select using (public.is_staff());

create policy "valid_indexes: staff manage"
  on public.valid_index_numbers for all using (public.is_staff()) with check (public.is_staff());

-- Parent Children policies
create policy "parent_children: view own"
  on public.parent_children for select
  using (parent_id = auth.uid() or child_id = auth.uid() or public.is_staff() or public.is_tutor());

create policy "parent_children: staff manage"
  on public.parent_children for all
  using (public.is_staff())
  with check (public.is_staff());

-- Attendance policies
create policy "attendance: student view own"
  on public.attendance for select
  using (student_id = auth.uid() or public.is_parent_of(student_id) or public.is_tutor() or public.is_staff());

create policy "attendance: tutor manage own"
  on public.attendance for all
  using (public.is_tutor() or public.is_staff())
  with check (public.is_tutor() or public.is_staff());

-- Leave Requests policies
create policy "leaves: owner read"
  on public.leave_requests for select
  using (student_id = auth.uid() or parent_id = auth.uid() or public.is_parent_of(student_id) or public.is_tutor() or public.is_staff());

create policy "leaves: parent or student insert"
  on public.leave_requests for insert
  to authenticated
  with check (student_id = auth.uid() or parent_id = auth.uid() or public.is_parent_of(student_id));

create policy "leaves: owner update pending"
  on public.leave_requests for update
  using ((student_id = auth.uid() or parent_id = auth.uid()) and status = 'pending')
  with check (student_id = auth.uid() or parent_id = auth.uid());

create policy "leaves: tutor review"
  on public.leave_requests for update
  using (public.is_tutor() or public.is_staff())
  with check (public.is_tutor() or public.is_staff());

create policy "leaves: staff delete"
  on public.leave_requests for delete
  using (public.is_staff());

-- Student Results policies
create policy "results: view own or children"
  on public.student_results for select
  using (student_id = auth.uid() or public.is_parent_of(student_id) or public.is_tutor() or public.is_staff());

create policy "results: tutor write"
  on public.student_results for all
  using (public.is_tutor() or public.is_staff())
  with check (public.is_tutor() or public.is_staff());

-- Student Fees policies
create policy "fees: view own or child"
  on public.student_fees for select
  using (student_id = auth.uid() or public.is_parent_of(student_id) or public.is_treasurer() or public.is_staff());

create policy "fees: treasurer write"
  on public.student_fees for all
  using (public.is_treasurer() or public.is_staff())
  with check (public.is_treasurer() or public.is_staff());

-- Tutor Salaries policies
create policy "salaries: view own"
  on public.tutor_salaries for select
  using (tutor_id = auth.uid() or public.is_treasurer() or public.is_staff());

create policy "salaries: treasurer write"
  on public.tutor_salaries for all
  using (public.is_treasurer() or public.is_staff())
  with check (public.is_treasurer() or public.is_staff());

-- Tutor Jobs policies
create policy "jobs: read all"
  on public.tutor_jobs for select
  using (true);

create policy "jobs: staff write"
  on public.tutor_jobs for all
  using (public.is_staff())
  with check (public.is_staff());

-- Notifications policies
create policy "notifications: read own"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "notifications: update own"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notifications: staff write"
  on public.notifications for insert
  with check (public.is_staff() or public.is_tutor() or public.is_treasurer());

create policy "notifications: staff delete"
  on public.notifications for delete
  using (public.is_staff());

-- Events policies
create policy "events: read public"
  on public.events for select
  using (true);

create policy "events: staff write"
  on public.events for all
  using (public.is_staff())
  with check (public.is_staff());
