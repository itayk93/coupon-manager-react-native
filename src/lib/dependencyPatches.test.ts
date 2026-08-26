import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const metroRoot = dirname(require.resolve("metro/package.json"));
const imageSizeRoot = join(metroRoot, "node_modules/image-size/dist/types");
const { ICNS } = require(join(imageSizeRoot, "icns.js"));
const { JXL } = require(join(imageSizeRoot, "jxl.js"));
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

  it("advances past a zero-length JXL partial-codestream box", () => {
    // A jxlp box declaring size 0: the unpatched loop never moves its offset
    // past it, so this call spins forever instead of returning. The timeout is
    // the assertion — reaching the expect() at all is the pass.
    const input = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, // box size 0
      0x6a, 0x78, 0x6c, 0x70, // jxlp
    ]);

    expect(() => JXL.calculate(input)).toThrow();
  }, 2000);
});
