import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WORDMARK_ASPECT, wordmarkBox } from "./brandMark";

/**
 * A PNG's dimensions live in the IHDR chunk: eight bytes of signature, then a
 * four-byte length and the "IHDR" tag, then width and height as big-endian
 * 32-bit integers.
 */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("wordmarkBox", () => {
  it("matches the artwork the app actually ships", () => {
    const { width, height } = pngSize("assets/branding/kuponi-wordmark/color-horizontal.png");
    expect(width / height).toBe(WORDMARK_ASPECT);
  });

  it("gives a box the artwork fills edge to edge", () => {
    expect(wordmarkBox(280)).toEqual({ width: 280, height: 56 });
    expect(wordmarkBox(180)).toEqual({ width: 180, height: 36 });
  });
});
