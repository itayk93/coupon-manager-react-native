import { describe, expect, it } from "vitest";
import { companyKey, groupCouponsByCompany } from "./companyName";

describe("companyKey", () => {
  it("folds case and whitespace", () => {
    expect(companyKey("GoodPharm")).toBe("goodpharm");
    expect(companyKey("  GoodPharm ")).toBe("goodpharm");
    expect(companyKey("גוד  פארם")).toBe("גוד פארם");
  });

  it("treats an empty name as the empty key", () => {
    expect(companyKey(null)).toBe("");
    expect(companyKey("   ")).toBe("");
  });
});

describe("groupCouponsByCompany", () => {
  it("merges case variants into one group and keeps the first display name", () => {
    const groups = groupCouponsByCompany([
      { company: "GoodPharm" },
      { company: "goodpharm" },
      { company: "Wolt" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].company).toBe("GoodPharm");
    expect(groups[0].items).toHaveLength(2);
  });
});
