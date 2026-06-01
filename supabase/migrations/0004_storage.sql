-- =============================================================================
-- 0004_storage.sql
-- Storage buckets + policies.
--
--   covers : public-read bucket for book cover images.
--   books  : PRIVATE bucket for the book artifacts (PDF / HTML). Clients must
--            request a signed URL; only staff may upload/modify.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('books', 'books', false)
on conflict (id) do nothing;

-- ---- covers : public read, staff write -------------------------------------
create policy "covers: public read"
  on storage.objects for select
  using (bucket_id = 'covers');

create policy "covers: staff write"
  on storage.objects for insert
  with check (bucket_id = 'covers' and public.is_staff());

create policy "covers: staff update"
  on storage.objects for update
  using (bucket_id = 'covers' and public.is_staff());

create policy "covers: staff delete"
  on storage.objects for delete
  using (bucket_id = 'covers' and public.is_staff());

-- ---- books : no public select (signed URLs only), staff write --------------
-- Staff may read directly; everyone else must use a signed URL minted by an
-- Edge Function / service role, so we intentionally do NOT add a public select
-- policy here.
create policy "books: staff read"
  on storage.objects for select
  using (bucket_id = 'books' and public.is_staff());

create policy "books: staff write"
  on storage.objects for insert
  with check (bucket_id = 'books' and public.is_staff());

create policy "books: staff update"
  on storage.objects for update
  using (bucket_id = 'books' and public.is_staff());

create policy "books: staff delete"
  on storage.objects for delete
  using (bucket_id = 'books' and public.is_staff());
