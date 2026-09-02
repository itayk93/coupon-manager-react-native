import { describe, expect, it } from "vitest";
import { rtlText } from "./rtlText";

const RLM = "‏";
const LRI = "⁦";
const PDI = "⁩";

describe("rtlText", () => {
  it("marks the sentence right-to-left", () => {
    expect(rtlText("יש עדכון חדש")).toBe(`${RLM}יש עדכון חדש`);
  });

  it("isolates a Latin brand inside Hebrew", () => {
    expect(rtlText("הקופון ב־Wolt נסגר")).toBe(`${RLM}הקופון ב־${LRI}Wolt${PDI} נסגר`);
  });

  it("isolates the amount apart from the brand", () => {
    expect(rtlText("Wolt נסגר עם 10.00 ש״ח.")).toBe(
      `${RLM}${LRI}Wolt${PDI} נסגר עם ${LRI}10.00${PDI} ש״ח.`,
    );
  });

  it("keeps a shekel sign glued to its number", () => {
    expect(rtlText("נותרו ₪ 42.50 בארנק")).toBe(
      `${RLM}נותרו ${LRI}₪ 42.50${PDI} בארנק`,
    );
  });

  it("is idempotent, so a caller that already marked text is safe", () => {
    const once = rtlText("הקופון ב־Wolt נסגר עם 10.00 ש״ח.");
    expect(rtlText(once)).toBe(once);
  });

  it("leaves empty text alone", () => {
    expect(rtlText("")).toBe("");
  });
});
