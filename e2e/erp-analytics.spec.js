import { test, expect } from '@playwright/test';
import { mockSupabaseAuth } from './helpers/authMock';

async function signInAdmin(page) {
  await mockSupabaseAuth(page, {
    id: 'analytics-admin',
    email: 'analytics.admin@kashiful-hudha.test',
    fullName: 'Analytics Admin',
    role: 'admin',
    accountType: 'staff',
    isApproved: true,
  });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill('analytics.admin@kashiful-hudha.test');
  await page.locator('input[type="password"]').fill('DemoAnalyticsAdmin@2026');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/admin', { timeout: 15000 });
}

test.describe('ERP and analytics role-aware interface', () => {
  test('admin analytics use aggregate finance and academic reports', async ({ page }) => {
    const rpcCalls = [];
    page.on('request', (request) => {
      if (request.url().includes('/rest/v1/rpc/')) rpcCalls.push(request.url());
    });
    await signInAdmin(page);
    await page.getByRole('button', { name: /Analytics|التحليلات/i }).click();

    await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /6 months|6 أشهر/i })).toBeVisible();
    await expect(page.getByText(/LKR 50,000/i)).toBeVisible();
    await expect(page.getByText('Outstanding now', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Academic/i }).click();
    await expect(page.getByText(/Attendance rate/i)).toBeVisible();

    expect(rpcCalls.some((url) => url.includes('finance_analytics'))).toBeTruthy();
    expect(rpcCalls.some((url) => url.includes('academic_analytics'))).toBeTruthy();
    const overflow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      offenders: [...document.querySelectorAll('body *')]
        .map((node) => ({ tag: node.tagName, className: String(node.className || '').slice(0, 100), right: Math.round(node.getBoundingClientRect().right) }))
        .filter((node) => node.right > window.innerWidth + 1)
        .slice(0, 8),
    }));
    expect(overflow.width, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewport);
  });

  test('finance role sees finance analytics but no academic analytics tab', async ({ page }) => {
    await mockSupabaseAuth(page, {
      id: 'analytics-treasurer',
      email: 'treasurer@kashiful-hudha.test',
      fullName: 'College Treasurer',
      role: 'user',
      accountType: 'staff',
      assignedTutorRole: 'treasurer',
      isApproved: true,
    });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill('treasurer@kashiful-hudha.test');
    await page.locator('input[type="password"]').fill('DemoTreasurer@2026');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.goto('/erp?module=analytics');

    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
    await expect(page.getByRole('button', { name: /6 months|6 أشهر/i })).toBeVisible();
    await expect(page.getByText(/LKR 50,000/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finance', exact: true })).toHaveCount(0);
  });

  test('student cannot open staff ERP modules', async ({ page }) => {
    await mockSupabaseAuth(page, {
      id: 'analytics-student',
      email: 'student@kashiful-hudha.test',
      fullName: 'Student User',
      role: 'user',
      accountType: 'student',
      isApproved: true,
    });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill('student@kashiful-hudha.test');
    await page.locator('input[type="password"]').fill('DemoStudent@2026');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.goto('/erp');
    await expect(page.getByText(/available to approved staff accounts/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Finance|Accounting|Analytics/i })).toHaveCount(0);
  });
});
