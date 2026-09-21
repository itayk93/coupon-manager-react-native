import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { injectBootSplash, injectWebHead, webHead } from "../../scripts/inject-web-head.mjs";
import head from "./webHead.json";
import startupImages from "./webHeadStartupImages.json";

/**
 * The web build ships `web.output: "single"`, so Expo serves its own stock
 * template and the app adds its head tags once the bundle boots. Everything
 * that reads a page without running JavaScript sees only the template: iOS
 * builds the share sheet and the Add to Home Screen icon from that fetch, and
 * so do WhatsApp, Slack and search engines. With no icon and no preview image
 * to find, iOS invented one — a mascot frame tiled across a square.
 *
 * So the tags have to be in the served HTML, which `inject-web-head.mjs` does
 * at build time from this same file. These assertions hold that arrangement
 * together, and check the thing a reader cannot: that every URL named here is
 * actually a file the site serves.
 */

/** Expo's stock template, as the deployed site serves it. */
const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <title>קופון מאסטר</title>
  </head>
  <body><div id="root"></div></body>
</html>
`;

/** A served URL, back to the file in `public/` that answers it. */
function publicFile(url: string): string | null {
  const path = url.startsWith(head.origin) ? url.slice(head.origin.length) : url;
  if (!path.startsWith("/")) return null; // Off-site: fonts, and nothing else.
  return `public${path.split("?")[0]}`;
}

describe("webHead.json", () => {
  it("is the one source both passes read", () => {
    expect(webHead).toEqual(head);
  });

  it("names only files the site actually serves", () => {
    const urls = [
      ...head.links.map((link) => link.href),
      ...startupImages.map((link) => link.href),
      ...(head.meta as Array<{ name?: string; property?: string; content: string }>)
        .filter((tag) => /image/.test(tag.property ?? tag.name ?? ""))
        .map((tag) => tag.content),
    ];
    const local = urls.map(publicFile).filter((path): path is string => path !== null);
    // Guards the failure that has no symptom in the repo: a head pointing at an
    // icon nothing serves, which leaves the reader to invent its own.
    expect(local.length).toBeGreaterThan(3);
    expect(local.filter((path) => !existsSync(path))).toEqual([]);
  });

  it("declares the preview image at the size it really is", () => {
    const image = head.meta.find((tag) => "property" in tag && tag.property === "og:image");
    const width = head.meta.find((tag) => "property" in tag && tag.property === "og:image:width");
    const height = head.meta.find((tag) => "property" in tag && tag.property === "og:image:height");
    const bytes = readFileSync(publicFile(image!.content)!);
    expect({ width: String(bytes.readUInt32BE(16)), height: String(bytes.readUInt32BE(20)) }).toEqual({
      width: width!.content,
      height: height!.content,
    });
  });
});

/** The `(device-width: 430px) ... (-webkit-device-pixel-ratio: 3)` a link carries. */
function deviceOf(media: string) {
  const read = (name: string) => Number(new RegExp(`${name}:\\s*(\\d+)`).exec(media)?.[1]);
  return {
    width: read("device-width"),
    height: read("device-height"),
    scale: read("-webkit-device-pixel-ratio"),
    orientation: /orientation:\s*(\w+)/.exec(media)?.[1],
  };
}

/**
 * iOS draws no launch screen of its own: it ignores the manifest's
 * `background_color`, and a device whose size matches none of these links opens
 * the installed app on a white page and holds it there until the bundle has
 * booted. `scripts/build-pwa-splash.py` writes both the images and this list.
 */
describe("webHeadStartupImages.json", () => {
  it("covers both orientations of every device size", () => {
    const byDevice = new Map<string, Set<string | undefined>>();
    for (const link of startupImages) {
      const { width, height, scale, orientation } = deviceOf(link.media);
      const key = `${width}x${height}@${scale}`;
      byDevice.set(key, (byDevice.get(key) ?? new Set()).add(orientation));
    }
    expect(byDevice.size).toBeGreaterThan(15);
    expect([...byDevice].filter(([, seen]) => seen.size !== 2)).toEqual([]);
  });

  it("gives each device an image at exactly its own pixel size", () => {
    // iOS matches on the media query but draws the file: an image that is not
    // the size the query claims is stretched across the screen, which is the
    // launch screen looking wrong on the one device nobody tested on.
    const wrong = startupImages.filter((link) => {
      const { width, height, scale, orientation } = deviceOf(link.media);
      const bytes = readFileSync(publicFile(link.href)!);
      const expected =
        orientation === "portrait" ? [width * scale, height * scale] : [height * scale, width * scale];
      return bytes.readUInt32BE(16) !== expected[0] || bytes.readUInt32BE(20) !== expected[1];
    });
    expect(wrong.map((link) => link.href)).toEqual([]);
  });
});

describe("injectWebHead", () => {
  const injected = injectWebHead(TEMPLATE);

  it("gives a reader that runs no JavaScript an icon and a card", () => {
    expect(injected).toContain('<html lang="he">');
    expect(injected).toContain('rel="apple-touch-icon"');
    expect(injected).toContain('rel="manifest"');
    expect(injected).toContain('property="og:image"');
    expect(injected).toContain('name="twitter:card"');
  });

  it("gives the installed app a launch screen on every iPhone and iPad", () => {
    for (const link of startupImages) {
      expect(injected).toContain(`media="${link.media}"`);
      expect(injected).toContain(`href="${link.href}"`);
    }
  });

  it("carries every tag the runtime pass would add", () => {
    for (const tag of head.meta as Array<{ name?: string; property?: string }>) {
      const key = tag.property === undefined ? "name" : "property";
      expect(injected).toContain(`${key}="${tag.property ?? tag.name}"`);
    }
    for (const link of head.links) expect(injected).toContain(`href="${link.href.replace(/&/g, "&amp;")}"`);
  });

  it("replaces the template's own lang and viewport rather than doubling them", () => {
    expect(injected).not.toContain('lang="en"');
    expect(injected.match(/name="viewport"/g)).toHaveLength(1);
    expect(injected).toContain("viewport-fit=cover");
  });

  it("changes nothing on a second run", () => {
    expect(injectWebHead(injected)).toBe(injected);
  });
});

/**
 * The launch screen ends where the bundle begins. iOS shows its launch image
 * until the page's first paint, and Expo's page is an empty white root until
 * React mounts — so the branded launch would end in a white screen, which is
 * most of the wait on a cold start. `hideWebBootSplash` takes this down.
 */
describe("injectBootSplash", () => {
  const injected = injectBootSplash(TEMPLATE);

  it("paints the same wordmark on the same tint the launch image ends on", () => {
    expect(injected).toContain('id="boot-splash"');
    expect(injected).toContain("#e8f2fd");
    expect(existsSync(publicFile("/splash/wordmark.png")!)).toBe(true);
    expect(injected).toContain('src="/splash/wordmark.png"');
  });

  it("puts the style in the head and the screen in the body", () => {
    expect(injected.indexOf('id="boot-splash-style"')).toBeLessThan(injected.indexOf("</head>"));
    expect(injected.indexOf('id="boot-splash"')).toBeGreaterThan(injected.indexOf("<body"));
    expect(injected.indexOf('id="boot-splash"')).toBeLessThan(injected.indexOf("</body>"));
  });

  it("cannot leave the screen covered if the bundle never arrives", () => {
    expect(injected).toContain("boot-splash--done");
  });

  it("changes nothing on a second run", () => {
    expect(injectBootSplash(injected)).toBe(injected);
  });
});
