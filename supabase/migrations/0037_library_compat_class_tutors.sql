-- =============================================================================
-- 0037_library_compat_class_tutors.sql
--
-- 1. Library: the librarian portal, Shamela importer and reader use
--    books.author / categories / cover_url / drive_* / source_link /
--    imported_at. Those columns only existed in the superseded
--    20240730000000 draft (now a no-op), so on a clean database "Add book"
--    failed ("Could not find the 'author' column") and search results had no
--    author, cover or categories. Add them (no-op where they already exist).
--
-- 2. search_books(): return the fields the app renders (author, categories,
--    cover_url, drive links) with fallbacks to the canonical author /
--    category tables, and accept the category / author filters as text — the
--    UI filters by name; the bigint parameters rejected every filtered search.
--
-- 3. my_class_tutors(): students and parents can see who teaches their class
--    (name, phone, subject) without opening the whole staff directory.
--    Replaces dashboard reads of tutor_jobs.class_number, a column that does
--    not exist, which left "Ask your tutor" permanently disabled.
-- =============================================================================

alter table public.books
  add column if not exists author            text,
  add column if not exists categories        text[] not null default '{}',
  add column if not exists cover_url         text,
  add column if not exists drive_file_id     text,
  add column if not exists drive_preview_url text,
  add column if not exists source_link       text,
  add column if not exists imported_at       timestamptz not null default now();

create index if not exists idx_books_categories on public.books using gin (categories);
create index if not exists idx_books_imported_at on public.books (imported_at desc);

drop function if exists public.search_books(text, text, bigint, bigint, int, int);
drop function if exists public.search_books(text, text, text, text, int, int);

create function public.search_books(
  q          text default '',
  p_language text default null,
  p_category text default null,
  p_author   text default null,
  p_limit    int  default 24,
  p_offset   int  default 0
)
returns table (
  id                uuid,
  shamela_id        bigint,
  title_ar          text,
  title_en          text,
  author            text,
  categories        text[],
  description       text,
  language          text,
  year              int,
  pages             int,
  drive_file_id     text,
  drive_preview_url text,
  cover_url         text,
  source_link       text,
  imported_at       timestamptz,
  file_path         text,
  total_count       bigint,
  rank              real
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with normalized as (
    select nullif(trim(coalesce(q, '')), '') as raw,
           public.normalize_arabic(coalesce(q, '')) as nrm,
           nullif(trim(coalesce(p_category, '')), '') as cat,
           nullif(trim(coalesce(p_author, '')), '') as auth
  ),
  tsq as (
    select case
             when (select raw from normalized) is null then null
             else websearch_to_tsquery('simple', (select nrm from normalized))
           end as query
  ),
  filtered as (
    select b.*,
           case
             when (select query from tsq) is null then 0::real
             else ts_rank(b.search_vector, (select query from tsq))
           end as ts_rank_val,
           case
             when (select raw from normalized) is null then 0::real
             else similarity(public.normalize_arabic(b.title_ar), (select nrm from normalized))
           end as trgm_sim
    from public.books b
    where (b.is_public or public.is_staff())
      and (p_language is null or b.language = p_language)
      and (
        (select cat from normalized) is null
        or (select cat from normalized) = any (b.categories)
        or exists (select 1 from public.categories c
                   where (c.id = b.category_id
                          or exists (select 1 from public.book_categories bc where bc.book_id = b.id and bc.category_id = c.id))
                     and (select cat from normalized) in (c.name_ar, c.name_en, c.id::text))
      )
      and (
        (select auth from normalized) is null
        or b.author ilike '%' || (select auth from normalized) || '%'
        or exists (select 1 from public.authors a
                   where (a.id = b.author_id
                          or exists (select 1 from public.book_authors ba where ba.book_id = b.id and ba.author_id = a.id))
                     and (a.id::text = (select auth from normalized)
                          or a.name_ar ilike '%' || (select auth from normalized) || '%'
                          or a.name_en ilike '%' || (select auth from normalized) || '%'))
      )
      and (
        (select query from tsq) is null
        or b.search_vector @@ (select query from tsq)
        or public.normalize_arabic(b.title_ar) % (select nrm from normalized)
      )
  ),
  counted as (
    select *, count(*) over () as total_count,
           (ts_rank_val + trgm_sim) as rank
    from filtered
  )
  select c.id, c.shamela_id, c.title_ar, c.title_en,
         coalesce(nullif(c.author, ''), a.name_ar, a.name_en) as author,
         case when cardinality(c.categories) > 0 then c.categories
              else array_remove(array[cat.name_ar], null) end as categories,
         c.description, c.language, c.year, c.pages,
         c.drive_file_id, c.drive_preview_url,
         coalesce(c.cover_url, c.cover_image) as cover_url,
         c.source_link, c.imported_at, c.file_path,
         c.total_count, c.rank
  from counted c
  left join public.authors a      on a.id = c.author_id
  left join public.categories cat on cat.id = c.category_id
  order by
    case when (select query from tsq) is null then 0 else c.rank end desc,
    c.title_ar asc
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.search_books(text, text, text, text, int, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
create or replace function public.my_class_tutors(p_student uuid default null)
returns table (tutor_id uuid, full_name text, phone text, subject text, subject_code text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_student uuid := coalesce(p_student, auth.uid());
  v_class   int;
  v_org     uuid;
begin
  if auth.uid() is null or not public.mfa_ok() then
    return;
  end if;
  if not (v_student = auth.uid() or public.is_parent_of(v_student) or public.is_employee()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select class_number, org_id into v_class, v_org from public.profiles
  where id = v_student and account_type = 'student';
  if v_class is null then
    return;
  end if;
  return query
    select distinct on (cs.tutor_id) cs.tutor_id, p.full_name, p.phone, s.name_en, s.code
    from public.class_subjects cs
    join public.profiles p on p.id = cs.tutor_id and p.is_approved
    left join public.subjects s on s.id = cs.subject_id
    where cs.org_id = v_org and cs.class_number = v_class and cs.tutor_id is not null
    order by cs.tutor_id, s.code;
end $$;
grant execute on function public.my_class_tutors(uuid) to authenticated;
