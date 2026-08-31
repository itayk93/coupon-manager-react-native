import { describe, expect, it } from "vitest";
import { shareLinkUrl, shareTokenFromPath } from "./shareLinks";

const TOKEN = "3f2b1a9c-4d5e-4f60-8a1b-2c3d4e5f6a7b";

describe("shareTokenFromPath", () => {
  it("reads a bare token", () => {
    expect(shareTokenFromPath(TOKEN)).toBe(TOKEN);
  });

  it("reads the token out of a universal link, a scheme link and a path", () => {
    expect(shareTokenFromPath(shareLinkUrl(TOKEN))).toBe(TOKEN);
    expect(shareTokenFromPath(`couponmaster://s/${TOKEN}`)).toBe(TOKEN);
    expect(shareTokenFromPath(`/s/${TOKEN}`)).toBe(TOKEN);
  });

  it("ignores a trailing slash and a query string", () => {
    expect(shareTokenFromPath(`/s/${TOKEN}/`)).toBe(TOKEN);
    expect(shareTokenFromPath(`${shareLinkUrl(TOKEN)}?utm=x`)).toBe(TOKEN);
  });

  it("normalises case so the same link is one token", () => {
    expect(shareTokenFromPath(TOKEN.toUpperCase())).toBe(TOKEN);
  });

  it("rejects anything that is not a token", () => {
    for (const bad of ["", "   ", "/s/", "/s/not-a-uuid", "/r/ABC123", null, undefined, 42, {}]) {
      expect(shareTokenFromPath(bad)).toBeNull();
    }
  });

  it("rejects a token with the right shape but stray characters", () => {
    expect(shareTokenFromPath(`${TOKEN}x`)).toBeNull();
    expect(shareTokenFromPath(TOKEN.replace("-", ""))).toBeNull();
  });
});
