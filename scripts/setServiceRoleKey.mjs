#!/usr/bin/env node
/**
 * Verify and save Supabase service role key to root .env and backend/.env
 *
 * Usage:
 *   node scripts/setServiceRoleKey.mjs "eyJhbGciOi..."
 */
import { readFileSync, writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const key = process.argv[2] || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!key || key === 'your-service-role-key' || key.startsWith('http')) {
  console.error(`
❌ Invalid service role key.

Get it from:
  Supabase Dashboard → Project Settings → API → service_role (secret)

It is a long JWT starting with "eyJ..." — NOT the project URL.

Usage:
  node scripts/setServiceRoleKey.mjs "eyJhbGciOiJIUzI1NiIs..."
`);
  process.exit(1);
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const admin = createClient(url, key, { auth: { persistSession: false } });
const { count, error } = await admin.from('profiles').select('*', { count: 'exact', head: true });

if (error) {
  console.error('❌ Key verification failed:', error.message);
  process.exit(1);
}

function upsertEnv(path, keyValue) {
  let content = readFileSync(path, 'utf8');
  if (/^SUPABASE_SERVICE_ROLE_KEY=.*/m.test(content)) {
    content = content.replace(/^SUPABASE_SERVICE_ROLE_KEY=.*/m, `SUPABASE_SERVICE_ROLE_KEY=${keyValue}`);
  } else {
    content += `\nSUPABASE_SERVICE_ROLE_KEY=${keyValue}\n`;
  }
  writeFileSync(path, content);
}

upsertEnv('.env', key);
try {
  upsertEnv('backend/.env', key);
} catch {
  /* optional */
}

console.log(`✅ Service role key verified (profiles count: ${count ?? 'ok'}).`);
console.log('   Updated: .env and backend/.env');
