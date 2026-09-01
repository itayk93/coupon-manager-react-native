import { describe, expect, it } from "vitest";
import { matchCompanyName } from "./companyMatch";

describe("matchCompanyName", () => {
  it("maps Hebrew GoodPharm variants to the canonical English company", () => {
    const known = ["BuyMe", "GoodPharm", "Wolt"];
    expect(matchCompanyName("גוד פארם", known)).toBe("GoodPharm");
    expect(matchCompanyName("גוד-פארם", known)).toBe("GoodPharm");
    expect(matchCompanyName("goodpharm", known)).toBe("GoodPharm");
  });
});
