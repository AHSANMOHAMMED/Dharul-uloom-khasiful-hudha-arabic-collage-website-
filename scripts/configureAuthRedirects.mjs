#!/usr/bin/env node
/**
 * Print Supabase Auth redirect URL setup for forgot/reset password (auth flows 3 & 4).
 * Optionally patches hosted project config when SUPABASE_ACCESS_TOKEN is set.
 */
import dotenv from 'dotenv';

dotenv.config();

const projectRef = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '')
  .replace('https://', '')
  .replace('.supabase.co', '');

const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
const redirectUrls = [
  siteUrl,
  `${siteUrl}/reset-password`,
  `${siteUrl}/login`,
  'http://localhost:3000',
  'http://localhost:3000/reset-password',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3000/reset-password',
];

async function patchHostedConfig() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token || !projectRef) return false;

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      site_url: siteUrl,
      uri_allow_list: redirectUrls.join(','),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Management API error:', res.status, text);
    return false;
  }

  console.log('✅ Updated hosted Supabase Auth redirect URLs via Management API');
  return true;
}

async function main() {
  console.log('Supabase Auth — flows 3 (forgot) & 4 (reset password)\n');
  console.log('Add these in Supabase Dashboard → Authentication → URL Configuration:\n');
  console.log(`  Site URL: ${siteUrl}`);
  console.log('  Redirect URLs (one per line):');
  for (const url of [...new Set(redirectUrls)]) {
    console.log(`    ${url}`);
  }
  console.log('\nForgot password page: /forgot-password');
  console.log('Reset password page:  /reset-password');

  const patched = await patchHostedConfig();
  if (!patched && !process.env.SUPABASE_ACCESS_TOKEN) {
    console.log('\nTip: set SUPABASE_ACCESS_TOKEN (from supabase login) to auto-apply these URLs.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
