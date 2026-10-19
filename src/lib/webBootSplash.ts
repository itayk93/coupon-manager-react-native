/**
 * The launch screen of the installed web app, and how it ends.
 *
 * The document splash covers bundle loading. Once fonts settle, the React
 * launch overlay takes over and plays the silent video once on web and native.
 * Reduced motion uses a static wordmark instead. Both wait for auth readiness
 * before revealing navigation.
 *
 * The document layer fades over the same 220ms as the React launch overlay.
 */

/** Idempotent, and a no-op anywhere the document has no launch screen in it —
 *  native, and the dev server, which serves Expo's stock template unbuilt. */
export function hideWebBootSplash(doc?: Document): void {
  const target = doc ?? (typeof document === "undefined" ? null : document);
  const splash = target?.getElementById("boot-splash");
  if (!splash) return;

  splash.classList.add("boot-splash--done");
  const remove = () => splash.remove();
  splash.addEventListener("transitionend", remove, { once: true });
  // A backgrounded tab runs no transitions, so `transitionend` alone can leave
  // the node in the tree for as long as the app stays out of sight.
  setTimeout(remove, 600);
}

/**
 * The page's own background, once the launch screen is out of the way.
 *
 * It starts as the brand tint, which is what the launch is drawn on, and the
 * app's surface is a warm neutral — so the tint would otherwise stay behind
 * the app for the rest of the session, showing through wherever the app does
 * not paint. Called with the live theme, so dark mode gets its own.
 */
export function paintWebBackground(color: string, doc?: Document): void {
  const target = doc ?? (typeof document === "undefined" ? null : document);
  if (!target) return;
  target.documentElement.style.backgroundColor = color;
  if (target.body) target.body.style.backgroundColor = color;
}
