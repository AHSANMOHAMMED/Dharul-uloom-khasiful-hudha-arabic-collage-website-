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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id,
          email,
          full_name: fullName,
          role,
          account_type: accountType,
          is_approved: isApproved,
          assigned_tutor_role: assignedTutorRole,
          index_number: 'KASHIF-2026-101',
          class_number: 5,
        },
      ]),
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

  await page.route('**/rest/v1/notifications**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/parent_children**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route('**/rest/v1/valid_index_numbers**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

