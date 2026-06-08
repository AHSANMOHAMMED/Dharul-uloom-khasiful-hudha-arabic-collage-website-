-- =============================================================================
-- 0010_lms.sql
-- Learning materials, assignments, and student submissions.
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- Helper: parent can read class-scoped content if linked child is in that class
create or replace function public.is_parent_of_student_in_class(p_class int)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.parent_children pc
    join public.profiles child on child.id = pc.child_id
    where pc.parent_id = auth.uid()
      and child.class_number = p_class
  );
$$;

create table if not exists public.lms_materials (
  id           uuid primary key default extensions.gen_random_uuid(),
  tutor_id     uuid not null references public.profiles (id) on delete cascade,
  class_number int not null check (class_number between 1 and 7),
  subject      text not null,
  title        text not null,
  description  text,
  file_url     text,
  link_url     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.lms_assignments (
  id           uuid primary key default extensions.gen_random_uuid(),
  tutor_id     uuid not null references public.profiles (id) on delete cascade,
  class_number int not null check (class_number between 1 and 7),
  subject      text not null default 'General',
  title        text not null,
  description  text,
  due_date     date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.lms_submissions (
  id            uuid primary key default extensions.gen_random_uuid(),
  assignment_id uuid not null references public.lms_assignments (id) on delete cascade,
  student_id    uuid not null references public.profiles (id) on delete cascade,
  content       text,
  file_url      text,
  grade         text,
  feedback      text,
  submitted_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create trigger trg_lms_materials_updated_at
  before update on public.lms_materials
  for each row execute function public.set_updated_at();

create trigger trg_lms_assignments_updated_at
  before update on public.lms_assignments
  for each row execute function public.set_updated_at();

create trigger trg_lms_submissions_updated_at
  before update on public.lms_submissions
  for each row execute function public.set_updated_at();

alter table public.lms_materials    enable row level security;
alter table public.lms_assignments  enable row level security;
alter table public.lms_submissions  enable row level security;

create policy "lms_materials: read by class or staff"
  on public.lms_materials for select
  to authenticated
  using (
    public.is_staff()
    or public.is_tutor()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.account_type = 'student'
        and p.class_number = lms_materials.class_number
    )
    or public.is_parent_of_student_in_class(lms_materials.class_number)
  );

create policy "lms_materials: tutor write"
  on public.lms_materials for all
  using (public.is_staff() or tutor_id = auth.uid())
  with check (public.is_staff() or tutor_id = auth.uid());

create policy "lms_assignments: read by class or staff"
  on public.lms_assignments for select
  to authenticated
  using (
    public.is_staff()
    or public.is_tutor()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.account_type = 'student'
        and p.class_number = lms_assignments.class_number
    )
    or public.is_parent_of_student_in_class(lms_assignments.class_number)
  );

create policy "lms_assignments: tutor write"
  on public.lms_assignments for all
  using (public.is_staff() or tutor_id = auth.uid())
  with check (public.is_staff() or tutor_id = auth.uid());

create policy "lms_submissions: read own child or tutor"
  on public.lms_submissions for select
  using (
    student_id = auth.uid()
    or public.is_parent_of(student_id)
    or public.is_staff()
    or exists (
      select 1 from public.lms_assignments a
      where a.id = lms_submissions.assignment_id and a.tutor_id = auth.uid()
    )
  );

create policy "lms_submissions: student insert own"
  on public.lms_submissions for insert
  with check (student_id = auth.uid());

create policy "lms_submissions: student update own draft"
  on public.lms_submissions for update
  using (student_id = auth.uid() or public.is_staff() or exists (
    select 1 from public.lms_assignments a where a.id = lms_submissions.assignment_id and a.tutor_id = auth.uid()
  ))
  with check (true);
