# Architecture & Folder Structure

Target layout as the project migrates to a Supabase-backed digital library.

```
.
├── supabase/
│   ├── migrations/              # Versioned SQL (schema, RLS, search, storage)
│   │   ├── 0001_init_schema.sql
│   │   ├── 0002_rls.sql
│   │   ├── 0003_search.sql
│   │   └── 0004_storage.sql
│   └── functions/               # Edge Functions (signed URLs, contact email) — future
│
├── scripts/
│   └── shamela/                 # Resumable bulk import tooling
│       ├── lib.mjs              # Shared: clients, cleaning, retry, checkpoint
│       ├── importShamela.mjs    # Master + per-book import (resumable)
│       └── manualUpload.mjs     # Manual single-book (e.g. Urdu PDF) upload
│
├── src/
│   ├── lib/
│   │   ├── supabaseClient.js    # Browser client (+ isSupabaseConfigured guard)
│   │   ├── booksApi.js          # Catalog read/search + Storage URL helpers
│   │   └── libraryUserApi.js    # Bookmarks / progress / notes / favorites
│   ├── components/
│   │   └── library/
│   │       ├── BookCard.jsx     # Grid card (Arabic-first, RTL)
│   │       ├── AdvancedSearch.jsx
│   │       └── BookReader.jsx   # Text + PDF reader (RTL, night mode, notes)
│   ├── pages/
│   │   ├── Library.jsx          # Search + filters + infinite scroll
│   │   ├── BookReaderPage.jsx   # /library/:id
│   │   └── ...                  # existing pages
│   ├── context/AuthContext.jsx  # JWT today → Supabase Auth (future)
│   └── i18n.js                  # en/ar resources
│
├── backend/                     # Legacy Express + MongoDB (retired in later phases)
└── docs/
    ├── SUPABASE_MIGRATION.md    # Migration + Shamela import guide
    └── ARCHITECTURE.md          # This file
```

## Data flow (library)

```
Browser ─ supabaseClient ─▶ Supabase
   │                          ├─ search_books / search_book_pages (RPC, RLS)
   │                          ├─ books / book_pages / authors / categories
   │                          └─ Storage: covers (public), books (signed URLs)
   │
booksApi.js / libraryUserApi.js  ← thin data layer, degrades gracefully
```

## Design notes
- **Arabic-first:** Arabic title is the primary label everywhere; rendered RTL
  regardless of UI language. Fonts: Amiri / Scheherazade New / Noto Naskh Arabic.
- **Search:** server-side via Postgres FTS (`tsvector` + GIN) with Arabic
  normalization and `pg_trgm` fuzzy fallback, exposed through RPCs so the client
  fetches ranked results in one round-trip.
- **Storage:** covers are public; book artifacts are private and served via
  short-lived signed URLs minted client-side (staff) or by an Edge Function.
- **Graceful degradation:** every Supabase call is guarded by
  `isSupabaseConfigured`, so the app builds and renders before the project is
  provisioned.
```
