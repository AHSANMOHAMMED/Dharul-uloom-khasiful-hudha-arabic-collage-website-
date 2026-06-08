#!/usr/bin/env node
/**
 * Create the first admin user and promote their profile.
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='YourSecurePass1' node scripts/setupAdmin.mjs
 *
 * Loads .env for Supabase URL, anon key, and DIRECT_URL.
 */
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const email = process.env.ADMIN_EMAIL || process.argv[2];
const password = process.env.ADMIN_PASSWORD || process.argv[3];
const fullName = process.env.ADMIN_FULL_NAME || 'Site Administrator';

if (!email || !password) {
  console.error('Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/setupAdmin.mjs');
  process.exit(1);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const connectionString = process.env.DIRECT_URL;

if (!supabaseUrl || !anonKey || !connectionString) {
  console.error('Missing VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, or DIRECT_URL in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function promoteProfile(userId) {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(
      `update auth.users
       set email_confirmed_at = coalesce(email_confirmed_at, now())
       where id = $1`,
      [userId]
    );
    await client.query(
      `insert into public.profiles (id, email, full_name, role, account_type, is_approved)
       values ($1, $2, $3, 'admin', 'guest', true)
       on conflict (id) do update set
         role = 'admin',
         is_approved = true,
         full_name = excluded.full_name,
         email = excluded.email`,
      [userId, email, fullName]
    );
  } finally {
    await client.end();
  }
}

async function main() {
  console.log(`Creating admin: ${email}`);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, account_type: 'guest' },
    },
  });

  if (error) {
    if (error.message.includes('already registered') || error.message.includes('already been registered')) {
      console.log('User already exists — promoting existing account to admin...');
      const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
      await client.connect();
      const { rows } = await client.query('select id from auth.users where email = $1', [email]);
      await client.end();
      if (!rows.length) {
        console.error('User exists in auth but not found in DB query:', error.message);
        process.exit(1);
      }
      await promoteProfile(rows[0].id);
      console.log('✅ Promoted existing user to admin.');
      return;
    }
    console.error('Sign-up failed:', error.message);
    process.exit(1);
  }

  const userId = data.user?.id;
  if (!userId) {
    console.error('Sign-up succeeded but no user id returned (check email confirmation settings).');
    process.exit(1);
  }

  await promoteProfile(userId);
  console.log('✅ Admin account ready.');
  console.log(`   Email:    ${email}`);
  console.log('   Login at: http://localhost:3000/login');
  console.log('   Admin at: http://localhost:3000/admin');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
