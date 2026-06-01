-- =============================================================================
-- 0007_schedules_announcements.sql
-- Phase 4: Class schedule management and announcements system.
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- class_schedules
-- ---------------------------------------------------------------------------
create table if not exists public.class_schedules (
  id             uuid primary key default extensions.gen_random_uuid(),
  tutor_id       uuid not null references public.profiles (id) on delete cascade,
  class_number   int not null check (class_number between 1 and 7),
  subject        text not null,
  day_of_week    text not null check (day_of_week in ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  start_time     time not null,
  end_time       time not null,
  room           text,
  academic_year  int not null default 2026,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_class_schedules_updated_at
  before update on public.class_schedules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- announcements
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id           uuid primary key default extensions.gen_random_uuid(),
  author_id    uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  body         text not null,
  target_roles text[] not null default '{}'::text[],  -- empty = all authenticated users
  is_pinned    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed sample schedule entries (tutors won't exist yet, skip seeding)
-- We just add the structural seeds for announcements.
-- ---------------------------------------------------------------------------
-- Note: actual schedule seeds require real tutor profile IDs; skip for now.

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.class_schedules  enable row level security;
alter table public.announcements    enable row level security;

-- class_schedules: any authenticated user can read; staff & the assigned tutor can write
create policy "schedules: read authenticated"
  on public.class_schedules for select
  to authenticated
  using (true);

create policy "schedules: staff write"
  on public.class_schedules for insert
  with check (public.is_staff() or public.is_tutor());

create policy "schedules: staff update"
  on public.class_schedules for update
  using (public.is_staff() or tutor_id = auth.uid());

create policy "schedules: staff delete"
  on public.class_schedules for delete
  using (public.is_staff());

-- announcements: any authenticated user can read; staff / principal-level tutors can write
create policy "announcements: read authenticated"
  on public.announcements for select
  to authenticated
  using (true);

create policy "announcements: staff or principal write"
  on public.announcements for insert
  with check (
    public.is_staff()
    or (
      public.is_tutor()
      and exists (
        select 1 from public.profiles
        where id = auth.uid()
          and assigned_tutor_role in ('principal', 'vice_principal')
      )
    )
  );

create policy "announcements: author or staff update"
  on public.announcements for update
  using (author_id = auth.uid() or public.is_staff())
  with check (author_id = auth.uid() or public.is_staff());

create policy "announcements: staff delete"
  on public.announcements for delete
  using (public.is_staff() or author_id = auth.uid());
