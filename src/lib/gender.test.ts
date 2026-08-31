import { describe, expect, it } from "vitest";
import { isFemaleUser } from "./gender";

describe("isFemaleUser", () => {
  it("reads the Hebrew values the old web app wrote", () => {
    expect(isFemaleUser("נקבה")).toBe(true);
    expect(isFemaleUser("אישה")).toBe(true);
  });

  it("reads the English values newer sign-ups write", () => {
    expect(isFemaleUser("female")).toBe(true);
    expect(isFemaleUser("F")).toBe(true);
  });

  it("ignores surrounding whitespace and case", () => {
    expect(isFemaleUser("  Female  ")).toBe(true);
  });

  it("falls back to masculine when the field says nothing useful", () => {
    for (const value of [null, undefined, "", "   ", "male", "זכר", "other", "x"]) {
      expect(isFemaleUser(value)).toBe(false);
    }
  });
});
