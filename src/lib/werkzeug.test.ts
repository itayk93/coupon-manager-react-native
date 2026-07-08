import { describe, expect, it } from "vitest";

import { checkWerkzeugPasswordHash } from "./werkzeug";

describe("checkWerkzeugPasswordHash", () => {
  it("matches Werkzeug pbkdf2 password hashes", async () => {
    await expect(
      checkWerkzeugPasswordHash(
        "pbkdf2:sha256:1000$hwfmsNPi$c6b9990a370048bf4b7e1d9cb19c86a064dbd9d0d73f3e24638ef729d5ba4669",
        "Secret123!"
      )
    ).resolves.toBe(true);
  });

  it("matches Werkzeug scrypt password hashes", async () => {
    await expect(
      checkWerkzeugPasswordHash(
        "scrypt:32768:8:1$y83YaUVu$c1f03eea3529e25b0934a6b68511182ccfb9ee0a0c2ce10832fb08f8f525562ff330a78db05bf4a622632f34da9e287f70821961c6557d10d428a38cb7edd220",
        "Secret123!"
      )
    ).resolves.toBe(true);
  });

  it("rejects wrong passwords", async () => {
    await expect(
      checkWerkzeugPasswordHash(
        "pbkdf2:sha256:1000$hwfmsNPi$c6b9990a370048bf4b7e1d9cb19c86a064dbd9d0d73f3e24638ef729d5ba4669",
        "wrong"
      )
    ).resolves.toBe(false);
  });

  it("rejects malformed hashes", async () => {
    await expect(checkWerkzeugPasswordHash("not-a-werkzeug-hash", "Secret123!")).resolves.toBe(false);
    await expect(checkWerkzeugPasswordHash("pbkdf2:sha1:1000$salt$abcdef", "Secret123!")).resolves.toBe(false);
    await expect(checkWerkzeugPasswordHash("pbkdf2:sha256:0$salt$abcdef", "Secret123!")).resolves.toBe(false);
    await expect(checkWerkzeugPasswordHash("pbkdf2:sha256:1000$salt$not-hex", "Secret123!")).resolves.toBe(false);
  });
});
