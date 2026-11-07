#!/usr/bin/env node
/**
 * API latency / load test against PostgREST (the same API server Supabase runs).
 *
 *   API_URL=http://localhost:3005 JWT_SECRET=... node scripts/perf/loadTest.mjs [--concurrency 50] [--requests 2000]
 *
 * Signs real user JWTs (parent, student, tutor, accountant) for the volume
 * fixture in scripts/perf/seed.sql and hits the busiest portal endpoints
 * concurrently. Fails (exit 1) when any request exceeds the 10 s budget or the
 * p95 exceeds P95_BUDGET_MS (default 2000).
 */
import crypto from 'node:crypto';

const API = process.env.API_URL || 'http://localhost:3005';
const SECRET = process.env.JWT_SECRET || 'perf-test-secret-perf-test-secret-123456';
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? Number(process.argv[i + 1]) : d;
};
const CONCURRENCY = arg('concurrency', 50);
const REQUESTS = arg('requests', 2000);
const P95_BUDGET = Number(process.env.P95_BUDGET_MS || 2000);
const HARD_LIMIT = 10_000;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(sub, role = 'authenticated') {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ sub, role, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 });
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
const id = (prefix, n) => `${prefix}-0000-0000-0000-${String(n).padStart(12, '0')}`;
const pick = (n) => 1 + Math.floor(Math.random() * n);

const scenarios = [
  { name: 'parent: my children', weight: 10, make: () => {
    const p = pick(1500);
    return { token: jwt(id('20000000', p)), path: `/parent_children?select=child_id,profiles!parent_children_child_id_fkey(full_name,index_number,class_number)&parent_id=eq.${id('20000000', p)}` };
  } },
  { name: 'parent: notifications', weight: 10, make: () => {
    const p = pick(1500);
    return { token: jwt(id('20000000', p)), path: `/notifications?select=id,title,message,is_read,created_at&user_id=eq.${id('20000000', p)}&order=created_at.desc&limit=30` };
  } },
  { name: 'parent: child fees', weight: 8, make: () => {
    const s = pick(1500);
    return { token: jwt(id('20000000', s)), path: `/student_fees?select=*&student_id=eq.${id('10000000', s)}&order=month.desc` };
  } },
  { name: 'student: fee statement (rpc)', weight: 8, make: () => {
    const s = pick(2000);
    return { token: jwt(id('10000000', s)), path: '/rpc/student_fee_statement', body: { p_student: id('10000000', s) } };
  } },
  { name: 'student: attendance summary (rpc)', weight: 6, make: () => {
    const s = pick(2000);
    return { token: jwt(id('10000000', s)), path: '/rpc/attendance_summary', body: { p_student: id('10000000', s) } };
  } },
  { name: 'student: arrears (rpc)', weight: 6, make: () => {
    const s = pick(2000);
    return { token: jwt(id('10000000', s)), path: '/rpc/student_arrears', body: { p_student: id('10000000', s) } };
  } },
  { name: 'tutor: class attendance sheet (rpc)', weight: 5, make: () => ({
    token: jwt(id('30000000', 3 + pick(50))), path: '/rpc/class_attendance_sheet', body: { p_class: pick(7) } }) },
  { name: 'tutor: student directory', weight: 4, make: () => ({
    token: jwt(id('30000000', 3 + pick(50))), path: `/profiles?select=id,full_name,index_number,class_number&account_type=eq.student&class_number=eq.${pick(7)}&order=full_name` }) },
  { name: 'accountant: outstanding (rpc)', weight: 2, make: () => ({
    token: jwt(id('30000000', 1)), path: '/rpc/fee_outstanding', body: {} }) },
  { name: 'accountant: dashboard KPIs (rpc)', weight: 2, make: () => ({
    token: jwt(id('30000000', 1)), path: '/rpc/org_dashboard_stats', body: {} }) },
  { name: 'accountant: trial balance (rpc)', weight: 1, make: () => ({
    token: jwt(id('30000000', 1)), path: '/rpc/trial_balance', body: {} }) },
  { name: 'accountant: receive payment (write)', weight: 3, make: () => ({
    token: jwt(id('30000000', 2)), path: '/rpc/receive_student_payment',
    body: { p_student: id('10000000', pick(2000)), p_amount: 100, p_method: 'cash', p_notes: 'load test' } }) },
  { name: 'reader: Arabic word lookup (rpc)', weight: 5, make: () => ({
    token: jwt(id('10000000', pick(2000))), path: '/rpc/lookup_arabic_word',
    body: { p_word: ['والكتاب', 'بالمدرسة', 'الصلاة', 'فالعلم', 'رحمة', 'وقال'][pick(6) - 1] } }) },
];
const bag = scenarios.flatMap((s) => Array(s.weight).fill(s));

async function call(s) {
  const { token, path, body } = s.make();
  const t0 = performance.now();
  let status = 0;
  try {
    const res = await fetch(API + path, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(HARD_LIMIT + 5000),
    });
    status = res.status;
    await res.arrayBuffer();
  } catch {
    status = -1;
  }
  return { name: s.name, ms: performance.now() - t0, status };
}

const results = [];
let next = 0;
const t0 = performance.now();
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < REQUESTS) {
    next += 1;
    results.push(await call(bag[Math.floor(Math.random() * bag.length)]));
  }
}));
const wall = (performance.now() - t0) / 1000;

const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))];
const rows = Object.entries(Object.groupBy(results, (r) => r.name)).map(([name, rs]) => {
  const ms = rs.map((r) => r.ms).sort((a, b) => a - b);
  const errors = rs.filter((r) => r.status < 200 || r.status >= 300);
  return { endpoint: name, n: rs.length, p50: Math.round(pct(ms, 50)), p95: Math.round(pct(ms, 95)),
           max: Math.round(ms[ms.length - 1]), errors: errors.length, codes: [...new Set(errors.map((e) => e.status))].join(' ') };
});
console.table(rows);
const all = results.map((r) => r.ms).sort((a, b) => a - b);
const summary = { requests: results.length, concurrency: CONCURRENCY, seconds: +wall.toFixed(1),
  rps: Math.round(results.length / wall), p50: Math.round(pct(all, 50)), p95: Math.round(pct(all, 95)),
  p99: Math.round(pct(all, 99)), max: Math.round(all[all.length - 1]),
  errors: results.filter((r) => r.status < 200 || r.status >= 300).length };
console.log(summary);
const failed = summary.max > HARD_LIMIT || summary.p95 > P95_BUDGET || summary.errors > 0;
console.log(failed ? 'LOAD TEST FAILED' : `LOAD TEST PASSED (max ${summary.max} ms < ${HARD_LIMIT} ms, p95 ${summary.p95} ms < ${P95_BUDGET} ms)`);
process.exit(failed ? 1 : 0);
