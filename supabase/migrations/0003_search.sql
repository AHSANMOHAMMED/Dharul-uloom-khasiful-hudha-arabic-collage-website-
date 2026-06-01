-- =============================================================================
-- 0003_search.sql
-- Search RPCs callable from the frontend via supabase.rpc(...).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- search_books : ranked full-text + trigram fallback over the catalog.
--
-- - q            free text (Arabic/Urdu/English). Empty -> browse mode.
-- - p_language   filter by language ('ar'|'ur'|'en'|'mixed') or null.
-- - p_category   filter by category id or null.
-- - p_author     filter by author id or null.
-- - p_limit /    pagination.
--   p_offset
--
-- Returns book rows plus a rank column (higher = better) and resolved
-- author/category display names so the UI can render cards in one round-trip.
-- ---------------------------------------------------------------------------
create or replace function public.search_books(
  q          text   default '',
  p_language text   default null,
  p_category bigint default null,
  p_author   bigint default null,
  p_limit    int    default 24,
  p_offset   int    default 0
)
returns table (
  id           uuid,
  title_ar     text,
  title_en     text,
  description  text,
  language     text,
  year         int,
  pages        int,
  cover_image  text,
  file_path    text,
  tags         text[],
  author_id    bigint,
  author_name  text,
  category_id  bigint,
  category_name text,
  total_count  bigint,
  rank         real
)
language sql
stable
as $$
  with normalized as (
    select nullif(trim(coalesce(q, '')), '') as raw,
           public.normalize_arabic(coalesce(q, '')) as nrm
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
      and (p_category is null or b.category_id = p_category
           or exists (select 1 from public.book_categories bc
                      where bc.book_id = b.id and bc.category_id = p_category))
      and (p_author is null or b.author_id = p_author
           or exists (select 1 from public.book_authors ba
                      where ba.book_id = b.id and ba.author_id = p_author))
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
  select c.id, c.title_ar, c.title_en, c.description, c.language, c.year,
         c.pages, c.cover_image, c.file_path, c.tags,
         c.author_id, a.name_ar as author_name,
         c.category_id, cat.name_ar as category_name,
         c.total_count, c.rank
  from counted c
  left join public.authors a    on a.id = c.author_id
  left join public.categories cat on cat.id = c.category_id
  order by
    case when (select query from tsq) is null then 0 else c.rank end desc,
    c.title_ar asc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

-- ---------------------------------------------------------------------------
-- search_book_pages : find matching pages within a single book (reader search).
-- ---------------------------------------------------------------------------
create or replace function public.search_book_pages(
  p_book_id uuid,
  q         text,
  p_limit   int default 50
)
returns table (
  id         uuid,
  page_index int,
  page_label text,
  snippet    text,
  rank       real
)
language sql
stable
as $$
  with query as (
    select websearch_to_tsquery('simple', public.normalize_arabic(coalesce(q, ''))) as ts
  )
  select p.id, p.page_index, p.page_label,
         ts_headline('simple', p.content, (select ts from query),
                     'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=25, MinWords=8') as snippet,
         ts_rank(p.search_vector, (select ts from query)) as rank
  from public.book_pages p
  where p.book_id = p_book_id
    and p.search_vector @@ (select ts from query)
  order by rank desc, p.page_index asc
  limit greatest(p_limit, 1);
$$;

-- Allow anonymous + authenticated clients to call the search RPCs.
-- Guarded so the migration is also runnable outside Supabase (where the
-- anon/authenticated roles may not exist).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.search_books(text, text, bigint, bigint, int, int) to anon;
    grant execute on function public.search_book_pages(uuid, text, int) to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.search_books(text, text, bigint, bigint, int, int) to authenticated;
    grant execute on function public.search_book_pages(uuid, text, int) to authenticated;
  end if;
end$$;
