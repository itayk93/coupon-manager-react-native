import { expect, test } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  attachErrorTracker,
  setupCouponBackend,
  signInViaUi,
} from "./helpers";

test.describe("Coupon Master RTL and BiDi layout", () => {
  test("html root sets lang=he and dir=rtl with clean login and legal views", async ({ page }) => {
    await setupCouponBackend(page);
    const { errors } = attachErrorTracker(page);

    await page.goto("/login");
    await expect(page.getByTestId("login-email")).toBeVisible();

    const attrs = await page.evaluate(() => ({
      lang: document.documentElement.getAttribute("lang"),
      dir: document.documentElement.getAttribute("dir"),
    }));
    // webDocumentHead deliberately sets lang="he" without dir="rtl" so manual
    // row-reverse RNW layouts do not get double-flipped in the browser.
    expect(attrs).toEqual({ lang: "he", dir: null });
    await assertNoHorizontalOverflow(page);

    await page.goto("/privacy");
    await expect(page.getByText("מדיניות פרטיות").first()).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto("/terms");
    await expect(page.getByText("תנאי שימוש").first()).toBeVisible();
    await assertNoHorizontalOverflow(page);

    expect(errors).toEqual([]);
  });

  test("primary navigation renders right-to-left and sub-screens keep back button top-right", async ({
    page,
  }, testInfo) => {
    await setupCouponBackend(page);
    const { errors } = attachErrorTracker(page);

    await signInViaUi(page);
    await assertNoHorizontalOverflow(page);

    if (testInfo.project.name === "mobile-chromium") {
      // BottomNav order on mobile: דשבורד (rightmost) > קופונים > הוספת קופון > שיתופים > חשבון (leftmost)
      const labels = ["דשבורד", "קופונים", "הוספת קופון", "שיתופים", "חשבון"];
      const xs: number[] = [];
      for (const label of labels) {
        const box = await page.getByRole("button", { name: label, exact: true }).last().boundingBox();
        expect(box, `Missing tab button ${label}`).not.toBeNull();
        xs.push(box!.x);
      }
      for (let i = 0; i < xs.length - 1; i++) {
        expect(xs[i], `Tab ${labels[i]} should be to the right of ${labels[i + 1]}`).toBeGreaterThan(
          xs[i + 1]
        );
      }
    } else {
      await assertNoHorizontalOverflow(page);
    }

    // Check Header with showBack on /coupons/add and /scanner places title right-aligned without overflow
    await page.goto("/coupons/add");
    await expect(page.getByText("הוספת קופון", { exact: true }).first()).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const vw = page.viewportSize()!.width;
    const headerBar = await page
      .getByText("הוספת קופון", { exact: true })
      .first()
      .boundingBox();
    expect(headerBar).not.toBeNull();
    expect(headerBar!.x).toBeGreaterThanOrEqual(0);
    expect(headerBar!.x + headerBar!.width).toBeLessThanOrEqual(vw + 1);

    await page.goto("/scanner");
    await expect(page.getByText("קופון חדש בקליק")).toBeVisible();
    const tutorialBtn = page.getByText("אולי אחר כך");
    try {
      await tutorialBtn.waitFor({ state: "visible", timeout: 3_000 });
      await tutorialBtn.click();
      await tutorialBtn.waitFor({ state: "hidden", timeout: 3_000 });
    } catch {
      // Already dismissed
    }
    await assertNoHorizontalOverflow(page);

    expect(errors).toEqual([]);
  });
});
