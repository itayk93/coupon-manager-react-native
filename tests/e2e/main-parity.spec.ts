import { test, expect, devices, type Browser, type Page } from '@playwright/test';

test.use({ storageState: 'playwright/.auth/user.json' });

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:8080';
const email = process.env.E2E_EMAIL || 'itayk93@gmail.com';
const password = process.env.E2E_PASSWORD || 'REDACTED_TEST_PASSWORD';

function isIgnorableConsoleError(text: string) {
  return text.includes('downloadable font: download failed');
}

async function login(page: Page) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
}

async function withProfile(browser: Browser, profile: 'desktop' | 'mobile', run: (page: Page) => Promise<void>) {
  const context = await browser.newContext(
    profile === 'mobile'
      ? { ...devices['iPhone 14 Pro'], locale: 'he-IL', storageState: 'playwright/.auth/user.json' }
      : { viewport: { width: 1440, height: 950 }, locale: 'he-IL', storageState: 'playwright/.auth/user.json' }
  );
  const page = await context.newPage();
  try {
    await run(page);
  } finally {
    await context.close();
  }
}

for (const profile of ['desktop', 'mobile'] as const) {
  test(`main dashboard interactions work on ${profile}`, async ({ browser }) => {
    await withProfile(browser, profile, async (page) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !isIgnorableConsoleError(msg.text())) consoleErrors.push(msg.text());
      });

      await login(page);
      await expect(page.getByText('יתרה זמינה')).toBeVisible();
      await expect(page.locator('.wallet-balance-card strong')).toContainText(/\d+\.\d{2} ₪/);
      await expect(page.locator('.company-card-box').first()).toBeVisible();

      if (await page.locator('.whatsapp-banner').isVisible()) {
        await expect(page.locator('.whatsapp-banner')).toContainText('קבוצות ה-WhatsApp');
        await page.locator('#whatsapp-banner-btn').click();
        const whatsappDialog = page.getByRole('dialog').filter({ hasText: 'קבוצות WhatsApp של קוד קופון' });
        await expect(whatsappDialog).toBeVisible();
        await expect(whatsappDialog.getByRole('link', { name: /קוד קופון/ })).toHaveAttribute('href', /chat\.whatsapp\.com\/IwinaUuvpY2LBV1JuQhyu7/);
        await expect(whatsappDialog.getByRole('link', { name: /עדכונים/ })).toHaveAttribute('href', /chat\.whatsapp\.com\/CxmRtTpeqcw1keG0oDFh5k/);
        await expect(whatsappDialog.getByRole('link', { name: /פייסבוק/ })).toHaveAttribute('href', /facebook\.com/);
        await expect(whatsappDialog.getByRole('link', { name: /אינסטגרם/ })).toHaveAttribute('href', /instagram\.com/);
        await page.keyboard.press('Escape');
      }

      expect(consoleErrors).toEqual([]);
    });
  });

  test(`coupons page loads and stays RTL on ${profile}`, async ({ browser }) => {
    await withProfile(browser, profile, async (page) => {
      await login(page);
      await page.goto(`${baseUrl}/coupons`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.coupon-card-index-wrapper').first()).toBeVisible();
      await expect.poll(async () => page.locator('.coupon-card-index-wrapper').count()).toBeGreaterThan(0);

      await page.locator('.view-details').first().click();
      const couponDetailDialog = page.getByRole('dialog').filter({ hasText: 'פרטי קופון' });
      await expect(couponDetailDialog).toBeVisible();
      // Verify full modal structure
      await expect(couponDetailDialog.locator('.cd-logo')).toBeVisible();
      await expect(couponDetailDialog.locator('.cd-company-name')).toBeVisible();
      await expect(couponDetailDialog.locator('.cd-tabs')).toBeVisible();
      // Tab 1 - info is default active
      await expect(couponDetailDialog.locator('.cd-tab-active').filter({ hasText: 'פרטי קופון' })).toBeVisible();
      await expect(couponDetailDialog.locator('.cd-info-grid')).toBeVisible();
      // Click on 'ערכים כספיים' tab
      await couponDetailDialog.locator('.cd-tab-btn').filter({ hasText: 'ערכים כספיים' }).click();
      await expect(couponDetailDialog.locator('.cd-donut-wrap')).toBeVisible();
      // Click on 'נתונים נוספים' tab
      await couponDetailDialog.locator('.cd-tab-btn').filter({ hasText: 'נתונים נוספים' }).click();
      await expect(couponDetailDialog.locator('.cd-info-grid')).toBeVisible();
      // Verify usage history section
      await expect(couponDetailDialog.locator('.cd-history-title')).toContainText('היסטוריית טעינות');
      // Verify action buttons
      await expect(couponDetailDialog.locator('.cd-action-row').first()).toBeVisible();
      await page.keyboard.press('Escape');

      const metrics = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, dir: getComputedStyle(document.body).direction }));
      expect(metrics.dir).toBe('rtl');
      expect(metrics.sw).toBeLessThanOrEqual(metrics.cw + 1);
    });
  });

  test(`settings security actions open working dialogs on ${profile}`, async ({ browser }) => {
    await withProfile(browser, profile, async (page) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !isIgnorableConsoleError(msg.text())) consoleErrors.push(msg.text());
      });

      await login(page);
      await page.goto(`${baseUrl}/settings`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('tab', { name: /אבטחה/ }).click();

      await page.getByRole('button', { name: 'שלח קישור לשינוי סיסמה' }).click();
      await expect(page.getByRole('dialog').filter({ hasText: 'שינוי סיסמה' })).toBeVisible();
      await page.getByRole('button', { name: 'ביטול' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);

      await page.getByRole('button', { name: 'מחק את החשבון שלי' }).click();
      await expect(page.getByRole('dialog').filter({ hasText: 'אישור מחיקת חשבון' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'אשר מחיקה' })).toBeDisabled();
      await page.getByLabel('אימייל לאישור').fill('not-the-account@example.com');
      await expect(page.getByRole('button', { name: 'אשר מחיקה' })).toBeDisabled();
      await page.getByRole('button', { name: 'ביטול' }).click();

      const metrics = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, dir: getComputedStyle(document.body).direction }));
      expect(metrics.dir).toBe('rtl');
      expect(metrics.sw).toBeLessThanOrEqual(metrics.cw + 1);
      expect(consoleErrors).toEqual([]);
    });
  });
}
