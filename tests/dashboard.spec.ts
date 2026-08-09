import { expect, test } from "@playwright/test";

test.use({ storageState: "playwright/.auth/user.json" });

test.describe("dashboard layout", () => {
  test("desktop dashboard renders the copied shell", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    await expect(page.getByRole("link", { name: /קופון מאסטר/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /דשבורד/ })).toBeVisible();
    await expect(page.getByText("יתרה זמינה")).toBeVisible();
    await expect(page.getByText(/קופונים פעילים לניצול/)).toBeVisible();
  });

  test("mobile dashboard uses the drawer navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");

    await expect(page.getByText("יתרה זמינה")).toBeVisible();
    await page.getByRole("button", { name: "פתח תפריט" }).click();
    await expect(page.getByRole("dialog").getByRole("link", { name: "קופונים" })).toBeVisible();
  });
});
