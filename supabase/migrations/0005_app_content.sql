-- =============================================================================
-- 0005_app_content.sql
-- Phase 2: migrate the site's dynamic content off MongoDB/Express onto Supabase.
--
-- Adds the application tables that used to live in Mongoose models:
--   * admissions        (student applications + review workflow)
--   * news              (announcements, bilingual en/ar)
--   * faculty           (staff directory, bilingual en/ar)
--   * curriculum        (7-year program; nested structure kept as JSONB)
--   * contact_messages  (public contact / guest enquiry form)
--
-- Also extends profiles with the school "account type" (guest/student/parent)
-- collected at registration, and teaches handle_new_user() to populate it.
--
-- RLS model:
--   * Public content (news/faculty/curriculum) is world-readable; staff write.
--   * Admissions are private to their submitter; staff read & review all.
--   * Contact messages can be created by anyone; only staff can read them.
-- =============================================================================

set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- profiles : carry the school account type chosen at sign-up.
-- (id/email/full_name/role already exist from 0001.)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists account_type text not null default 'guest'
    check (account_type in ('guest', 'student', 'parent'));

-- Re-define the signup hook so new auth users get full_name + account_type
-- copied from the metadata passed to supabase.auth.signUp({ data: {...} }).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, account_type)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'account_type', ''), 'guest')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- admissions
-- ---------------------------------------------------------------------------
create table if not exists public.admissions (
  id                 uuid primary key default extensions.gen_random_uuid(),
  student_name       text not null,
  age                int  not null check (age between 5 and 15),
  parent_name        text not null,
  phone              text not null,
  email              text,
  address            text not null,
  previous_education text,
  course             text not null
                     check (course in ('quran', 'arabic', 'hadith', 'fiqh', 'islamic')),
  status             text not null default 'pending'
                     check (status in ('pending', 'approved', 'rejected')),
  submitted_by       uuid references auth.users (id) on delete set null,
  reviewed_by        uuid references auth.users (id) on delete set null,
  reviewed_at        timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_admissions_status_created
  on public.admissions (status, created_at desc);
create index if not exists idx_admissions_submitted_by
  on public.admissions (submitted_by);

create trigger trg_admissions_updated_at
  before update on public.admissions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- news
-- ---------------------------------------------------------------------------
create table if not exists public.news (
  id           uuid primary key default extensions.gen_random_uuid(),
  title_en     text not null,
  title_ar     text,
  content_en   text not null,
  content_ar   text,
  author       text default 'Admin',
  image        text,
  category     text not null default 'general'
               check (category in ('admissions', 'events', 'announcements', 'general')),
  is_published boolean not null default true,
  date         timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_news_published_date
  on public.news (is_published, date desc);

create trigger trg_news_updated_at
  before update on public.news
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- faculty
-- ---------------------------------------------------------------------------
create table if not exists public.faculty (
  id             uuid primary key default extensions.gen_random_uuid(),
  name_en        text not null,
  name_ar        text,
  role_en        text not null,
  role_ar        text,
  bio_en         text,
  bio_ar         text,
  image          text,
  qualifications text[] not null default '{}',
  email          text,
  phone          text,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_faculty_sort_order
  on public.faculty (sort_order);

create trigger trg_faculty_updated_at
  before update on public.faculty
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- curriculum
-- The Mongoose document had a deeply nested structure (modules -> books,
-- bilingual objective/assessment arrays). We keep that shape verbatim as JSONB
-- so the existing React rendering does not need to change.
-- ---------------------------------------------------------------------------
create table if not exists public.curriculum (
  id                 uuid primary key default extensions.gen_random_uuid(),
  class_number       int not null unique check (class_number between 1 and 7),
  class_name         jsonb not null default '{}'::jsonb,   -- { en, ar }
  age_range          jsonb not null default '{}'::jsonb,   -- { min, max }
  modules            jsonb not null default '[]'::jsonb,   -- [{ name:{en,ar}, ... }]
  objectives         jsonb not null default '{}'::jsonb,   -- { en:[], ar:[] }
  assessment_methods jsonb not null default '{}'::jsonb,   -- { en:[], ar:[] }
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger trg_curriculum_updated_at
  before update on public.curriculum
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- contact_messages
-- ---------------------------------------------------------------------------
create table if not exists public.contact_messages (
  id           uuid primary key default extensions.gen_random_uuid(),
  name         text not null,
  email        text not null,
  phone        text,
  subject      text,
  message      text not null,
  is_read      boolean not null default false,
  responded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_contact_unread_created
  on public.contact_messages (is_read, created_at desc);

create trigger trg_contact_messages_updated_at
  before update on public.contact_messages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.admissions       enable row level security;
alter table public.news             enable row level security;
alter table public.faculty          enable row level security;
alter table public.curriculum       enable row level security;
alter table public.contact_messages enable row level security;

-- admissions: submitter owns their rows; staff review everything.
create policy "admissions: insert own"
  on public.admissions for insert
  to authenticated
  with check (submitted_by = auth.uid());

create policy "admissions: read own or staff"
  on public.admissions for select
  using (submitted_by = auth.uid() or public.is_staff());

create policy "admissions: staff update"
  on public.admissions for update
  using (public.is_staff())
  with check (public.is_staff());

create policy "admissions: staff delete"
  on public.admissions for delete
  using (public.is_staff());

-- news: published rows are world-readable; staff manage all.
create policy "news: public read published"
  on public.news for select
  using (is_published or public.is_staff());

create policy "news: staff write"
  on public.news for all
  using (public.is_staff())
  with check (public.is_staff());

-- faculty: world-readable; staff manage.
create policy "faculty: public read"
  on public.faculty for select using (true);

create policy "faculty: staff write"
  on public.faculty for all
  using (public.is_staff())
  with check (public.is_staff());

-- curriculum: world-readable; staff manage.
create policy "curriculum: public read"
  on public.curriculum for select using (true);

create policy "curriculum: staff write"
  on public.curriculum for all
  using (public.is_staff())
  with check (public.is_staff());

-- contact_messages: anyone may submit; only staff may read / triage.
create policy "contact: anyone insert"
  on public.contact_messages for insert
  to anon, authenticated
  with check (true);

create policy "contact: staff read"
  on public.contact_messages for select
  using (public.is_staff());

create policy "contact: staff update"
  on public.contact_messages for update
  using (public.is_staff())
  with check (public.is_staff());
