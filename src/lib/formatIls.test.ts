import { describe, expect, it } from "vitest";
import { formatIls } from "./formatIls";

describe("formatIls", () => {
  it("puts the shekel sign before the number", () => {
    expect(formatIls(4015.02)).toBe("\u2066₪\u00A04,015.02\u2069");
  });

  it("always emits two decimals", () => {
    expect(formatIls(12)).toBe("\u2066₪\u00A012.00\u2069");
  });

  it("keeps the minus sign attached to the number", () => {
    expect(formatIls(-1234.5)).toBe("\u2066₪\u00A0-1,234.50\u2069");
  });
});
