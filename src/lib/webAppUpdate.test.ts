import { describe, expect, it } from "vitest";
import {
  RELOAD_GUARD_MS,
  isSafeToReload,
  isStale,
  parseBundlePath,
  parseReloadMemory,
  shouldReload,
} from "./webAppUpdate";

/** Trimmed to the parts that matter, otherwise verbatim from `expo export`. */
const EXPORTED_HTML = `<!DOCTYPE html>
<html lang="en"><head><title>קופון מאסטר</title></head>
<body><div id="root"></div>
<script src="/_expo/static/js/web/entry-ebc76c58ef5e3bedbac6ffb469137e83.js" defer></script>
</body></html>`;

const BUNDLE = "/_expo/static/js/web/entry-ebc76c58ef5e3bedbac6ffb469137e83.js";
const NEXT_BUNDLE = "/_expo/static/js/web/entry-fb9df1289c61f098b639f1c0c100e24f.js";

describe("parseBundlePath", () => {
  it("finds the hashed bundle in the shell the export writes", () => {
    expect(parseBundlePath(EXPORTED_HTML)).toBe(BUNDLE);
  });

  it("keeps only the path when the tag carries a full URL", () => {
    expect(parseBundlePath(`<script src="https://app.example.com${BUNDLE}">`)).toBe(BUNDLE);
  });

  it("returns null for a page without one — the dev server, or an error page", () => {
    expect(parseBundlePath("<html><body>502</body></html>")).toBeNull();
    expect(parseBundlePath("")).toBeNull();
  });
});

describe("isStale", () => {
  it("is stale only when both sides are known and differ", () => {
    expect(isStale(BUNDLE, NEXT_BUNDLE)).toBe(true);
    expect(isStale(BUNDLE, BUNDLE)).toBe(false);
    expect(isStale(null, NEXT_BUNDLE)).toBe(false);
    expect(isStale(BUNDLE, null)).toBe(false);
  });
});

describe("shouldReload", () => {
  const now = 1_700_000_000_000;

  it("reloads when it has not tried this update yet", () => {
    expect(shouldReload(NEXT_BUNDLE, null, now)).toBe(true);
    expect(shouldReload(NEXT_BUNDLE, { target: BUNDLE, at: now - 1000 }, now)).toBe(true);
  });

  it("does not loop when the reload came back on the old bundle", () => {
    expect(shouldReload(NEXT_BUNDLE, { target: NEXT_BUNDLE, at: now - 1000 }, now)).toBe(false);
  });

  it("tries the same update again once the guard has passed", () => {
    const at = now - RELOAD_GUARD_MS - 1;
    expect(shouldReload(NEXT_BUNDLE, { target: NEXT_BUNDLE, at }, now)).toBe(true);
  });
});

describe("parseReloadMemory", () => {
  it("reads back what the hook stored", () => {
    expect(parseReloadMemory(JSON.stringify({ target: BUNDLE, at: 5 }))).toEqual({
      target: BUNDLE,
      at: 5,
    });
  });

  it("treats missing or corrupt storage as no attempt", () => {
    expect(parseReloadMemory(null)).toBeNull();
    expect(parseReloadMemory("{")).toBeNull();
    expect(parseReloadMemory(JSON.stringify({ target: 7, at: "x" }))).toBeNull();
  });
});

describe("isSafeToReload", () => {
  it("reloads freely on the screens that hold no typing", () => {
    expect(isSafeToReload("/")).toBe(true);
    expect(isSafeToReload("/coupons")).toBe(true);
    expect(isSafeToReload("/coupons/cpn_0123456789abcdef0123")).toBe(true);
    expect(isSafeToReload("/statistics", "DIV")).toBe(true);
  });

  it("never reloads out from under a field being typed into", () => {
    expect(isSafeToReload("/coupons", "INPUT")).toBe(false);
    expect(isSafeToReload("/coupons", "textarea")).toBe(false);
  });

  it("leaves the forms alone", () => {
    for (const path of [
      "/coupons/add",
      "/coupons/edit",
      "/coupons/bulk-import",
      "/scanner",
      "/login",
      "/register",
      "/reset-password",
      "/onboarding",
    ]) {
      expect(isSafeToReload(path)).toBe(false);
    }
  });
});
