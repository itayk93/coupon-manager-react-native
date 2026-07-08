import { expect, test } from "@playwright/test";

const legacySession = {
  id: 1,
  email: "itayk93@example.com",
  first_name: "itayk93",
  last_name: "",
  is_admin: true,
  is_confirmed: true,
};

test.describe("dashboard layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((session) => {
      localStorage.setItem("coupon_master_legacy_session", JSON.stringify(session));
    }, legacySession);
  });

  test("desktop dashboard renders the copied shell", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    await expect(page.getByRole("link", { name: "Coupon Master" })).toBeVisible();
    await expect(page.getByRole("link", { name: /דשבורד/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /ברוך הבא, itayk93/ })).toBeVisible();
    await expect(page.getByText("קופונים אחרונים שהוספו")).toBeVisible();
  });

  test("mobile dashboard uses the drawer navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: /ברוך הבא, itayk93/ })).toBeVisible();
    await page.getByRole("button", { name: "פתח תפריט" }).click();
    await expect(page.getByRole("link", { name: /הקופונים שלי/ })).toBeVisible();
  });
});
