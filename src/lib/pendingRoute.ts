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
let pending: string | null = null;

/** Routes that would loop or make no sense to return to. */
function isReturnable(path: string): boolean {
  return Boolean(path) && path !== "/" && !path.startsWith("/(auth)") && path !== "/login";
}

export function rememberPendingRoute(path: string): void {
  if (isReturnable(path)) pending = path;
}

/** Reads and clears in one step, so a route is never replayed twice. */
export function takePendingRoute(): string | null {
  const value = pending;
  pending = null;
  return value;
}
