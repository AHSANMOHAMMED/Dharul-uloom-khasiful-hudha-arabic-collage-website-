#!/usr/bin/env node
/**
 * Create approved demo portal accounts (parent, student, tutor) for testing auth.
 *
 * Usage:
 *   node scripts/setupPortalUsers.mjs
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + DIRECT_URL in .env
 */
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionString = process.env.DIRECT_URL;

if (!supabaseUrl || !serviceKey || !connectionString) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DIRECT_URL in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_USERS = [
  {
    email: 'student.demo@kashiful-hudha.test',
    password: 'DemoStudent@2026',
    fullName: 'Ahmad Abdullah (Demo)',
    accountType: 'student',
    indexNumber: 'KASHIF-2026-001',
    classNumber: 5,
    phone: '0700000001',
  },
  {
    email: 'parent.demo@kashiful-hudha.test',
    password: 'DemoParent@2026',
    fullName: 'Parent Demo Account',
    accountType: 'parent',
    phone: '0700000002',
  },
  {
    email: 'tutor.demo@kashiful-hudha.test',
    password: 'DemoTutor@2026',
    fullName: 'Ustadh Demo Tutor',
    accountType: 'tutor',
    phone: '0700000003',
  },
];

async function upsertAuthUser(user, client) {
  const { rows } = await client.query('select id from auth.users where email = $1', [user.email]);
  const existingId = rows[0]?.id;

  if (existingId) {
    const { error } = await supabase.auth.admin.updateUserById(existingId, {
      password: user.password,
      user_metadata: {
        full_name: user.fullName,
        account_type: user.accountType,
        index_number: user.indexNumber || null,
        phone: user.phone || null,
      },
    });
    if (error) throw new Error(`${user.email}: ${error.message}`);
    return existingId;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      full_name: user.fullName,
      account_type: user.accountType,
      index_number: user.indexNumber || null,
      phone: user.phone || null,
    },
  });

  if (error) throw new Error(`${user.email}: ${error.message}`);
  return data.user.id;
}

async function syncProfile(client, userId, user) {
  await client.query(
    `insert into public.profiles (
       id, email, full_name, role, account_type, is_approved,
       index_number, class_number, phone, assigned_tutor_role
     ) values ($1, $2, $3, 'user', $4, true, $5, $6, $7, 'none')
     on conflict (id) do update set
       email = excluded.email,
       full_name = excluded.full_name,
       account_type = excluded.account_type,
       is_approved = true,
       index_number = coalesce(excluded.index_number, profiles.index_number),
       class_number = coalesce(excluded.class_number, profiles.class_number),
       phone = coalesce(excluded.phone, profiles.phone)`,
    [
      userId,
      user.email,
      user.fullName,
      user.accountType,
      user.indexNumber || null,
      user.classNumber || null,
      user.phone || null,
    ]
  );

  if (user.indexNumber) {
    await client.query(
      `update public.valid_index_numbers
       set is_registered = true
       where index_number = $1`,
      [user.indexNumber]
    );
  }
}

async function linkParentToStudent(client, parentId, studentId) {
  await client.query(
    `insert into public.parent_children (parent_id, child_id)
     values ($1, $2)
     on conflict (parent_id, child_id) do nothing`,
    [parentId, studentId]
  );
}

async function seedStudentFee(client, studentId) {
  const month = new Date().toISOString().slice(0, 7);
  await client.query(
    `insert into public.student_fees (student_id, month, total_due, paid_amount, status)
     values ($1, $2, 5000, 0, 'unpaid')
     on conflict (student_id, month) do nothing`,
    [studentId, month]
  );
}

async function main() {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const ids = {};
  try {
    for (const user of DEMO_USERS) {
      const userId = await upsertAuthUser(user, client);
      ids[user.accountType] = userId;
      await syncProfile(client, userId, user);
      console.log(`✅ ${user.accountType.padEnd(8)} ${user.email}`);
    }

    if (ids.parent && ids.student) {
      await linkParentToStudent(client, ids.parent, ids.student);
      console.log('✅ Linked parent → student');
    }

    if (ids.student) {
      await seedStudentFee(client, ids.student);
      console.log('✅ Seeded pending student fee (LKR 5000)');
    }
  } finally {
    await client.end();
  }

  console.log('\nDemo login credentials (http://localhost:3000/login):');
  for (const user of DEMO_USERS) {
    console.log(`  ${user.accountType}: ${user.email} / ${user.password}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
