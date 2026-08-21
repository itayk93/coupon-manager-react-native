import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const metroRoot = dirname(require.resolve("metro/package.json"));
const imageSizeRoot = join(metroRoot, "node_modules/image-size/dist/types");
const { ICNS } = require(join(imageSizeRoot, "icns.js"));
const { findBox } = require(join(imageSizeRoot, "utils.js"));

describe("image-size denial-of-service patches", () => {
  it("rejects a zero-length ICNS entry", () => {
    const input = new Uint8Array([
      0x69, 0x63, 0x6e, 0x73, // icns
      0x00, 0x00, 0x00, 0x10, // file length
      0x69, 0x63, 0x30, 0x37, // ic07
      0x00, 0x00, 0x00, 0x00, // invalid entry length
    ]);

    expect(() => ICNS.calculate(input)).toThrow("Invalid ICNS image entry length");
  });

  it("advances past a zero-length ISO box", () => {
    const input = new Uint8Array([
      0x00, 0x00, 0x00, 0x00,
      0x66, 0x72, 0x65, 0x65, // free
    ]);

    expect(findBox(input, "meta", 0)).toBeUndefined();
  });
});
