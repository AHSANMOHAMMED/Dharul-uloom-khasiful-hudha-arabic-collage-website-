import { test, expect } from '@playwright/test';
import { mockSupabaseAuth } from './helpers/authMock';

test.describe('Student, Tutor, Parent Portals', () => {
  test('Student login navigates to Student Portal with no public navbar', async ({ page }) => {
    await mockSupabaseAuth(page, {
      id: 'student-user-1',
      email: 'student.demo@kashiful-hudha.test',
      fullName: 'Ahmed Bilal',
      role: 'user',
      accountType: 'student',
      isApproved: true,
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    await page.locator('input[type="email"]').fill('student.demo@kashiful-hudha.test');
    await page.locator('input[type="password"]').fill('DemoStudent@2026');
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // Public marketing links must not be visible
    const header = page.locator('header');
    await expect(header.getByRole('link', { name: /^About$|^من نحن$/i })).not.toBeVisible();

    // Student Desk title
    await expect(page.getByText(/Student Portal|بوابة الطالب/i).first()).toBeVisible();
  });

  test('Tutor login navigates to Faculty Portal and allows role switcher if assigned', async ({ page }) => {
    await mockSupabaseAuth(page, {
      id: 'tutor-user-1',
      email: 'tutor.demo@kashiful-hudha.test',
      fullName: 'Sheikh Abdullah',
      role: 'user',
      accountType: 'tutor',
      isApproved: true,
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    await page.locator('input[type="email"]').fill('tutor.demo@kashiful-hudha.test');
    await page.locator('input[type="password"]').fill('DemoTutor@2026');
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const header = page.locator('header');
    await expect(header.getByRole('link', { name: /^About$|^من نحن$/i })).not.toBeVisible();

    // Faculty portal header
    await expect(page.getByText(/Faculty|المعلمين|الأساتذة/i).first()).toBeVisible();
  });

  test('Parent login navigates to Parent Portal', async ({ page }) => {
    await mockSupabaseAuth(page, {
      id: 'parent-user-1',
      email: 'parent.demo@kashiful-hudha.test',
      fullName: 'Mohammed Farooq',
      role: 'user',
      accountType: 'parent',
      isApproved: true,
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    await page.locator('input[type="email"]').fill('parent.demo@kashiful-hudha.test');
    await page.locator('input[type="password"]').fill('DemoParent@2026');
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const header = page.locator('header');
    await expect(header.getByRole('link', { name: /^About$|^من نحن$/i })).not.toBeVisible();

    // Parent portal title
    await expect(page.getByText(/Parent Portal|أولياء الأمور/i).first()).toBeVisible();
  });
});
