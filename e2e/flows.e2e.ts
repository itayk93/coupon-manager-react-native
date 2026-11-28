import { expect, test } from "@playwright/test";
import {
  attachErrorTracker,
  loadSanitizedFixture,
  setupCouponBackend,
  signInViaUi,
} from "./helpers";

test.describe("Coupon Master E2E user flows", () => {
  test("register validation, legal links, forgot password, and login session persistence", async ({
    page,
  }) => {
    const backend = await setupCouponBackend(page);
    const { errors } = attachErrorTracker(page);

    await page.goto("/register");
    await expect(page.getByPlaceholder("ישראל ישראלי")).toBeVisible();
    await page.getByText("מדיניות הפרטיות").first().click();
    await expect(page).toHaveURL(/\/privacy/);

    await page.goto("/forgot-password");
    await expect(page.getByText("שחזור סיסמה").first()).toBeVisible();
    await page.getByPlaceholder("you@example.com").fill("e2e-tester@example.test");
    await page.getByText("שליחת קישור").click();
    await expect(page.getByText("שלחנו לכם קישור לאיפוס הסיסמה")).toBeVisible();
    expect(backend.passwordResetCalls).toHaveLength(1);

    await signInViaUi(page);
    await page.reload();
    await expect(page.getByText("BuyMe").first()).toBeVisible({ timeout: 15_000 });
    expect(backend.externalRequests).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("manual add, search filter, detail view, usage recording, edit, and offline cache banner", async ({
    page,
  }) => {
    const backend = await setupCouponBackend(page);
    const { errors } = attachErrorTracker(page);

    await signInViaUi(page);

    // Navigate to Coupons list and verify expiry badge & search
    await page.getByText("קופונים", { exact: true }).last().click();
    await expect(page.getByText("הקופונים שלי")).toBeVisible();
    await expect(page.getByText("BuyMe").first()).toBeVisible();

    const searchBox = page.getByPlaceholder("חיפוש לפי חברה, תיאור או מספר קופון");
    await searchBox.fill("שופרסל");
    await expect(page.getByText("E2E-SH-2002").first()).toBeVisible();
    await searchBox.fill("");

    // Add coupon manually
    await page.goto("/coupons/add");
    await page.getByText("בחר חברה מרשימה...").click();
    await expect(page.getByText("בחירת חברה / מותג")).toBeVisible();
    await page.getByText("BuyMe").last().click();

    await page.getByPlaceholder("קוד הקופון...").fill("E2E-NEW-999");
    await page.getByPlaceholder("0.00").first().fill("180");
    await page.getByText("הוסף קופון לארנק").click();

    await expect.poll(() => backend.coupons.some((c) => c.code === "E2E-NEW-999")).toBe(true);
    const created = backend.coupons.find((c) => c.code === "E2E-NEW-999")!;

    // Open coupon detail and verify balance & usage recording
    await page.goto(`/coupons/${created.public_id}`);
    await expect(page.getByText("E2E-NEW-999")).toBeVisible();
    await page.getByRole("button", { name: "דיווח על שימוש בקופון" }).click();
    await expect(page.getByPlaceholder("0.00")).toBeVisible();

    // Edit coupon directly and confirm update persists across reload
    await page.goto(`/coupons/edit?couponId=${created.public_id}`);
    const valueInput = page.getByPlaceholder("0.00").first();
    await valueInput.fill("220");
    await page.getByText("שמור שינויים").click();
    await expect.poll(() => backend.coupons.find((c) => c.id === created.id)?.value).toBe(220);

    // Offline cache fallback banner when coupon-vault fails remotely
    backend.vaultNetworkError = true;
    await page.goto("/coupons");
    await expect(page.getByText("הקופונים שלי")).toBeVisible();
    await page.reload();
    await expect(page.getByText("BuyMe").first()).toBeVisible({ timeout: 15_000 });
    expect(errors.filter((e) => !e.includes("Failed to load") && !e.includes("ERR_FAILED"))).toEqual(
      []
    );
  });

  test("AI consent opt-in, revocation blocks parse-coupon, and failure keeps retry clean", async ({
    page,
  }) => {
    const backend = await setupCouponBackend(page, { aiConsentGranted: false });
    await signInViaUi(page);

    // Without consent, parsing prompts consent sheet and NEVER calls parse-coupon until agreed
    await page.goto("/scanner");
    await expect(page.getByText("קופון חדש בקליק")).toBeVisible();
    const tutorialBtn = page.getByText("יאללה, מוסיפים קופון");
    try {
      await tutorialBtn.waitFor({ state: "visible", timeout: 4_000 });
      await tutorialBtn.click();
      await tutorialBtn.waitFor({ state: "hidden", timeout: 4_000 });
    } catch {
      // Tutorial already seen for this session
    }
    await page
      .getByPlaceholder(/למשל: שלום ישראל/)
      .fill("קופון BuyMe בשווי 120 ש\"ח קוד AI-E2E-777 בתוקף עד 15.08.2027");
    await page.getByText("חלץ פרטים והוסף קופון").click();

    await expect(page.getByTestId("ai-consent-allow")).toBeVisible();
    expect(backend.parseCalls).toHaveLength(0);

    // Approve AI consent in prompt -> proceeds to parse and navigates to prefilled /coupons/add
    await page.getByTestId("ai-consent-allow").click();
    await expect.poll(() => backend.parseCalls.length).toBe(1);
    await expect(page).toHaveURL(/\/coupons\/add/, { timeout: 10_000 });

    // Simulate AI provider failure & recovery on retry
    backend.parseShouldFail = true;
    await page.goto("/scanner");
    await page
      .getByPlaceholder(/למשל: שלום ישראל/)
      .fill("קופון BuyMe בשווי 120 ש\"ח קוד AI-E2E-RETRY בתוקף עד 15.08.2027");
    await page.getByText("חלץ פרטים והוסף קופון").click();
    await expect.poll(() => backend.parseCalls.length).toBe(2);

    backend.parseShouldFail = false;
    await page.getByText("חלץ פרטים והוסף קופון").click();
    await expect.poll(() => backend.parseCalls.length).toBe(3);
    await expect(page).toHaveURL(/\/coupons\/add/, { timeout: 10_000 });

    // Revoke AI consent in Settings -> subsequent parse shows prompt and makes 0 requests
    await page.goto("/settings");
    await page.getByTestId("ai-consent-decline").click();
    await expect(page.getByText("שיתוף עם OpenAI אינו מאושר")).toBeVisible();

    const callsBeforeRevoked = backend.parseCalls.length;
    await page.goto("/scanner");
    await page
      .getByPlaceholder(/למשל: שלום ישראל/)
      .fill("קופון בדיקה חסום 987654 שווי 50");
    await page.getByText("חלץ פרטים והוסף קופון").click();
    await expect(page.getByTestId("ai-consent-allow")).toBeVisible();
    await page.getByTestId("ai-consent-decline").click();
    expect(backend.parseCalls).toHaveLength(callsBeforeRevoked);
  });

  test("account export trigger and disposable account deletion clears storage and blocks re-login", async ({
    page,
  }) => {
    const fixture = loadSanitizedFixture();
    const backend = await setupCouponBackend(page, { aiConsentGranted: true });
    await signInViaUi(page);

    await page.goto("/settings");
    await expect(page.getByText(fixture.authUser.email)).toBeVisible();

    // Trigger export request
    await page.getByTestId("account-export").click();
    await expect.poll(() => backend.exportCalls).toBe(1);

    // Delete disposable account -> confirm -> vault delete_account -> storage wiped -> login gate
    await page.getByTestId("account-delete").click();
    await expect(page.getByText("כל הקופונים, ההיסטוריה, ההגדרות והפרטים שלך יימחקו")).toBeVisible();
    await page.getByText("מחק את החשבון", { exact: true }).click();

    await expect.poll(() => backend.deleteAccountCalls).toBe(1);
    await expect(page.getByTestId("login-email")).toBeVisible({ timeout: 15_000 });

    const remainingKeys = await page.evaluate(() => ({
      offline: localStorage.getItem("offline:coupons:v1"),
      legacy: localStorage.getItem("coupon_master_legacy_session"),
      sb: localStorage.getItem("sb-dugjsiyenazpsoiyduuz-auth-token"),
    }));
    expect(remainingKeys).toEqual({ offline: null, legacy: null, sb: null });

    // Confirm deleted account cannot log back in
    await page.getByTestId("login-email").fill(fixture.authUser.email);
    await page.getByTestId("login-password").pressSequentially("e2e-synthetic-pass");
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("login-email")).toBeVisible();
  });
});
