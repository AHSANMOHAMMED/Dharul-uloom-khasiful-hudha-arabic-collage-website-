-- =============================================================================
-- 0002_rls.sql
-- Row Level Security policies.
--
-- Model:
--   * Catalog (authors, categories, books, joins, pages) is publicly readable
--     for PUBLIC books; staff (librarian/admin) can write.
--   * Per-user data (profiles, bookmarks, reads, notes, favorites) is private
--     to its owner; staff can read for moderation.
-- =============================================================================

alter table public.profiles        enable row level security;
alter table public.authors         enable row level security;
alter table public.categories      enable row level security;
alter table public.books           enable row level security;
alter table public.book_authors    enable row level security;
alter table public.book_categories enable row level security;
alter table public.book_pages      enable row level security;
alter table public.bookmarks       enable row level security;
alter table public.reads           enable row level security;
alter table public.user_notes      enable row level security;
alter table public.favorites       enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles: read own or staff"
  on public.profiles for select
  using (id = auth.uid() or public.is_staff());

create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: staff manage"
  on public.profiles for all
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- authors / categories : world-readable, staff write
-- ---------------------------------------------------------------------------
create policy "authors: public read"     on public.authors    for select using (true);
create policy "authors: staff write"     on public.authors    for all    using (public.is_staff()) with check (public.is_staff());

create policy "categories: public read"  on public.categories for select using (true);
create policy "categories: staff write"  on public.categories for all    using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- books : public can read public books; staff read all & write
-- ---------------------------------------------------------------------------
create policy "books: public read public"
  on public.books for select
  using (is_public or public.is_staff());

create policy "books: staff write"
  on public.books for all
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- book_authors / book_categories : readable when the parent book is visible
-- ---------------------------------------------------------------------------
create policy "book_authors: read visible"
  on public.book_authors for select
  using (exists (
    select 1 from public.books b
    where b.id = book_id and (b.is_public or public.is_staff())
  ));
create policy "book_authors: staff write"
  on public.book_authors for all
  using (public.is_staff()) with check (public.is_staff());

create policy "book_categories: read visible"
  on public.book_categories for select
  using (exists (
    select 1 from public.books b
    where b.id = book_id and (b.is_public or public.is_staff())
  ));
create policy "book_categories: staff write"
  on public.book_categories for all
  using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- book_pages : readable when the parent book is public; staff write
-- ---------------------------------------------------------------------------
create policy "book_pages: read public book"
  on public.book_pages for select
  using (exists (
    select 1 from public.books b
    where b.id = book_id and (b.is_public or public.is_staff())
  ));
create policy "book_pages: staff write"
  on public.book_pages for all
  using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Per-user engagement tables : owner-only, staff read
-- ---------------------------------------------------------------------------
create policy "bookmarks: owner all"
  on public.bookmarks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "bookmarks: staff read"
  on public.bookmarks for select using (public.is_staff());

create policy "reads: owner all"
  on public.reads for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reads: staff read"
  on public.reads for select using (public.is_staff());

create policy "user_notes: owner all"
  on public.user_notes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user_notes: staff read"
  on public.user_notes for select using (public.is_staff());

create policy "favorites: owner all"
  on public.favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
