import { describe, expect, it } from "vitest";
import { matchCompanyName } from "./companyMatch";

describe("matchCompanyName", () => {
  it("maps Hebrew GoodPharm variants to the canonical English company", () => {
    const known = ["BuyMe", "GoodPharm", "Wolt"];
    expect(matchCompanyName("גוד פארם", known)).toBe("GoodPharm");
    expect(matchCompanyName("גוד-פארם", known)).toBe("GoodPharm");
    expect(matchCompanyName("goodpharm", known)).toBe("GoodPharm");
  });

  it("maps Hebrew aliases to XTRA and Mishloha", () => {
    const known = ["XTRA", "משלוחה", "Wolt"];
    expect(matchCompanyName("אקסטרה", known)).toBe("XTRA");
    expect(matchCompanyName("משלוחה-ארצי", known)).toBe("משלוחה");
  });
});
