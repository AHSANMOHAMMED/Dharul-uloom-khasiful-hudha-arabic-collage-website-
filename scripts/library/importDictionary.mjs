#!/usr/bin/env node
/**
 * Import a licensed Arabic–Tamil lexicon CSV into public.dictionary_entries.
 *
 *   node scripts/library/importDictionary.mjs file.csv [--batch-size 500] [--verified] [--ref "Lexicon name"]
 *
 * CSV header: arabic,tamil,english,root,part_of_speech (example_ar, example_ta optional).
 * Rows are upserted with source='import' on (arabic_normalized, tamil) — existing
 * entries (curated / verified) are kept untouched (ON CONFLICT DO NOTHING); the
 * arabic_normalized column is computed by the tg_dictionary_prepare trigger.
 *
 * Required env (server-side only — never ship the service role key to a browser):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (read from .env via dotenv)
 *
 * Only import word lists you are licensed to use; copyrighted dictionaries
 * (e.g. al-Munjid) must not be copied without the publisher's permission.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { parseDictionaryCsv } from '../../src/lib/dictionaryCsv.js';

function parseArgs(argv) {
  const args = { batchSize: 500, verified: false, ref: null, file: null };
  for (let i = 0; i < argv.length; i += 1) {
    const v = argv[i];
    if (v === '--batch-size') args.batchSize = Math.max(1, Number(argv[++i]) || 500);
    else if (v === '--verified') args.verified = true;
    else if (v === '--ref') args.ref = argv[++i];
    else if (v === '--help' || v === '-h') args.help = true;
    else if (!args.file) args.file = v;
  }
  return args;
}

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.file) {
    console.log('Usage: node scripts/library/importDictionary.mjs file.csv [--batch-size 500] [--verified] [--ref "source"]');
    process.exit(args.help ? 0 : 1);
  }
  const file = path.resolve(args.file);
  const rows = parseDictionaryCsv(fs.readFileSync(file, 'utf8'));
  if (!rows.length) throw new Error('No valid rows (need arabic and tamil).');

  const supabase = client();
  const ref = (args.ref || path.basename(file)).slice(0, 120);
  let done = 0;
  let written = 0;
  console.log(`Importing ${rows.length} entries from ${path.basename(file)} in batches of ${args.batchSize}…`);
  for (let i = 0; i < rows.length; i += args.batchSize) {
    const batch = rows.slice(i, i + args.batchSize).map((r) => ({
      ...r,
      // placeholder for the NOT NULL column; the trigger overwrites it from `arabic`
      arabic_normalized: '',
      source: 'import',
      source_ref: ref,
      verified: args.verified,
    }));
    // ON CONFLICT DO NOTHING: existing (curated / verified) entries are never overwritten
    const { data, error } = await supabase
      .from('dictionary_entries')
      .upsert(batch, { onConflict: 'arabic_normalized,tamil', ignoreDuplicates: true })
      .select('id');
    if (error) throw new Error(`Batch at row ${i + 1}: ${error.message}`);
    written += data?.length || 0;
    done += batch.length;
    process.stdout.write(`\r  ${done}/${rows.length} processed, ${written} new`);
  }
  process.stdout.write('\n');
  console.log('Done.');
}

main().catch((error) => {
  console.error(`\n[importDictionary] ${error.message}`);
  process.exit(1);
});
