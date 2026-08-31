/**
 * The head tags the web build needs, applied at runtime.
 *
 * This looks like it belongs in HTML, and it did: `app/+html.tsx` used to hold
 * it. That file only takes effect for the `static` and `server` web outputs.
 * This project ships `web.output: "single"`, where Expo builds the page from
 * its own stock template — which is why the deployed site was served as
 * `lang="en"`, left to right, with no Heebo and no manifest link, for as long
 * as the file has existed.
 *
 * A `public/index.html` template is the other supported route, and it works in
 * an export but is served raw by the dev server, with no bundle script — a
 * blank page for anyone running `npm run web`. Doing it here is what works in
 * both, and it runs before the first screen paints.
 *
 * What each tag buys:
 * - `viewport-fit=cover` makes `env(safe-area-inset-*)` report real numbers.
 *   Without it an installed PWA draws its bottom bar under the home indicator.
 * - the manifest link is what makes the app installable at all: Chrome never
 *   fires `beforeinstallprompt` without it, and iOS opens the home-screen
 *   shortcut in a browser tab rather than standalone.
 * - Heebo, because the web styles ask for the plain family name while the
 *   native builds register `Heebo_400Regular` through expo-font.
 */

const VIEWPORT =
  "width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover";

const META: Array<[string, string]> = [
  ["theme-color", "#6366F1"],
  ["apple-mobile-web-app-capable", "yes"],
  ["apple-mobile-web-app-status-bar-style", "default"],
  ["apple-mobile-web-app-title", "קופון מאסטר"],
  ["mobile-web-app-capable", "yes"],
];

const LINKS: Array<Record<string, string>> = [
  { rel: "manifest", href: "/manifest.json" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&display=swap",
  },
];

export function applyWebDocumentHead(doc: Document = document): void {
  // `lang`, but deliberately not `dir`. Every row in this app is already laid
  // out right-to-left by hand, with `flexDirection: "row-reverse"`. Setting
  // `dir="rtl"` on the document flips those a second time and the whole UI
  // comes out mirrored — the tab bar starts on the left, the wallet pill moves
  // to the wrong corner. `lang` alone is what screen readers and search
  // engines need.
  doc.documentElement.lang = "he";

  const viewport =
    doc.querySelector<HTMLMetaElement>('meta[name="viewport"]') ??
    doc.head.appendChild(Object.assign(doc.createElement("meta"), { name: "viewport" }));
  viewport.setAttribute("content", VIEWPORT);

  for (const [name, content] of META) {
    if (doc.querySelector(`meta[name="${name}"]`)) continue;
    const meta = doc.createElement("meta");
    meta.setAttribute("name", name);
    meta.setAttribute("content", content);
    doc.head.appendChild(meta);
  }

  for (const attributes of LINKS) {
    // `rel` alone is not the identity: two links can share it. Match on the
    // pair so a second call is a no-op rather than a duplicate.
    if (doc.querySelector(`link[rel="${attributes.rel}"][href="${attributes.href}"]`)) continue;
    const link = doc.createElement("link");
    for (const [key, value] of Object.entries(attributes)) link.setAttribute(key, value);
    doc.head.appendChild(link);
  }
}
