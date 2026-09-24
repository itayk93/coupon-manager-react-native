import { describe, expect, it } from "vitest";
import { pickerCoupons } from "./couponPicker";

const wallet = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  company: i % 2 ? "Wolt" : "שופרסל",
  description: null,
  code: `CODE-${i + 1}`,
}));

describe("pickerCoupons", () => {
  it("caps a long wallet and reports the full count", () => {
    const { shown, total } = pickerCoupons(wallet, "", null, 30);
    expect(shown).toHaveLength(30);
    expect(total).toBe(40);
  });

  it("filters by company", () => {
    const { shown, total } = pickerCoupons(wallet, "wolt", null, 30);
    expect(total).toBe(20);
    expect(shown.every((c) => c.company === "Wolt")).toBe(true);
  });

  it("finds a coupon past the cap by its code", () => {
    const { shown } = pickerCoupons(wallet, "CODE-38", null, 30);
    expect(shown.map((c) => c.id)).toEqual([38]);
  });

  it("keeps the selected coupon listed even when it is outside the page", () => {
    const { shown } = pickerCoupons(wallet, "wolt", 39 + 1 - 1, 5);
    expect(shown[0].id).toBe(39);
    expect(shown).toHaveLength(6);
  });

  it("does not list the selection twice", () => {
    const { shown } = pickerCoupons(wallet, "", 2, 30);
    expect(shown.filter((c) => c.id === 2)).toHaveLength(1);
  });
});
