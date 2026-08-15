import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Regression cover for the WCAG 2.2 AA remediation. Without these, the focus
// trap, the aria-current wiring and the contrast fixes are all untested and a
// future refactor removes them silently.

test.describe('authenticated shell', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('mobile drawer traps Tab and restores focus on Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const menuButton = page.getByRole('button', { name: 'פתח תפריט' });
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await menuButton.click();

    const drawer = page.getByRole('dialog', { name: 'תפריט ניווט' });
    await expect(drawer).toBeVisible();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');

    // Focus starts inside the drawer, not on the page behind it.
    const focusStartsInDrawer = await drawer.evaluate((node) => node.contains(document.activeElement));
    expect(focusStartsInDrawer).toBe(true);

    // Tabbing past the last item must wrap back into the drawer rather than
    // reaching the page behind the scrim.
    const items = drawer.locator('a[href], button:not([disabled])');
    const count = await items.count();
    for (let i = 0; i < count + 2; i += 1) {
      await page.keyboard.press('Tab');
      const stillInside = await drawer.evaluate((node) => node.contains(document.activeElement));
      expect(stillInside, `focus escaped the drawer after ${i + 1} Tab presses`).toBe(true);
    }

    // Escape closes and returns focus to the control that opened it (SC 2.4.3).
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(menuButton).toBeFocused();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });

  test('background is inert while the drawer is open', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'פתח תפריט' }).click();

    await expect(page.locator('.dashboard-main-wrap')).toHaveAttribute('inert', '');
    await expect(page.locator('.dashboard-bottom-nav')).toHaveAttribute('inert', '');

    await page.keyboard.press('Escape');
    await expect(page.locator('.dashboard-main-wrap')).not.toHaveAttribute('inert', '');
  });

  test('current page is marked with aria-current, not colour alone', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const current = page.locator('.dashboard-nav-link[aria-current="page"]').first();
    await expect(current).toBeVisible();
    // SC 1.4.1: a non-colour cue must accompany the active styling.
    await expect(current).toHaveCSS('font-weight', '700');
  });

  test('dashboard has no automatically detectable a11y violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe('auth pages', () => {
  // These render only for signed-out visitors, so drop the stored session.
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const path of ['/login', '/register']) {
    test(`${path} has no automatically detectable a11y violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
