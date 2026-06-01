---
name: testing-library
description: E2E test the Supabase-backed Digital Library (browse, Arabic search, category filter, BookReader). Use when verifying Library UI, Arabic full-text search, RLS, or BookReader changes.
---

# Testing the Digital Library (Phase 1)

The Library is a React + Vite + Tailwind page backed by Supabase (PostgreSQL + PostgREST + Auth + Storage). It supports Arabic-aware full-text search, category/language filters, and an in-app BookReader (RTL, font size, night mode, pager, notes/bookmarks).

## Bring up a local stack (no live credentials needed)
The real 17k Shamela import and the user's hosted Supabase need credentials (Shamela API key via mail@shamela.ws + a Supabase project). For UI testing you do NOT need those — run a local stack instead:

1. Supabase CLI lives at `/home/ubuntu/tools/supabase`. From the repo root run `supabase start` (Docker). This applies the migrations in `supabase/migrations/` automatically.
2. Local endpoints: REST `http://127.0.0.1:54321`, DB `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (container `supabase_db_repo`). The anon key is printed by `supabase status`.
3. Create `.env` (gitignored) with `VITE_SUPABASE_URL=http://127.0.0.1:54321` and `VITE_SUPABASE_ANON_KEY=<anon key>`.
4. `npm install` then `npm run dev` → app at `http://localhost:3000/library`.
5. Seed sample data: a handful of public Arabic books across categories (Hadith/Tafsir/Fiqh/Aqidah/Sira/Tazkiyah), at least one `is_public=false` book to prove RLS hides it from anon, and 2+ rows in `book_pages` (columns: `book_id`, `page_index`, `page_label`, `part`, `content`) for one book so the reader has pages.

## Primary E2E flow (all via UI as anonymous user)
- **Browse**: `/library` shows only public books; count text reads "N books"; the private book must NOT appear (RLS).
- **Arabic exact search**: type an Arabic title fragment, click Search → expect the matching book(s) only.
- **Diacritic-insensitive search**: same term with tashkeel (e.g. `رِيَاض`) must return the same result (proves `normalize_arabic()` / unaccent works).
- **Category filter**: pick a category from the dropdown → count narrows to only that category's books.
- **BookReader**: click a book card → reader opens with RTL Arabic text, "Page 1 / N", Previous disabled. Next advances page + content; A+/A- resizes text; Night toggles dark panel (label flips Day/Night).

## Gotchas / lessons learned
- **Typing Arabic via xdotool `type` does NOT work** (non-Latin chars dropped). Instead set the clipboard and paste: `printf '%s' "رياض" | DISPLAY=:0 xclip -selection clipboard`, then click the field and Ctrl+V. Install xclip if missing.
- **Search box vs dropdowns apply at different times**: the free-text query commits only on **Search submit**, while Language/Category dropdowns apply immediately. Clearing the input WITHOUT resubmitting leaves the old query applied, so a later category pick shows the intersection (looks like too few results). To test a filter alone, reload `/library` first for clean state. This is expected UX, not a bug.
- **PostgREST ambiguous embed (PGRST201)**: `books` relates to `authors`/`categories` both directly (`author_id`/`category_id`) and via junction tables, so embeds must use explicit FK hints, e.g. `authors!books_author_id_fkey ( ... )`. A missing hint makes the reader show "Book not found". See `src/lib/booksApi.js`.
- **Migration extension search_path**: extensions (`unaccent`, `pg_trgm`, `pgcrypto`) live in the `extensions` schema, which the migration runner's search_path excludes. Migrations/functions must install `with schema extensions` and pin `set search_path = public, extensions, pg_temp`, or `CREATE INDEX` using `unaccent()` fails at DB init. See `supabase/migrations/0001_init_schema.sql` and `0003_search.sql`.
- Verify queries quickly against REST with `curl` + the anon key before driving the UI, e.g. `curl "$URL/rest/v1/books?select=id" -H "apikey: $ANON"`. Note `book_pages` orders by `page_index` (there is no `page_number` column).
- Before recording, maximize the window: `wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz`.

## Devin Secrets Needed
- For UI testing: none (local stack only).
- For the real Shamela import / hosted Supabase: a Supabase project URL + service-role key, and a Shamela API key (issued via mail@shamela.ws). Save as permanent secrets when provided.
