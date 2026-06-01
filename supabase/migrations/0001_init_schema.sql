-- =============================================================================
-- 0001_init_schema.sql
-- Core schema for the Dharul Uloom Kashiful Hudha digital Islamic library.
--
-- Designed for large-scale Arabic / Urdu / English content (Al-Maktaba
-- al-Shamela style). Includes Arabic-aware normalization, full-text search
-- (tsvector + GIN), trigram fuzzy search, and updated_at maintenance.
--
-- Run order: 0001 -> 0002 (rls) -> 0003 (search) -> 0004 (storage).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
-- On Supabase these extensions live in the dedicated "extensions" schema; on a
-- vanilla Postgres they default to "public". We create the schema if needed and
-- install there so behaviour is identical in both environments.
create schema if not exists extensions;
create extension if not exists "pgcrypto" with schema extensions;   -- gen_random_uuid()
create extension if not exists "pg_trgm"  with schema extensions;   -- trigram fuzzy search
create extension if not exists "unaccent" with schema extensions;   -- diacritic-insensitive search

-- The migration runner does NOT include "extensions" in its search_path (unlike
-- the PostgREST runtime), so qualify it here. This lets bare references such as
-- gin_trgm_ops / unaccent() resolve while CREATE INDEX runs below.
set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- Arabic text normalization
--
-- Postgres has no built-in Arabic stemmer, so we normalise text before
-- building the search vector: strip tashkeel (harakat), remove tatweel, and
-- fold the alef / yaa / taa-marbuta variants. This makes search match
-- regardless of how the user typed the diacritics.
-- IMMUTABLE so it can be used in generated columns / indexes.
-- ---------------------------------------------------------------------------
create or replace function public.normalize_arabic(input text)
returns text
language sql
immutable
strict
-- pin search_path so unaccent() resolves no matter which schema the caller uses.
set search_path = public, extensions, pg_temp
as $$
  select
    regexp_replace(
      -- fold variants: أ إ آ -> ا ; ى -> ي ; ة -> ه
      translate(
        -- remove tashkeel (U+0610-061A, U+064B-065F, U+0670, U+06D6-06ED) and
        -- tatweel (U+0640)
        regexp_replace(
          lower(unaccent(input)),
          '[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0640]',
          '',
          'g'
        ),
        'أإآىة',
        'اايه'
      ),
      '\s+', ' ', 'g'
    );
$$;

comment on function public.normalize_arabic(text) is
  'Normalises Arabic text for search: strips tashkeel/tatweel and folds alef/yaa/taa-marbuta variants.';

-- Generic updated_at maintenance trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles : application-level user data, mirrors auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  role        text not null default 'user'
              check (role in ('user', 'librarian', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Returns true when the current user is staff (librarian/admin).
-- SECURITY DEFINER so it can read profiles regardless of the caller's RLS.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('librarian', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- authors
-- ---------------------------------------------------------------------------
create table if not exists public.authors (
  id          bigint generated by default as identity primary key,
  shamela_id  bigint unique,                 -- source id from Shamela master db
  name_ar     text not null,
  name_en     text,
  biography   text,
  death_year  int,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_authors_updated_at
  before update on public.authors
  for each row execute function public.set_updated_at();

create index if not exists idx_authors_name_ar_trgm
  on public.authors using gin (public.normalize_arabic(name_ar) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- categories (self-referencing tree)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id          bigint generated by default as identity primary key,
  shamela_id  bigint unique,
  name_ar     text not null,
  name_en     text,
  slug        text unique,
  parent_id   bigint references public.categories (id) on delete set null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create index if not exists idx_categories_parent on public.categories (parent_id);

-- ---------------------------------------------------------------------------
-- books
-- ---------------------------------------------------------------------------
create table if not exists public.books (
  id            uuid primary key default gen_random_uuid(),
  shamela_id    bigint unique,
  title_ar      text not null,
  title_en      text,
  description   text,
  language      text not null default 'ar'
                check (language in ('ar', 'ur', 'en', 'mixed')),
  year          int,
  pages         int,
  file_path     text,             -- storage path of the PDF/HTML artifact
  cover_image   text,             -- storage path or external URL of cover
  is_public     boolean not null default true,
  tags          text[] not null default '{}',
  author_id     bigint references public.authors (id) on delete set null,
  category_id   bigint references public.categories (id) on delete set null,
  full_text     text,             -- concatenated cleaned text (for search)
  search_vector tsvector,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_books_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

-- Build the weighted search vector on insert/update.
create or replace function public.books_search_vector_update()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', public.normalize_arabic(coalesce(new.title_ar, ''))), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.title_en, '')), 'A') ||
    setweight(to_tsvector('simple', array_to_string(new.tags, ' ')), 'B') ||
    setweight(to_tsvector('simple', public.normalize_arabic(coalesce(new.description, ''))), 'C') ||
    setweight(to_tsvector('simple', public.normalize_arabic(coalesce(new.full_text, ''))), 'D');
  return new;
end;
$$;

create trigger trg_books_search_vector
  before insert or update of title_ar, title_en, description, tags, full_text
  on public.books
  for each row execute function public.books_search_vector_update();

create index if not exists idx_books_search_vector on public.books using gin (search_vector);
create index if not exists idx_books_title_ar_trgm
  on public.books using gin (public.normalize_arabic(title_ar) gin_trgm_ops);
create index if not exists idx_books_title_en_trgm
  on public.books using gin (lower(title_en) gin_trgm_ops);
create index if not exists idx_books_tags on public.books using gin (tags);
create index if not exists idx_books_author on public.books (author_id);
create index if not exists idx_books_category on public.books (category_id);
create index if not exists idx_books_language on public.books (language);
create index if not exists idx_books_is_public on public.books (is_public);
create index if not exists idx_books_year on public.books (year);

-- ---------------------------------------------------------------------------
-- Many-to-many: book_authors / book_categories
-- ---------------------------------------------------------------------------
create table if not exists public.book_authors (
  book_id   uuid not null references public.books (id) on delete cascade,
  author_id bigint not null references public.authors (id) on delete cascade,
  primary key (book_id, author_id)
);
create index if not exists idx_book_authors_author on public.book_authors (author_id);

create table if not exists public.book_categories (
  book_id     uuid not null references public.books (id) on delete cascade,
  category_id bigint not null references public.categories (id) on delete cascade,
  primary key (book_id, category_id)
);
create index if not exists idx_book_categories_category on public.book_categories (category_id);

-- ---------------------------------------------------------------------------
-- book_pages : per-page cleaned text for the reader and granular search
-- ---------------------------------------------------------------------------
create table if not exists public.book_pages (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references public.books (id) on delete cascade,
  page_index    int not null,          -- 1-based ordering used by the reader
  page_label    text,                  -- printed page number, may be non-numeric
  part          text,                  -- volume / part label
  content       text not null,         -- cleaned text / markdown
  search_vector tsvector,
  created_at    timestamptz not null default now(),
  unique (book_id, page_index)
);

create or replace function public.book_pages_search_vector_update()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    to_tsvector('simple', public.normalize_arabic(coalesce(new.content, '')));
  return new;
end;
$$;

create trigger trg_book_pages_search_vector
  before insert or update of content on public.book_pages
  for each row execute function public.book_pages_search_vector_update();

create index if not exists idx_book_pages_search on public.book_pages using gin (search_vector);
create index if not exists idx_book_pages_book on public.book_pages (book_id, page_index);

-- ---------------------------------------------------------------------------
-- User engagement: bookmarks / reads (progress) / notes / favorites
-- ---------------------------------------------------------------------------
create table if not exists public.bookmarks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  book_id     uuid not null references public.books (id) on delete cascade,
  page_number int,
  label       text,
  created_at  timestamptz not null default now(),
  unique (user_id, book_id, page_number)
);
create index if not exists idx_bookmarks_user on public.bookmarks (user_id);

create table if not exists public.reads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  book_id     uuid not null references public.books (id) on delete cascade,
  last_page   int not null default 1,
  progress    numeric(5, 2) not null default 0,  -- 0..100 percent
  updated_at  timestamptz not null default now(),
  unique (user_id, book_id)
);
create index if not exists idx_reads_user on public.reads (user_id);

create trigger trg_reads_updated_at
  before update on public.reads
  for each row execute function public.set_updated_at();

create table if not exists public.user_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  book_id     uuid not null references public.books (id) on delete cascade,
  page_number int,
  content     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_user_notes_user on public.user_notes (user_id);
create index if not exists idx_user_notes_book on public.user_notes (book_id);

create trigger trg_user_notes_updated_at
  before update on public.user_notes
  for each row execute function public.set_updated_at();

create table if not exists public.favorites (
  user_id    uuid not null references auth.users (id) on delete cascade,
  book_id    uuid not null references public.books (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);
