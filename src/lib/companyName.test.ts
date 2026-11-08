import { describe, expect, it } from "vitest";
import { companyKey } from "./companyName";

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

  it("folds known Hebrew aliases into their canonical companies", () => {
    expect(companyKey("אקסטרה")).toBe("xtra");
    expect(companyKey("XTRA")).toBe("xtra");
    expect(companyKey("משלוחה-ארצי")).toBe("משלוחה");
    expect(companyKey("משלוחה")).toBe("משלוחה");
  });
});

