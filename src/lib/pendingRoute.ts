/**
 * The route a signed-out visitor was aiming for when the auth guard sent them
 * to the login screen.
 *
 * Module scope rather than a query parameter: every way into the app — the
 * password form, Google, Apple, the legacy path — ends at the same guard, and
 * one variable is honoured by all of them without threading a `next=` through
 * each. Deep links from email are the reason this exists: landing on the home
 * screen after logging in loses whatever the link was for.
 */
const STORAGE_KEY = "coupon-master.pending-route";
let pending: string | null = null;

function webStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Routes that would loop or make no sense to return to. */
function isReturnable(path: string): boolean {
  return Boolean(path) && path !== "/" && !path.startsWith("/(auth)") && path !== "/login";
}

export function rememberPendingRoute(path: string): void {
  if (!isReturnable(path)) return;
  pending = path;
  webStorage()?.setItem(STORAGE_KEY, path);
}

/** Reads and clears in one step, so a route is never replayed twice. */
export function takePendingRoute(): string | null {
  const storage = webStorage();
  const value = pending ?? storage?.getItem(STORAGE_KEY) ?? null;
  pending = null;
  storage?.removeItem(STORAGE_KEY);
  return value;
}
