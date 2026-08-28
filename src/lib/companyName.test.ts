import { describe, expect, it } from "vitest";
import { companyKey, groupCouponsByCompany } from "./companyName";

describe("companyKey", () => {
  it("folds case and whitespace", () => {
    expect(companyKey("GoodPharm")).toBe("goodpharm");
    expect(companyKey("  GoodPharm ")).toBe("goodpharm");
    expect(companyKey("גוד  פארם")).toBe("goodpharm");
    expect(companyKey("גוד-פארם")).toBe("goodpharm");
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

  it("merges known Hebrew and English brand names", () => {
    const groups = groupCouponsByCompany([
      { company: "GoodPharm" },
      { company: "גוד פארם" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
  });
});
