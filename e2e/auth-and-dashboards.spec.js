import { test, expect } from '@playwright/test';
import { mockSupabaseAuth } from './helpers/authMock';

test.describe('Authentication & Role-Based Dashboard Isolation', () => {
  test('Login page renders with branding and credentials form', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Super Admin Login hides public navigation and displays Super Admin Console', async ({ page }) => {
    await mockSupabaseAuth(page, {
      id: 'superadmin-user',
      email: 'superadmin.demo@kashiful-hudha.test',
      fullName: 'Super Administrator',
      role: 'admin',
      accountType: 'staff',
      isApproved: true,
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    // Fill credentials for Super Admin demo
    await page.locator('input[type="email"]').fill('superadmin.demo@kashiful-hudha.test');
    await page.locator('input[type="password"]').fill('DemoSuperAdmin@2026');
    await page.locator('button[type="submit"]').click();

    // Must redirect to /admin
    await page.waitForURL('**/admin', { timeout: 15000 });

    // 1. Public marketing Navbar links (Home, About, Courses) must NOT exist in the header
    const header = page.locator('header');
    await expect(header).toBeVisible();
    await expect(header.getByRole('link', { name: /^Home$|^الرئيسية$/i })).not.toBeVisible();
    await expect(header.getByRole('link', { name: /^About$|^من نحن$/i })).not.toBeVisible();

    // 2. DashboardTopBar must show "Super Admin" role badge
    await expect(page.getByText(/Super Admin|المدير العام/i).first()).toBeVisible();

    // 3. Admin KPI stats strip must be visible
    await expect(page.getByText(/Total Students|إجمالي الطلاب/i)).toBeVisible();
    await expect(page.getByText(/Total Tutors|إجمالي المعلمين/i)).toBeVisible();
    await expect(page.getByText(/Pending Approvals|بانتظار الموافقة/i)).toBeVisible();
    await expect(page.getByText(/Library Books|الكتب المتاحة/i)).toBeVisible();

    // 4. Background watermark pattern must exist
    const watermark = page.locator('#admin-khatam');
    await expect(watermark).toBeAttached();

    // 5. Test tab switching: CRM Pipeline, Staff HRM, Signups
    await page.getByRole('button', { name: /CRM Pipeline|مسار القبول/i }).click();
    await page.getByRole('button', { name: /Staff HRM|الموارد البشرية/i }).click();
    await page.getByRole('button', { name: /Signups|الموافقات/i }).click();

    // 6. Test Logout
    const logoutBtn = header.getByRole('button', { name: /logout|خروج/i });
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();
  });

  test('Librarian Login directs to Maktabah Admin and hides public Navbar', async ({ page }) => {
    await mockSupabaseAuth(page, {
      id: 'librarian-user',
      email: 'librarian.demo@kashiful-hudha.test',
      fullName: 'Maktabah Librarian',
      role: 'librarian',
      accountType: 'staff',
      isApproved: true,
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    
    await page.locator('input[type="email"]').fill('librarian.demo@kashiful-hudha.test');
    await page.locator('input[type="password"]').fill('DemoLibrarian@2026');
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/library-admin', { timeout: 15000 });

    // Public marketing links must not be visible
    const header = page.locator('header');
    await expect(header.getByRole('link', { name: /^About$|^من نحن$/i })).not.toBeVisible();

    // Maktabah watermark must exist
    const watermark = page.locator('#librarian-khatam');
    await expect(watermark).toBeAttached();
  });
});
