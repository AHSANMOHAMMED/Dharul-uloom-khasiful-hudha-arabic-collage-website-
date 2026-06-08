# Islamic Library Setup Guide

This guide is for a low-budget student project that stores **book files in Google Drive** and keeps **only metadata in Supabase**.

## 1) Upload books to Google Drive

1. Create a Google Drive folder for the library PDFs.
2. Upload the PDF for each book.
3. Right-click the file → **Share**.
4. Set access to **Anyone with the link**.
5. Copy the file link.

### How to get the file ID

From a typical link like:

`https://drive.google.com/file/d/FILE_ID/view?usp=sharing`

the file ID is the part between `/d/` and `/view`.

### Preview link

The reader uses the preview form:

`https://drive.google.com/file/d/FILE_ID/preview`

This is the best link to store in Supabase as `drive_preview_url`.

## 2) Prepare the import file

Start by copying the sample file:

`docs/books.sample.json`

Then rename it to something like `books.json` and edit it with your own books:

```json
[
  {
    "shamela_id": "1001",
    "title_ar": "الفقه الميسر",
    "title_en": "Easy Fiqh",
    "author": "مجموعة من العلماء",
    "categories": ["فقه", "عبادات"],
    "description": "شرح مبسط لأحكام الفقه.",
    "language": "ar",
    "year": 2018,
    "pages": 320,
    "drive_file_id": "FILE_ID_HERE",
    "drive_preview_url": "https://drive.google.com/file/d/FILE_ID_HERE/preview",
    "cover_url": ""
  }
]
```

CSV also works, but JSON is easier for students to maintain.

## 3) Create the Supabase table

Run the SQL in:

`docs/library-schema.sql`

That creates:
- `books`
- public read access
- admin-only write access
- the `search_books` function

## 4) Run the import script

Set these backend environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Then run:

```bash
node scripts/library/importBooks.mjs --input ./books.json
```

If the import stops halfway, run the same command again. The script is resumable through:

`.library-import-checkpoint.json`

Use `--reset` if you want to start over:

```bash
node scripts/library/importBooks.mjs --input ./books.json --reset
```

## 5) Add more books later

1. Add the new row to `books.json`.
2. Upload the PDF to Drive.
3. Copy the file ID and preview URL.
4. Run the import script again.

The importer uses `shamela_id` as the unique key, so existing rows are updated instead of duplicated.

## 6) Reader behavior

The website tries the Google Drive preview first.
If embedding fails, the reader shows a safe fallback with:
- open preview button
- download PDF button

That keeps the library usable even on slower devices or stricter browsers.

## 7) Maintenance tips

- Keep Arabic titles in `title_ar`.
- Use `categories` as a simple array of Arabic labels.
- Avoid storing the PDF itself in Supabase; keep only metadata there.
- If you change the schema, update `src/lib/booksApi.js` and the import file together.
