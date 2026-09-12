/**
 * Deploy detection for the installed PWA.
 *
 * The native builds have `expo-updates`; the web build had nothing. An
 * installed PWA — on iOS especially — keeps running the bundle it loaded the
 * first time and does not go back to the network on its own, so a deploy
 * reached new visitors and never reached the people who installed the app.
 * The service worker cannot help: it is notification-only on purpose (see
 * `public/sw.js`) and caches nothing.
 *
 * The signal is already in the page. Expo's single-page web export writes one
 * script tag into `index.html`, and its filename carries a content hash:
 *
 *     <script src="/_expo/static/js/web/entry-ebc76c58….js" defer></script>
 *
 * Fetching `index.html` past the cache and comparing that filename against the
 * one the running page booted from tells us whether a newer deploy is live —
 * with no build id to stamp, no version file to keep in step, and no work at
 * deploy time.
 *
 * Everything here is pure so the decisions can be tested; the effects live in
 * `useWebAppUpdate`.
 */

/** Path of the bundle script, as it appears in the export's HTML. */
const BUNDLE_PATTERN = /\/_expo\/static\/js\/web\/[A-Za-z0-9._-]+\.js/;

/** How often a foregrounded app re-checks. */
export const UPDATE_POLL_MS = 15 * 60 * 1000;

/**
 * How long to wait before trying the same update again.
 *
 * A reload is not a promise: the CDN edge, or iOS's own document cache, can
 * hand back the old HTML for a while after the new one is live. Without this
 * the page would reload, boot the old bundle, see the same "newer" bundle on
 * the network and reload again, forever.
 */
export const RELOAD_GUARD_MS = 10 * 60 * 1000;

export const RELOAD_MEMORY_KEY = "coupon_master_web_update";

/** Routes where a reload would throw away something the user typed. */
const UNSAFE_PATH_PREFIXES = [
  "/coupons/add",
  "/coupons/edit",
  "/coupons/bulk-import",
  "/scanner",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/onboarding",
  "/invite",
];

export type ReloadMemory = { target: string; at: number };

export function parseBundlePath(html: string): string | null {
  return html.match(BUNDLE_PATTERN)?.[0] ?? null;
}

/** The bundle the page in front of the user is actually running. */
export function runningBundlePath(doc: Document): string | null {
  const script = doc.querySelector<HTMLScriptElement>('script[src*="/_expo/static/js/web/"]');
  // Absolute or relative, only the hashed path is compared.
  return script ? parseBundlePath(script.getAttribute("src") || "") : null;
}

export function isStale(running: string | null, latest: string | null): boolean {
  return Boolean(running && latest && running !== latest);
}

export function shouldReload(
  latest: string,
  memory: ReloadMemory | null,
  now: number
): boolean {
  if (!memory || memory.target !== latest) return true;
  return now - memory.at > RELOAD_GUARD_MS;
}

export function parseReloadMemory(raw: string | null): ReloadMemory | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ReloadMemory>;
    if (typeof parsed?.target !== "string" || typeof parsed?.at !== "number") return null;
    return { target: parsed.target, at: parsed.at };
  } catch {
    return null;
  }
}

/**
 * Whether the moment is right to pull the rug out from under the page.
 *
 * Nothing on the home screen or the coupon list is lost by a reload. A
 * half-filled coupon form or a password field is, and an update that eats
 * someone's typing is worse than an update that waits for the next check.
 */
export function isSafeToReload(pathname: string, activeElementTag?: string | null): boolean {
  const tag = (activeElementTag || "").toLowerCase();
  if (tag === "input" || tag === "textarea") return false;
  return !UNSAFE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
