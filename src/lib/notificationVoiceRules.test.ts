import { describe, expect, it } from "vitest";
import { isUsable } from "../../supabase/functions/_shared/notificationVoiceRules";

/**
 * The generated wording is only safe because of this gate.
 *
 * A model writing the app's notifications can fail in one way that matters: a
 * fluent, friendly sentence that is not true about someone's money. Every case
 * below is that failure wearing a different hat, and each one has to end with
 * the written sentence being used instead.
 */
describe("isUsable", () => {
  const facts = { amount: "869.80 ש״ח", month: 7, year: 2026 };

  it("accepts a line that only uses the numbers it was given", () => {
    expect(isUsable({
      title: "החודש שלך",
      body: "באוגוסט 2026 חסכת 869.80 ש״ח. יפה מאוד.",
    }, facts)).toBe(true);
  });

  it("rejects a number nobody supplied", () => {
    // The dangerous case: rounding reads perfectly and changes the fact.
    expect(isUsable({
      title: "החודש שלך",
      body: "באוגוסט חסכת כמעט 900 ש״ח.",
    }, facts)).toBe(false);
  });

  it("rejects the shekel sign", () => {
    expect(isUsable({
      title: "החודש שלך",
      body: "באוגוסט 2026 חסכת 869.80 ₪.",
    }, facts)).toBe(false);
  });

  it("rejects English connector words that flip Hebrew notifications to LTR", () => {
    expect(isUsable({
      title: "הקופון נוצל עד הסוף",
      body: "קופון מאסטר from Wolt נסגר עם חיסכון של 10.00 ש״ח.",
    }, facts)).toBe(false);
  });

  it("rejects a body that drifted out of Hebrew", () => {
    expect(isUsable({
      title: "Nice month",
      body: "You saved 869.80 this month.",
    }, facts)).toBe(false);
  });

  it("rejects an over-long line", () => {
    expect(isUsable({
      title: "החודש שלך",
      body: `${"ארוך מדי ".repeat(40)}`,
    }, facts)).toBe(false);
  });

  it("rejects anything that is not two strings", () => {
    expect(isUsable({ title: "כותרת" }, facts)).toBe(false);
    expect(isUsable({ title: "", body: "גוף" }, facts)).toBe(false);
    expect(isUsable({ title: 5, body: "גוף" } as any, facts)).toBe(false);
  });

  it("counts numbers inside a list of facts as given", () => {
    // The expiry reminder hands over a line per coupon; the amounts inside
    // those lines are facts too, not inventions.
    const listFacts = { when: "מחר", count: 2, names: ["רולדין (45.00 ש״ח)", "Wolt (30.00 ש״ח)"] };
    expect(isUsable({
      title: "שני קופונים פגים מחר",
      body: "רולדין עם 45.00 ש״ח ו-Wolt עם 30.00 ש״ח. שווה לנצל היום.",
    }, listFacts)).toBe(true);
  });
});
