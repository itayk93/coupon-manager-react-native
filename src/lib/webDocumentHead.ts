import head from "./webHead.json";
import startupImages from "./webHeadStartupImages.json";

/** Open Graph keys on `property`, everything else on `name`. */
type MetaTag = { name?: string; property?: string; content: string };
const META: MetaTag[] = head.meta;

/**
 * The head tags the web build needs, applied at runtime.
 *
 * This looks like it belongs in HTML, and it does — `scripts/inject-web-head.mjs`
 * writes the very same tags into the exported `dist/index.html`, from the same
 * `webHead.json`, because a tag that only exists once JavaScript has run is
 * invisible to everything that reads a page without running it: iOS builds the
 * share sheet and the Add to Home Screen icon that way, and so do WhatsApp,
 * Slack and search engines. Left to runtime alone, iOS found no icon and no
 * preview image and invented one — a single mascot frame tiled across a square.
 *
 * This pass stays for the dev server, which serves Expo's stock template with
 * no build step in front of it, and for any export that skips the injector. It
 * is written to be a no-op when the tag is already in the document, so running
 * both is safe.
 *
 * `app/+html.tsx` used to hold this. That file only takes effect for the
 * `static` and `server` web outputs. This project ships `web.output: "single"`,
 * where Expo builds the page from its own stock template — which is why the
 * deployed site was served as `lang="en"`, left to right, with no Heebo and no
 * manifest link, for as long as the file has existed. A `public/index.html`
 * template is the other supported route, and it works in an export but is
 * served raw by the dev server, with no bundle script — a blank page for anyone
 * running `npm run web`.
 *
 * What each tag buys:
 * - `viewport-fit=cover` makes `env(safe-area-inset-*)` report real numbers.
 *   Without it an installed PWA draws its bottom bar under the home indicator.
 * - the manifest link is what makes the app installable at all: Chrome never
 *   fires `beforeinstallprompt` without it, and iOS opens the home-screen
 *   shortcut in a browser tab rather than standalone.
 * - `apple-touch-icon` is the icon iOS puts on the home screen and in the share
 *   sheet; the Open Graph pair is the card every messenger draws.
 * - `apple-touch-startup-image` is the launch screen of the installed app, one
 *   per device size, and the only launch screen iOS will draw: it ignores the
 *   manifest's `background_color`, so a device that matches none of them opens
 *   a white page and sits on it until the bundle has booted. The images are
 *   the native splash redrawn, from `scripts/build-pwa-splash.py`.
 * - Heebo, because the web styles ask for the plain family name while the
 *   native builds register `Heebo_400Regular` through expo-font.
 */

export function applyWebDocumentHead(doc: Document = document): void {
  // `lang`, but deliberately not `dir`. Every row in this app is already laid
  // out right-to-left by hand, with `flexDirection: "row-reverse"`. Setting
  // `dir="rtl"` on the document flips those a second time and the whole UI
  // comes out mirrored — the tab bar starts on the left, the wallet pill moves
  // to the wrong corner. `lang` alone is what screen readers and search
  // engines need.
  doc.documentElement.lang = head.lang;

  const viewport =
    doc.querySelector<HTMLMetaElement>('meta[name="viewport"]') ??
    doc.head.appendChild(Object.assign(doc.createElement("meta"), { name: "viewport" }));
  viewport.setAttribute("content", head.viewport);

  for (const tag of META) {
    // Whichever key a tag carries is also what makes it unique.
    const key = tag.property === undefined ? "name" : "property";
    const value = tag.property ?? tag.name;
    if (!value || doc.querySelector(`meta[${key}="${value}"]`)) continue;
    const meta = doc.createElement("meta");
    meta.setAttribute(key, value);
    meta.setAttribute("content", tag.content);
    doc.head.appendChild(meta);
  }

  for (const attributes of [...head.links, ...startupImages]) {
    // `rel` alone is not the identity: two links can share it. Match on the
    // pair so a second call is a no-op rather than a duplicate.
    if (doc.querySelector(`link[rel="${attributes.rel}"][href="${attributes.href}"]`)) continue;
    const link = doc.createElement("link");
    for (const [key, value] of Object.entries(attributes)) link.setAttribute(key, value);
    doc.head.appendChild(link);
  }
}
