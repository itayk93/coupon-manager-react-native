import { describe, expect, it } from "vitest";
import { formatIls } from "./formatIls";

describe("formatIls", () => {
  it("puts the shekel sign before the number", () => {
    expect(formatIls(4015.02)).toBe("₪ 4,015.02");
  });

  it("always emits two decimals", () => {
    expect(formatIls(12)).toBe("₪ 12.00");
  });

  it("keeps the minus sign attached to the number", () => {
    expect(formatIls(-1234.5)).toBe("₪ -1,234.50");
  });
});
