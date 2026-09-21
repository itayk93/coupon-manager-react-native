import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { injectWebHead, webHead } from "../../scripts/inject-web-head.mjs";
import head from "./webHead.json";

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

describe("injectWebHead", () => {
  const injected = injectWebHead(TEMPLATE);

  it("gives a reader that runs no JavaScript an icon and a card", () => {
    expect(injected).toContain('<html lang="he">');
    expect(injected).toContain('rel="apple-touch-icon"');
    expect(injected).toContain('rel="manifest"');
    expect(injected).toContain('property="og:image"');
    expect(injected).toContain('name="twitter:card"');
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
