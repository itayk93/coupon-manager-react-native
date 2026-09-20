import { describe, expect, it } from "vitest";
import { buildNavItems, isNavItemActive } from "./navigation";

describe("buildNavItems", () => {
  it("leads with the dashboard, as Hebrew reads", () => {
    expect(buildNavItems({ isAdmin: false })[0].path).toBe("/");
  });

  it("keeps the phone bar at six destinations", () => {
    expect(buildNavItems({ isAdmin: false })).toHaveLength(6);
  });

  it("gives the iPad rail back סטטיסטיקה, next to the coupons it counts", () => {
    const rail = buildNavItems({ isAdmin: false, roomy: true });
    expect(rail).toHaveLength(7);
    expect(rail[2].path).toBe("/statistics");
    expect(buildNavItems({ isAdmin: false }).some((i) => i.path === "/statistics")).toBe(false);
  });

  it("sends an admin to the referral dashboard and everyone else to the invite page", () => {
    const partner = (isAdmin: boolean) =>
      buildNavItems({ isAdmin }).find((item) => item.label === "שותפים")!;
    expect(partner(true).path).toBe("/admin?tab=referrals");
    expect(partner(false).path).toBe("/invite");
  });

  it("stops /admin lighting up the account item for an admin, who has their own", () => {
    const account = (isAdmin: boolean) =>
      buildNavItems({ isAdmin }).find((item) => item.path === "/settings")!;
    expect(account(true).match).not.toContain("/admin");
    expect(account(false).match).toContain("/admin");
  });
});

describe("isNavItemActive", () => {
  const items = buildNavItems({ isAdmin: false });
  const byPath = (path: string) => items.find((item) => item.path === path)!;

  it("lights the dashboard on both spellings of the root route", () => {
    expect(isNavItemActive(byPath("/"), "/")).toBe(true);
    expect(isNavItemActive(byPath("/"), "/index")).toBe(true);
    expect(isNavItemActive(byPath("/"), "/coupons")).toBe(false);
  });

  it("keeps קופונים lit on a coupon and on the scanner", () => {
    expect(isNavItemActive(byPath("/coupons"), "/coupons/42")).toBe(true);
    expect(isNavItemActive(byPath("/coupons"), "/scanner")).toBe(true);
  });

  it("does not match a path that merely starts with the same letters", () => {
    expect(isNavItemActive(byPath("/coupons"), "/coupons-archive")).toBe(false);
  });

  it("matches on the match list, never on a path carrying a query string", () => {
    const partner = buildNavItems({ isAdmin: true }).find((i) => i.label === "שותפים")!;
    expect(isNavItemActive(partner, "/admin")).toBe(true);
    expect(isNavItemActive(partner, "/admin?tab=referrals")).toBe(false);
  });
});
