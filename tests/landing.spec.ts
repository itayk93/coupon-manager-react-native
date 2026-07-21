import { expect, test } from "@playwright/test";

test("redirects root directly to the app login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "התחברות" })).toBeVisible();
  await expect(page.getByRole("button", { name: "התחבר", exact: true })).toBeVisible();
});
