import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { allEmailLinks } from "../../supabase/functions/_shared/appLinks";

/**
 * The bug these tests exist for: the expiry email's button pointed at the site
 * root, the app claims no path there, and iOS quietly opened Safari instead of
 * the installed app. Nothing failed — not the build, not the send, not a log
 * line. The only signal was a person tapping the button and getting a website.
 *
 * So the claim files are checked against the links the emails actually build,
 * on every test run, offline. A link nobody claims is now a red test.
 *
 * These do not touch the network. `npm run check:links` is the companion that
 * checks the deployed site.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const appJson = JSON.parse(readFileSync(join(repoRoot, "app.json"), "utf8"));
const aasa = JSON.parse(
  readFileSync(join(repoRoot, "public/.well-known/apple-app-site-association"), "utf8")
);

const BASE = "https://coupons.itaykarkason.com";

const iosDetail = aasa.applinks.details[0];
const androidFilter = appJson.expo.android.intentFilters[0];
const androidPrefixes: string[] = androidFilter.data.map((d: any) => d.pathPrefix);

/**
 * Apple matches a `components` entry against the path as a glob: `*` stands for
 * any run of characters, `?` for exactly one. An entry with no wildcard is an
 * exact match, which is why `/coupons/*` never covered `/coupons`.
 */
function iosClaims(pathname: string, search: string): boolean {
  return iosDetail.components.some((component: Record<string, string>) => {
    const pattern = component["/"];
    if (pattern === undefined) return false;
    const [pathPattern, queryPattern] = pattern.split("?");
    const toRegExp = (glob: string) =>
      new RegExp(
        `^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`
      );
    if (!toRegExp(pathPattern).test(pathname)) return false;
    if (queryPattern === undefined) return search === "";
    return toRegExp(queryPattern).test(search.replace(/^\?/, ""));
  });
}

function androidClaims(pathname: string): boolean {
  return androidPrefixes.some((prefix) => pathname.startsWith(prefix));
}

describe("app link claim files", () => {
  it("uses the same host everywhere", () => {
    const host = new URL(BASE).host;
    expect(appJson.expo.ios.associatedDomains).toContain(`applinks:${host}`);
    for (const entry of androidFilter.data) {
      expect(entry.host).toBe(host);
      expect(entry.scheme).toBe("https");
    }
  });

  it("claims the app that is actually shipped", () => {
    expect(iosDetail.appIDs.join()).toContain(appJson.expo.android.package);
    expect(iosDetail.appIDs[0]).toMatch(/^[A-Z0-9]{10}\./);
  });

  it("verifies Android app links automatically", () => {
    // Without autoVerify the user is prompted with a chooser instead of the
    // link opening the app, which reads to them as "the link is broken".
    expect(androidFilter.autoVerify).toBe(true);
  });
});

describe("every link an email builds is claimed by both platforms", () => {
  const links = allEmailLinks(BASE);

  for (const [name, href] of Object.entries(links)) {
    it(`${name} — ${new URL(href).pathname}`, () => {
      const url = new URL(href);
      expect(url.origin).toBe(BASE);
      // The failure this catches: a link at the site root, or at a path the
      // claim files were never told about.
      expect(
        iosClaims(url.pathname, url.search),
        `iOS does not claim ${url.pathname}${url.search} — the tap opens Safari`
      ).toBe(true);
      expect(
        androidClaims(url.pathname),
        `Android does not claim ${url.pathname} — the tap opens Chrome`
      ).toBe(true);
    });
  }

  it("never links to the bare site root", () => {
    for (const href of Object.values(links)) {
      expect(new URL(href).pathname).not.toBe("/");
    }
  });
});

describe("the two platforms claim the same set of paths", () => {
  // They drifted once already: iOS had /coupons/* while Android had the prefix
  // /coupons/, and neither covered /coupons.
  const samples = [
    "/coupons",
    "/coupons/42",
    "/notifications",
    "/notification-settings",
    "/unsubscribe",
  ];

  for (const path of samples) {
    it(`${path} is claimed on iOS and Android alike`, () => {
      expect(iosClaims(path, "")).toBe(androidClaims(path));
    });
  }

  it("neither platform claims the site root", () => {
    // Claiming "/" would send every marketing page and the privacy policy into
    // the app, which Apple rejects and users hate.
    expect(iosClaims("/", "")).toBe(false);
    expect(androidClaims("/")).toBe(false);
  });
});
