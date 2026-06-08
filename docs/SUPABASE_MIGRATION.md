# Supabase Migration & Shamela Import Guide

This guide covers moving the digital library from the legacy MongoDB/Express
backend to **Supabase** (PostgreSQL + Auth + Storage), and bulk-importing the
**Al-Maktaba al-Shamela** collection via the official
[`ragaeeb/shamela`](https://github.com/ragaeeb/shamela) library.

> **Status (2026):** The SPA now uses Supabase for auth, content, library, payments, and LMS.
> Migrations `0001`–`0010` cover the full schema. Apply with `npm run db:apply:all`.

---

## 1. Create a Supabase project

1. Create a project at <https://supabase.com>.
2. From **Project Settings → API**, copy:
   - Project URL → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `anon` public key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**server-only, secret**)

## 2. Configure environment

Copy `.env.example` to `.env` and fill in the values. Browser vars are prefixed
`VITE_`; the `service_role` key and Shamela keys are **server-side only** and
must never be exposed to the frontend or committed.

## 3. Apply the database schema

Run the migrations in `supabase/migrations/` **in order**:

```bash
# Option A — Supabase CLI (recommended)
supabase link --project-ref <your-ref>
supabase db push

# Option B — paste each file into the SQL editor, in numeric order:
#   0001_init_schema.sql   tables, Arabic normalization, FTS + trigram indexes
#   0002_rls.sql           Row Level Security policies
#   0003_search.sql        search_books / search_book_pages RPCs
#   0007_schedules_announcements.sql
#   0008_gallery_courses_cms.sql
#   0009_payments.sql
#   0010_lms.sql
```

### What the schema provides
- **Catalog:** `authors`, `categories`, `books`, `book_authors`,
  `book_categories`, `book_pages`.
- **Engagement:** `profiles`, `bookmarks`, `reads`, `user_notes`, `favorites`.
- **Arabic search:** `normalize_arabic()` strips tashkeel/tatweel and folds
  alef/yaa/taa-marbuta; `books.search_vector` is a weighted `tsvector` (title ▸
  tags ▸ description ▸ full text) with a GIN index, plus `pg_trgm` fuzzy
  matching on titles. Query via the `search_books` RPC.
- **Security:** RLS makes the catalog world-readable for *public* books while
  restricting writes to `librarian`/`admin` roles; per-user tables are
  owner-only.

## 4. Make yourself a librarian/admin

After signing up (or creating a user in the dashboard):

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

Only `librarian`/`admin` can write to the catalog and upload to Storage.

## 5. Import the Shamela collection

### Option A — Offline archive (no API key)

Use the **shamela_ps** full zip (~7543 books, Shamela v4 SQLite inside). Requires **Python 3** (macOS `unzip` fails on this Archive.org file; the importer uses Python `zipfile` instead).

1. Download from **shamela_ps** (the old `shamela_1441_11_full` page is empty):
   - Browse: https://archive.org/details/shamela_ps
   - Direct (~6.7 GB): https://archive.org/download/shamela_ps/shamela_1441_113_full.zip
2. For legacy **v3 `.bok`** zips only: `brew install mdbtools`
3. Import:

```bash
# Test catalog import (5 books — titles/authors/categories)
npm run import:shamela:archive -- --archive-path ~/Downloads/shamela_1441_113_full.zip --limit 5

# Full catalog (~7543 books; resumes if interrupted)
npm run import:shamela:archive -- --archive-path ~/Downloads/shamela_1441_113_full.zip

# Readable page text from the zip (one-time ~7 GB extract + local Elasticsearch)
npm run import:shamela:archive -- --archive-path ~/Downloads/shamela_1441_113_full.zip --with-elasticsearch --limit 10
```

Page text in v4 zips lives in a bundled Elasticsearch index, not in the per-book `.db` files. Without `--with-elasticsearch`, the importer loads **metadata only**. For API-based page import, use Option B.

Set `SHAMELA_ARCHIVE_PATH` in `.env` to skip passing `--archive-path` each time.

### Option B — Shamela v4 API

Request a Shamela API key (`mail@shamela.ws`) and set `SHAMELA_API_KEY`,
`SHAMELA_BOOKS_ENDPOINT`, `SHAMELA_MASTER_ENDPOINT`.

```bash
# Smoke test — metadata only, no writes
npm run import:shamela -- --dry-run --limit 20

# Import a small batch with content first to validate end-to-end
npm run import:shamela -- --limit 50

# Full import (resumes automatically if interrupted)
npm run import:shamela

# Other flags
npm run import:shamela -- --books 26592,1234   # specific books
npm run import:shamela -- --metadata-only       # catalog without page text
npm run import:shamela -- --concurrency 4        # parallelism
npm run import:shamela -- --reset                # clear the checkpoint
```

### How the import works
1. Downloads the **master database** (authors, categories, books).
2. Upserts categories + authors keyed on `shamela_id` (idempotent).
3. Upserts each book's metadata + `book_authors`/`book_categories` joins.
4. Downloads each book, cleans the Arabic HTML to text (SDK sanitiser +
   footnote split + tag strip), builds an HTML artifact, uploads it to the
   private `books` bucket, inserts `book_pages`, and updates `full_text` +
   `pages` + `file_path`.
5. Writes progress to `scripts/shamela/.import-state.json` after every book, so
   re-running **resumes** and skips completed books. Failures are recorded and
   retried with exponential backoff.

### Add extra Urdu (or other) books manually

```bash
npm run upload:book -- \
  --file ./kitab.pdf --title-ar "عنوان الكتاب" \
  --author "اسم المؤلف" --language ur --category "فقه"
```

## 6. Point the frontend at Supabase

With `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set, the Library page
(`/library`) and reader (`/library/:id`) read from Supabase via
`src/lib/booksApi.js`. Until configured, the UI shows a non-blocking banner and
empty state so the app still builds and runs.

## 7. Migrating existing MongoDB books (optional)

The old `backend/models/Book.js` is a flat schema. Export your Mongo books to
JSON and adapt `scripts/shamela/manualUpload.mjs`, mapping:

| MongoDB            | Supabase                                  |
| ------------------ | ----------------------------------------- |
| `title`            | `title_ar` / `title_en`                   |
| `author` (string)  | `authors.name_ar` → `author_id`           |
| `category` (enum)  | `categories.name_ar` → `category_id`      |
| `language[]`       | `language` (`ar`/`ur`/`en`/`mixed`)       |
| `pdfUrl`           | upload to `books` bucket → `file_path`    |
| `coverUrl`         | `cover_image` (URL or `covers` path)      |

## Roadmap (later PRs)
- **Auth:** replace JWT/Express auth in `src/context/AuthContext.jsx` with
  Supabase Auth (`profiles` + roles).
- **Content:** migrate news/admissions/faculty/contact/curriculum to Supabase
  tables + Edge Functions (e.g. contact email, signed-URL minting), then retire
  the Express backend.
