-- Dharul Uloom Kashiful Hudha Islamic Library
-- Supabase schema for metadata only; PDFs remain in Google Drive.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------- Helpers ----------
create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

-- ---------- Tables ----------
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  shamela_id text unique not null,
  title_ar text not null,
  title_en text,
  author text not null,
  categories text[] not null default '{}',
  description text,
  language text not null default 'ar',
  year integer,
  pages integer,
  drive_file_id text not null,
  drive_preview_url text not null,
  cover_url text,
  source_link text,
  import_batch_id text,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists books_shamela_id_idx on public.books (shamela_id);
create index if not exists books_language_idx on public.books (language);
create index if not exists books_author_idx on public.books (author);
create index if not exists books_categories_gin_idx on public.books using gin (categories);
create index if not exists books_title_ar_trgm_idx on public.books using gin (title_ar gin_trgm_ops);
create index if not exists books_title_en_trgm_idx on public.books using gin (title_en gin_trgm_ops);

create or replace function public.set_books_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_books_updated_at on public.books;
create trigger trg_books_updated_at
before update on public.books
for each row
execute function public.set_books_updated_at();

-- ---------- RLS ----------
alter table public.books enable row level security;

drop policy if exists "Public can read books" on public.books;
create policy "Public can read books"
on public.books
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can insert books" on public.books;
create policy "Admins can insert books"
on public.books
for insert
to authenticated
with check (public.is_admin_user());

drop policy if exists "Admins can update books" on public.books;
create policy "Admins can update books"
on public.books
for update
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "Admins can delete books" on public.books;
create policy "Admins can delete books"
on public.books
for delete
to authenticated
using (public.is_admin_user());

-- ---------- Search helpers ----------
create or replace function public.search_books(
  q text default '',
  p_language text default null,
  p_category text default null,
  p_author text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  shamela_id text,
  title_ar text,
  title_en text,
  author text,
  categories text[],
  description text,
  language text,
  year integer,
  pages integer,
  drive_file_id text,
  drive_preview_url text,
  cover_url text,
  source_link text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select
      b.*,
      count(*) over() as total_count
    from public.books b
    where
      (
        coalesce(q, '') = ''
        or b.title_ar ilike '%' || q || '%'
        or b.title_en ilike '%' || q || '%'
        or b.author ilike '%' || q || '%'
        or b.description ilike '%' || q || '%'
        or exists (
          select 1
          from unnest(b.categories) c
          where c ilike '%' || q || '%'
        )
      )
      and (p_language is null or b.language = p_language)
      and (
        p_category is null
        or exists (
          select 1
          from unnest(b.categories) c
          where c = p_category
        )
      )
      and (p_author is null or b.author ilike '%' || p_author || '%')
    order by b.imported_at desc, b.title_ar asc
    limit greatest(coalesce(p_limit, 24), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select
    id, shamela_id, title_ar, title_en, author, categories, description,
    language, year, pages, drive_file_id, drive_preview_url, cover_url,
    source_link, total_count
  from filtered;
$$;

-- Optional view for dashboards / admin tooling.
create or replace view public.books_public as
select
  id, shamela_id, title_ar, title_en, author, categories, description,
  language, year, pages, drive_file_id, drive_preview_url, cover_url,
  source_link, imported_at, updated_at
from public.books;
