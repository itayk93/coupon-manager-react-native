import { test, expect, devices, type Browser, type Page } from '@playwright/test';

test.use({ storageState: 'playwright/.auth/user.json' });

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:8080';
// A floor that can actually fail: the seeded account carries far more than
// this, so a silently-empty coupons page still breaks the test.
const minCoupons = Number(process.env.E2E_MIN_COUPONS || 5);

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
      await expect.poll(async () => page.locator('.coupon-card-index-wrapper').count()).toBeGreaterThanOrEqual(minCoupons);

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

  // Quarantined: these assertions were dropped in 866a5cc under a "stabilize"
  // label, which hid the coverage loss. They are restored here as fixme so the
  // gap is visible in the report rather than silently absent. They depend on
  // the live account's data (a coupon with a code, an enabled usage button, a
  // free usage-report slot); un-fixme them once a seeded fixture dataset makes
  // those preconditions deterministic.
  test.fixme(`dashboard coupon action modals on ${profile}`, async ({ browser }) => {
    await withProfile(browser, profile, async (page) => {
      await login(page);

      await page.locator('.legacy-info-button').click();
      await expect(page.getByRole('dialog').filter({ hasText: 'סטטיסטיקות החיסכון שלך' })).toBeVisible();
      await page.keyboard.press('Escape');

      await page.locator('.legacy-report-button').click();
      const usageReportDialog = page.getByRole('dialog').filter({ hasText: 'דיווח אוטומטי על שימוש בקופונים' });
      await expect(usageReportDialog).toBeVisible();
      await expect(usageReportDialog.locator('#usage_explanation')).toBeVisible();
      await expect(usageReportDialog.locator('.slots-info')).toContainText('סלוטים זמינים');
      await usageReportDialog.locator('#usage_explanation').fill('השתמשתי ב Carrefour בסכום 1');
      await usageReportDialog.getByRole('button', { name: 'שלח דיווח' }).click();
      const reviewUsageDialog = page.getByRole('dialog').filter({ hasText: 'אישור שימושים שאותרו' });
      await expect(reviewUsageDialog).toBeVisible();
      await expect(reviewUsageDialog.locator('.usage-table')).toBeVisible();
      await expect(reviewUsageDialog.locator('.usage-checkbox').first()).toBeChecked();
      await expect(reviewUsageDialog.locator('.coupon-select').first()).toBeVisible();
      await reviewUsageDialog.locator('.btn-used').first().click();
      await expect(reviewUsageDialog.locator('.amount-input').first()).not.toHaveValue('1.00');
      await reviewUsageDialog.getByRole('button', { name: 'חזרה' }).click();
      await expect(page.getByRole('dialog').filter({ hasText: 'דיווח אוטומטי על שימוש בקופונים' })).toBeVisible();
      await page.keyboard.press('Escape');

      await page.locator('.legacy-quick-add-button').click();
      await expect(page.getByRole('dialog').filter({ hasText: 'הוספת קופון מהירה' })).toBeVisible();
      await page.getByRole('button', { name: 'הבא' }).click();
      await expect(page.getByRole('dialog').filter({ hasText: 'פרטי הקופון' })).toBeVisible();
      await page.keyboard.press('Escape');

      await page.locator('.company-card-box').first().click();
      const companyDialog = page.getByRole('dialog').filter({ hasText: 'קופונים מחברת' });
      await expect(companyDialog).toBeVisible();
      await expect(companyDialog.getByRole('heading', { name: /קופונים מחברת/ })).toBeVisible();
      await expect(page.getByText('סה"כ נותר')).toBeVisible();
      await expect(companyDialog.locator('.legacy-company-modal-head img')).toBeVisible();
      await expect(companyDialog.locator('.legacy-company-coupon-list li').first()).toContainText(/קוד: .* - (נותר|מטרה):/);
      await expect(companyDialog.locator('.show-big-btn').first()).toBeVisible();
      await expect(companyDialog).not.toContainText('בחר קופון להצגת הקוד');

      await companyDialog.locator('.legacy-company-coupon-link').first().click();
      const detailsDialogFromCompany = page.getByRole('dialog').filter({ hasText: 'פרטי קופון' });
      await expect(detailsDialogFromCompany).toBeVisible();
      await expect(detailsDialogFromCompany.locator('.cd-tabs')).toBeVisible();
      await expect(detailsDialogFromCompany.locator('.cd-tab-btn').filter({ hasText: 'פרטי קופון' })).toBeVisible();
      await expect(detailsDialogFromCompany.locator('.cd-tab-btn').filter({ hasText: 'ערכים כספיים' })).toBeVisible();
      await expect(detailsDialogFromCompany.locator('.cd-tab-btn').filter({ hasText: 'נתונים נוספים' })).toBeVisible();
      await expect(detailsDialogFromCompany.locator('.cd-info-box').first()).toBeVisible();
      await expect(detailsDialogFromCompany.locator('.cd-history-title')).toContainText('היסטוריית טעינות');
      await page.getByRole('button', { name: 'Close' }).last().click();

      const actionColors = await companyDialog.locator('.coupon-info-buttons').first().evaluate((element) => {
        const usageButton = element.querySelector('.update-usage-btn');
        const codeButton = element.querySelector('.show-big-btn');
        return {
          usage: usageButton ? getComputedStyle(usageButton).backgroundColor : '',
          code: codeButton ? getComputedStyle(codeButton).backgroundColor : '',
        };
      });
      expect(actionColors.usage).toBe('rgb(39, 174, 96)');
      expect(actionColors.code).toBe('rgb(52, 152, 219)');

      await companyDialog.locator('.show-big-btn').first().click();
      const codeDialog = page.getByRole('dialog').last();
      await expect(codeDialog.getByTestId('big-modal-coupon-code')).toContainText(/\d|[A-Z]/);
      await expect(codeDialog.locator('.big-code-qr svg')).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).last().click();

      await companyDialog.locator('.update-usage-btn').first().click();
      const usageDialog = page.getByRole('dialog').last();
      await expect(usageDialog).toContainText('עדכון סכום שימוש');
      await expect(usageDialog).toContainText('יתרה נוכחית');
      await usageDialog.getByRole('button', { name: 'עדכון כל היתרה' }).click();
      await expect(usageDialog.getByLabel('בכמה השתמשת?')).not.toHaveValue('');
      await page.getByRole('button', { name: 'Close' }).last().click();
    });
  });

  // Quarantined alongside the block above — same commit, same reason.
  test.fixme(`coupons page row actions on ${profile}`, async ({ browser }) => {
    await withProfile(browser, profile, async (page) => {
      await login(page);
      await page.goto(`${baseUrl}/coupons`, { waitUntil: 'domcontentloaded' });

      await page.locator('.show-code').first().click();
      await expect(page.getByRole('dialog').last()).toContainText(/\d|[A-Z]/);
      await expect(page.getByRole('dialog').last().locator('.big-code-qr svg')).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).last().click();

      const enabledUpdateButtons = page.locator('.update-usage:not([disabled])');
      await expect(enabledUpdateButtons.first()).toBeVisible();
      await enabledUpdateButtons.first().click();
      await expect(page.getByRole('dialog').last()).toContainText('עדכון סכום שימוש');
      await page.getByRole('button', { name: 'Close' }).last().click();

      await page.locator('.edit-coupon').first().click();
      await expect(page.getByRole('dialog').filter({ hasText: 'עריכת קופון' })).toBeVisible();
      await expect(page.getByLabel('חברה / מותג *')).not.toHaveValue('');
      await page.getByRole('button', { name: 'ביטול' }).click();

      await page.locator('.delete-coupon').first().click();
      const deleteDialog = page.getByRole('dialog').filter({ hasText: 'אישור מחיקת קופון' });
      await expect(deleteDialog).toBeVisible();
      await expect(deleteDialog).toContainText('האם אתה בטוח שברצונך למחוק קופון זה?');
      await deleteDialog.getByRole('button', { name: 'ביטול' }).click();

      const enabledMarkUsedButtons = page.locator('.mark-used-coupon:not([disabled])');
      await expect(enabledMarkUsedButtons.first()).toBeVisible();
      await enabledMarkUsedButtons.first().click();
      const markUsedDialog = page.getByRole('dialog').filter({ hasText: 'סימון הקופון כנוצל' });
      await expect(markUsedDialog).toBeVisible();
      await expect(markUsedDialog).toContainText('האם אתה בטוח שברצונך לסמן קופון זה כנוצל?');
      await markUsedDialog.getByRole('button', { name: 'ביטול' }).click();
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
