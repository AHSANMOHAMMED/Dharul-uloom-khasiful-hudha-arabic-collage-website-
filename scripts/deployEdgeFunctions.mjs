#!/usr/bin/env node
/**
 * Deploy Supabase Edge Functions + sync secrets from .env
 *
 * Requires a Supabase personal access token:
 *   1. https://supabase.com/dashboard/account/tokens → Generate token
 *   2. export SUPABASE_ACCESS_TOKEN=sbp_...
 *   OR: supabase login
 *
 * Usage:
 *   npm run deploy:functions
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config();

const PROJECT_REF = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '')
  .replace('https://', '')
  .replace('.supabase.co', '');

const FUNCTIONS = ['create-payment', 'payhere-notify', 'generate-monthly-fees'];

const SECRET_KEYS = [
  'PAYHERE_MERCHANT_ID',
  'PAYHERE_MERCHANT_SECRET',
  'PAYHERE_SANDBOX',
  'SITE_URL',
];

function getAccessToken() {
  return process.env.SUPABASE_ACCESS_TOKEN || '';
}

function ensureToken() {
  const token = getAccessToken();
  if (token) return token;

  console.error(`
Cannot deploy Edge Functions without Supabase CLI authentication.

Do ONE of the following, then re-run: npm run deploy:functions

  Option A — CLI login (opens browser):
    supabase login

  Option B — Personal access token:
    1. Open https://supabase.com/dashboard/account/tokens
    2. Create a token with edge_functions + secrets permissions
    3. export SUPABASE_ACCESS_TOKEN=sbp_your_token_here
    4. npm run deploy:functions

Project ref: ${PROJECT_REF || '(missing VITE_SUPABASE_URL)'}
`);
  process.exit(1);
}

async function setSecrets(token) {
  const secrets = SECRET_KEYS
    .filter((key) => process.env[key])
    .map((key) => ({ name: key, value: String(process.env[key]) }));

  if (secrets.length === 0) {
    console.warn('No PayHere/SITE_URL secrets found in .env — skipping secret sync.');
    return;
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/secrets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(secrets),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to set Edge Function secrets (${res.status}): ${text}`);
  }

  console.log(`✅ Synced ${secrets.length} Edge Function secret(s): ${secrets.map((s) => s.name).join(', ')}`);
}

function collectFunctionFiles(functionName) {
  const root = join(process.cwd(), 'supabase', 'functions', functionName);
  const files = [];

  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else {
        files.push({
          path: relative(root, full),
          content: readFileSync(full),
        });
      }
    }
  }

  walk(root);
  return { root, files };
}

async function deployFunction(token, functionName) {
  const { files } = collectFunctionFiles(functionName);
  const indexFile = files.find((f) => f.path === 'index.ts');
  if (!indexFile) throw new Error(`${functionName}: missing index.ts`);

  const configFile = files.find((f) => f.path === 'config.toml');
  const verifyJwt = configFile
    ? !configFile.content.toString().includes('verify_jwt = false')
    : true;

  const form = new FormData();
  form.append(
    'metadata',
    JSON.stringify({
      name: functionName,
      entrypoint_path: 'index.ts',
      verify_jwt: verifyJwt,
    })
  );

  for (const file of files) {
    if (file.path.endsWith('.toml')) continue;
    form.append('file', new Blob([file.content]), file.path);
  }

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/deploy?slug=${functionName}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Deploy ${functionName} failed (${res.status}): ${text}`);
  }

  console.log(`✅ Deployed ${functionName} (verify_jwt=${verifyJwt})`);
}

async function verifyFunctions() {
  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;

  for (const slug of FUNCTIONS) {
    const res = await fetch(`${base}/functions/v1/${slug}`, {
      method: slug === 'payhere-notify' ? 'POST' : 'OPTIONS',
      headers: { apikey: anon },
    });
    const ok = res.status !== 404;
    console.log(`${ok ? '✅' : '❌'} ${slug} → HTTP ${res.status}`);
  }
}

async function deployViaCli() {
  const args = [
    'functions',
    'deploy',
    ...FUNCTIONS,
    '--project-ref',
    PROJECT_REF,
    '--use-api',
    '--yes',
  ];

  const result = spawnSync('supabase', args, {
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: getAccessToken() },
  });

  if (result.status !== 0) {
    throw new Error('supabase functions deploy failed');
  }
}

async function setSecretsViaCli() {
  const pairs = SECRET_KEYS.filter((key) => process.env[key]).map((key) => `${key}=${process.env[key]}`);
  if (pairs.length === 0) return;

  const result = spawnSync(
    'supabase',
    ['secrets', 'set', ...pairs, '--project-ref', PROJECT_REF],
    {
      stdio: 'inherit',
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: getAccessToken() },
    }
  );

  if (result.status !== 0) {
    throw new Error('supabase secrets set failed');
  }
}

async function main() {
  if (!PROJECT_REF) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_URL in .env');
    process.exit(1);
  }

  const token = ensureToken();
  console.log(`Deploying Edge Functions to project ${PROJECT_REF}...\n`);

  try {
    await setSecretsViaCli();
  } catch {
    console.log('CLI secrets failed — trying Management API...');
    await setSecrets(token);
  }

  try {
    await deployViaCli();
  } catch {
    console.log('CLI deploy failed — trying Management API...');
    for (const fn of FUNCTIONS) {
      await deployFunction(token, fn);
    }
  }

  console.log('\nVerifying deployed endpoints...');
  await verifyFunctions();

  console.log(`
Done. PayHere notify URL (set in PayHere dashboard):
  ${process.env.VITE_SUPABASE_URL}/functions/v1/payhere-notify
`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
