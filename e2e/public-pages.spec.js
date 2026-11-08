import { test, expect } from '@playwright/test';

test.describe('Public Pages & Navigation', () => {
  test('Home page renders brand emblem, header, and public navigation', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Page title or emblem
    await expect(page).toHaveTitle(/Dharul Uloom|كاشف الهدى/i);
    await expect(page.locator('header')).toBeVisible();
    
    // Public nav links must be present
    const nav = page.locator('header nav');
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: /Home|الرئيسية/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /About|من نحن/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Admissions|القبول/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Contact|اتصل بنا/i })).toBeVisible();

    // Footer must be visible
    await expect(page.locator('footer')).toBeVisible();
  });

  test('Public pages load successfully without crash', async ({ page }) => {
    const routes = [
      { path: '/about', heading: /About|من نحن|عن الكلية/i },
      { path: '/courses', heading: /Courses|المساقات|الدورات/i },
      { path: '/curriculum', heading: /Curriculum|المنهج/i },
      { path: '/faculty', heading: /Faculty|هيئة التدريس|الأساتذة/i },
      { path: '/library', heading: /Library|المكتبة/i },
      { path: '/gallery', heading: /Gallery|معرض|الصور/i },
      { path: '/news', heading: /News|الأخبار/i },
      { path: '/admissions', heading: /Admissions|القبول/i },
      { path: '/contact', heading: /Contact|اتصل بنا/i },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.locator('body')).toBeVisible();
      // Ensure no 500 error or blank page
      const content = await page.textContent('body');
      expect(content.length).toBeGreaterThan(100);
    }
  });

  test('Language switcher toggles direction between RTL and LTR', async ({ page }) => {
    await page.goto('/');

    const langSelect = page.locator('select[aria-label*="Language"]').first();
    await expect(langSelect).toBeVisible();

    // Switch to English
    await langSelect.selectOption('en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    // Switch to Arabic
    await langSelect.selectOption('ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('404 Page renders with modern manuscript design and return button', async ({ page }) => {
    await page.goto('/some-non-existent-folio-route');
    await expect(page.getByText(/404/)).toBeVisible();
    const returnLink = page.getByRole('link', { name: /Back to Home|العودة إلى الرئيسية/i });
    await expect(returnLink).toBeVisible();
  });
});

