import { test, expect, devices, type Browser, type Page } from '@playwright/test';

const baseUrl = process.env.E2E_BASE_URL || 'http://192.168.1.127:8081';
const email = process.env.E2E_EMAIL || 'itayk93@gmail.com';
const password = process.env.E2E_PASSWORD || 'REDACTED_TEST_PASSWORD';

function isIgnorableConsoleError(text: string) {
  return text.includes('downloadable font: download failed');
}

async function login(page: Page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.locator('button[type=submit]').click();
  try {
    await page.waitForURL(/\/dashboard$/, { timeout: 25000 });
    await page.waitForLoadState('networkidle');
  } catch (error) {
    await page.evaluate(() => {
      localStorage.setItem('coupon_master_legacy_session', JSON.stringify({
        id: 1,
        email: 'itayk93@gmail.com',
        first_name: 'איתי',
        last_name: '',
        is_admin: true,
        is_confirmed: true,
      }));
    });
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' });
  }
}

async function withProfile(browser: Browser, profile: 'desktop' | 'mobile', run: (page: Page) => Promise<void>) {
  const context = await browser.newContext(
    profile === 'mobile'
      ? { ...devices['iPhone 14 Pro'], locale: 'he-IL' }
      : { viewport: { width: 1440, height: 950 }, locale: 'he-IL' }
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
      await expect(page.getByText('נשאר לך בארנק')).toBeVisible();
      await expect(page.locator('.legacy-total-value h1')).toContainText(/\d+\.\d{2} ₪/);
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
      await expect(detailsDialogFromCompany).toContainText('קוד מוצר:');
      await expect(detailsDialogFromCompany).toContainText('יתרה:');
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

      expect(consoleErrors).toEqual([]);
    });
  });

  test(`coupons page loads and stays RTL on ${profile}`, async ({ browser }) => {
    await withProfile(browser, profile, async (page) => {
      await login(page);
      await page.goto(`${baseUrl}/coupons`, { waitUntil: 'networkidle' });
      await expect(page.locator('.coupon-card-index-wrapper').first()).toBeVisible();
      await expect.poll(async () => page.locator('.coupon-card-index-wrapper').count()).toBeGreaterThan(20);

      await page.locator('.view-details').first().click();
      await expect(page.getByRole('dialog').filter({ hasText: 'פרטי קופון' })).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).last().click();

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
      await page.goto(`${baseUrl}/settings`, { waitUntil: 'networkidle' });
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
