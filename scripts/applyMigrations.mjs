#!/usr/bin/env node
/**
 * Apply pending Supabase SQL migrations (0008–0010) via direct Postgres connection.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres" node scripts/applyMigrations.mjs
 *   node scripts/applyMigrations.mjs --from 0008
 *
 * Requires DATABASE_URL or DIRECT_URL in .env (loaded via dotenv).
 */
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');

const fromArg = process.argv.find((a) => a.startsWith('--from='));
const fromPrefix = fromArg ? fromArg.split('=')[1] : '0008';

const connectionString =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  (process.env.SUPABASE_DB_PASSWORD
    ? `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@db.nkuafrxzydleirtrvdbt.supabase.co:5432/postgres`
    : null);

if (!connectionString) {
  console.error('Set DATABASE_URL, DIRECT_URL, or SUPABASE_DB_PASSWORD in .env');
  process.exit(1);
}

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .filter((f) => f >= `${fromPrefix}_`);

async function main() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log(`Connected. Applying ${files.length} migration file(s)...`);

  await client.query(`
    create table if not exists public._local_migration_log (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  for (const file of files) {
    const { rows } = await client.query(
      'select 1 from public._local_migration_log where filename = $1',
      [file]
    );
    if (rows.length) {
      console.log(`⏭  skip ${file} (already applied)`);
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    console.log(`▶  applying ${file}...`);
    try {
      await client.query(sql);
      await client.query('insert into public._local_migration_log (filename) values ($1)', [file]);
      console.log(`✅ ${file}`);
    } catch (err) {
      console.error(`❌ ${file}:`, err.message);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
