import { expect, test } from "@playwright/test";

test("renders the Coupon Master landing page", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "הפסיקו לפספס קופונים. התחילו לחסוך אלפי שקלים!" })).toBeVisible();
  await expect(page.getByText("המשתמשים שלנו כבר חסכו: ₪0")).toBeVisible();
  await expect(page.getByRole("link", { name: "התחילו לחסוך עכשיו!" })).toHaveAttribute("href", "/register");
});
