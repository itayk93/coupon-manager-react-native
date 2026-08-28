import { describe, expect, it } from "vitest";
import { couponRouteId } from "./couponId";

describe("couponRouteId", () => {
  it("uses the opaque public id", () => {
    expect(couponRouteId({ id: 42, public_id: "cpn_0123456789abcdefabcd" }))
      .toBe("cpn_0123456789abcdefabcd");
  });

  it("keeps cached pre-migration coupons routable", () => {
    expect(couponRouteId({ id: 42 })).toBe("42");
  });
});
