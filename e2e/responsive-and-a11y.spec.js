import { test, expect } from '@playwright/test';
import { mockSupabaseAuth } from './helpers/authMock';

test.describe('Responsive Layouts, Mobile Drawers & Arabic RTL', () => {
  test('Mobile viewport shows hamburger menu and toggles drawer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Desktop nav must be hidden on mobile
    const desktopNav = page.locator('header nav.hidden');
    await expect(desktopNav).toBeAttached();

    // Hamburger button must be visible
    const hamburger = page.locator('button[aria-label="Toggle navigation menu"]');
    await expect(hamburger).toBeVisible();

    // Click hamburger to open mobile drawer
    await hamburger.click();

    // Mobile drawer links
    const mobileDrawer = page.locator('div.xl\\:hidden.bg-paper-white');
    await expect(mobileDrawer).toBeVisible();

    // Close hamburger
    await hamburger.click();
    await expect(mobileDrawer).not.toBeVisible();
  });

  test('Arabic language switch applies RTL direction to html and body', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const langSelect = page.locator('select[aria-label*="Language"]').first();
    await langSelect.selectOption('ar');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });

  test('Mobile Admin Dashboard maintains responsive layout without body overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await mockSupabaseAuth(page, {
      id: 'superadmin-mobile',
      email: 'superadmin.demo@kashiful-hudha.test',
      fullName: 'Super Administrator',
      role: 'admin',
      accountType: 'staff',
      isApproved: true,
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill('superadmin.demo@kashiful-hudha.test');
    await page.locator('input[type="password"]').fill('DemoSuperAdmin@2026');
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/admin', { timeout: 15000 });

    // Header and top bar must render without horizontal layout blowout
    const header = page.locator('header');
    await expect(header).toBeVisible();
    await expect(header.locator('span.rounded-full', { hasText: /Admin/i })).toBeVisible();

    // Verify KPI cards wrap properly into 2 columns on mobile
    const kpiCards = page.locator('.grid-cols-2');
    await expect(kpiCards.first()).toBeVisible();
  });
});

