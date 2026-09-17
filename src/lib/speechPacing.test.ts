import { describe, expect, it } from "vitest";
import {
  MAX_SPEECH_MS,
  MIN_SPEECH_MS,
  SPEECH_CPS,
  speechDuration,
  spokenSoFar,
} from "./speechPacing";

const LINE = "55.00 ₪ על הכף ב-2 קופונים";

describe("speechDuration", () => {
  it("reads a line at the speaking rate", () => {
    const text = "א".repeat(SPEECH_CPS * 2);
    expect(speechDuration(text)).toBe(2000);
  });

  it("never flashes a short line past the eye", () => {
    expect(speechDuration("שלום")).toBe(MIN_SPEECH_MS);
    expect(speechDuration("")).toBe(MIN_SPEECH_MS);
  });

  it("never holds him in the talking loop indefinitely", () => {
    expect(speechDuration("א".repeat(500))).toBe(MAX_SPEECH_MS);
  });

  it("ignores padding around the line", () => {
    expect(speechDuration(`  ${LINE}  `)).toBe(speechDuration(LINE));
  });
});

describe("spokenSoFar", () => {
  it("opens with a word rather than an empty bubble", () => {
    expect(spokenSoFar(LINE, 0)).toBe("55.00");
    expect(spokenSoFar(LINE, -1)).toBe("55.00");
  });

  it("ends on the whole line", () => {
    expect(spokenSoFar(LINE, 1)).toBe(LINE);
    expect(spokenSoFar(LINE, 2)).toBe(LINE);
  });

  it("only ever shows whole words, so bidi text cannot reorder mid-reveal", () => {
    for (let step = 0; step <= 20; step++) {
      const shown = spokenSoFar(LINE, step / 20);
      expect(LINE.startsWith(shown)).toBe(true);
      expect(LINE[shown.length] ?? " ").toBe(" ");
    }
  });

  it("never goes backwards as the line is said", () => {
    let previous = "";
    for (let step = 0; step <= 20; step++) {
      const shown = spokenSoFar(LINE, step / 20);
      expect(shown.length).toBeGreaterThanOrEqual(previous.length);
      previous = shown;
    }
  });

  it("weights a word by how long it takes to say", () => {
    const text = "א בבבבבבבבבב ג";
    // Halfway through the characters, the long middle word is still arriving.
    expect(spokenSoFar(text, 0.5)).toBe("א");
    expect(spokenSoFar(text, 0.9)).toBe("א בבבבבבבבבב");
  });

  it("says a one-word line in one go", () => {
    expect(spokenSoFar("שלום", 0)).toBe("שלום");
  });
});
