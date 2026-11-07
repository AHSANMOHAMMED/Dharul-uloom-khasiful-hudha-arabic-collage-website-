# DigitalOcean Shamela import worker

Keep **Supabase** as the database. Use a DigitalOcean Droplet only to run the long import.

## Setup

1. Create an Ubuntu droplet (2–4 GB RAM recommended for full catalog).
2. Install Node 20+, clone this repo, copy env:

```bash
export SUPABASE_URL=https://YOUR_REF.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...
export SHAMELA_API_KEY=...
export SHAMELA_BOOKS_ENDPOINT=...
export SHAMELA_MASTER_ENDPOINT=...
```

3. Smoke test then full run:

```bash
npm install
npm run import:shamela -- --dry-run --limit 5
npm run import:shamela -- --limit 50
npm run import:shamela -- --concurrency 4
```

4. Optionally mark `import_jobs` rows running/completed from Admin → Shamela Import.

The importer is checkpoint/resume safe — safe to stop and restart.
