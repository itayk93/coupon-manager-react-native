import { describe, expect, it } from "vitest";
import {
  MAX_WIDGET_COUPONS,
  isWidgetEligible,
  isWidgetFull,
  nextWidgetOrder,
  widgetSelection,
} from "./widgetSelection";
import type { DecryptedCoupon } from "@/hooks/useCoupons";

function coupon(overrides: Partial<DecryptedCoupon>): DecryptedCoupon {
  return {
    id: 1,
    company: "GoodPharm",
    value: 100,
    used_value: 0,
    status: "פעיל",
    show_in_widget: false,
    widget_display_order: null,
    ...overrides,
  } as DecryptedCoupon;
}

describe("isWidgetEligible", () => {
  it("accepts an active coupon with a balance left", () => {
    expect(isWidgetEligible(coupon({ used_value: 88.7 }))).toBe(true);
  });

  it("rejects a used-up or fully spent coupon", () => {
    expect(isWidgetEligible(coupon({ status: "נוצל" }))).toBe(false);
    expect(isWidgetEligible(coupon({ used_value: 100 }))).toBe(false);
  });
});

describe("widgetSelection", () => {
  it("returns the chosen coupons in display order", () => {
    const chosen = widgetSelection([
      coupon({ id: 2, show_in_widget: true, widget_display_order: 1 }),
      coupon({ id: 3, show_in_widget: false }),
      coupon({ id: 4, show_in_widget: true, widget_display_order: 0 }),
    ]);
    expect(chosen.map((c) => c.id)).toEqual([4, 2]);
  });

  it("drops a chosen coupon that is no longer eligible", () => {
    const chosen = widgetSelection([
      coupon({ id: 5, show_in_widget: true, status: "נוצל", widget_display_order: 0 }),
    ]);
    expect(chosen).toEqual([]);
  });
});

describe("capacity", () => {
  const full = Array.from({ length: MAX_WIDGET_COUPONS }, (_, i) =>
    coupon({ id: i + 1, show_in_widget: true, widget_display_order: i })
  );

  it("appends after the current selection", () => {
    expect(nextWidgetOrder([])).toBe(0);
    expect(nextWidgetOrder(full)).toBe(MAX_WIDGET_COUPONS);
  });

  it("reports a full widget", () => {
    expect(isWidgetFull(full)).toBe(true);
    expect(isWidgetFull(full.slice(1))).toBe(false);
  });

  it("frees a slot when a chosen coupon becomes ineligible", () => {
    const stale = [{ ...full[0], status: "נוצל" }, ...full.slice(1)] as DecryptedCoupon[];
    expect(isWidgetFull(stale)).toBe(false);
  });
});
