/**
 * Playwright E2E Mock Helper for Supabase Auth & Profiles
 * Allows E2E tests to run reliably in all environments (offline, CI, sandboxed)
 * with instant, deterministic role simulation.
 */

export async function mockSupabaseAuth(page, roleConfig) {
  const {
    id = 'demo-user-123',
    email = 'user@kashiful-hudha.test',
    fullName = 'Demo User',
    role = 'user',
    accountType = 'student',
    assignedTutorRole = 'none',
    isApproved = true,
  } = roleConfig;

  // Intercept Supabase Auth Token endpoint
  await page.route('**/auth/v1/token**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-jwt-token-12345',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        user: {
          id,
          aud: 'authenticated',
          role: 'authenticated',
          email,
          email_confirmed_at: '2026-01-01T00:00:00Z',
          user_metadata: {
            full_name: fullName,
            account_type: accountType,
          },
        },
      }),
    });
  });

  // Intercept Supabase User endpoint
  await page.route('**/auth/v1/user**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id,
        aud: 'authenticated',
        role: 'authenticated',
        email,
        email_confirmed_at: '2026-01-01T00:00:00Z',
        user_metadata: {
          full_name: fullName,
          account_type: accountType,
        },
      }),
    });
  });

  // Intercept Profiles REST lookup
  await page.route('**/rest/v1/profiles**', async (route) => {
    const profile = {
      id,
      email,
      full_name: fullName,
      role,
      account_type: accountType,
      is_approved: isApproved,
      assigned_tutor_role: assignedTutorRole,
      extra_roles: [],
      index_number: 'KASHIF-2026-101',
      class_number: 5,
    };
    const wantsSingle = route.request().headers().accept?.includes('vnd.pgrst.object+json');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wantsSingle ? profile : [profile]),
    });
  });

  // Intercept generic admissions / stats so dashboard renders instantly
  await page.route('**/rest/v1/admissions**', async (route) => {
    if (route.request().method() === 'HEAD') {
      await route.fulfill({ status: 200, headers: { 'content-range': '0-5/5' } });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }
  });

  await page.route('**/rest/v1/news**', async (route) => {
    await route.fulfill({ status: 200, headers: { 'content-range': '0-4/4' }, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/faculty**', async (route) => {
    await route.fulfill({ status: 200, headers: { 'content-range': '0-8/8' }, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/books**', async (route) => {
    await route.fulfill({ status: 200, headers: { 'content-range': '0-120/120' }, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/student_results**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/attendance**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/student_fees**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/tutor_jobs**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/tutor_salaries**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/leave_requests**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/notifications**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/parent_children**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/valid_index_numbers**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  // Secure ERP reports are served by aggregate RPCs; keep browser coverage
  // deterministic without pretending to connect to a configured institution.
  await page.route('**/rest/v1/rpc/**', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    const reports = {
      finance_analytics: {
        as_of: '2026-01-31',
        months: [{ month: '2026-01', invoiced: 50000, collected_for_month: 40000, cash_received: 40000, expenses: 10000, petty_cash: 1000, payroll: 20000, donations: 0 }],
        aging: { not_due: 10000, d0_30: 5000, d31_60: 0, d61_90: 0, d90_plus: 0, total: 15000, students: 2 },
        by_method: { cash: 25000, bank: 15000 }, by_class: [], expenses_by_account: [], petty_cash_by_duty: [],
      },
      academic_analytics: {
        as_of: '2026-01-31', attendance: [], results: [], enrollment: [],
      },
      org_dashboard_stats: {},
      my_mfa_status: { aal: 'aal1', has_factor: false, required: false, ok: true },
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reports[name] ?? null) });
  });

  await page.route('**/auth/v1/factors**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ all: [], totp: [] }) });
  });
}

