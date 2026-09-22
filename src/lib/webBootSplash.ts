/**
 * The launch screen of the installed web app, and how it ends.
 *
 * Native has two layers here: `expo-splash-screen` holds the window while the
 * bundle loads, and `BrandLaunchAnimation` takes over from it so the app is
 * never briefly visible unauthenticated. The web build has neither — React is
 * the thing being waited for, so it cannot draw the wait. `launchVisible` is
 * `Platform.OS !== "web"` for exactly that reason.
 *
 * So the web launch screen lives in the document instead: iOS draws the
 * `apple-touch-startup-image` that matches the device from the tap until first
 * paint, and `injectBootSplash` puts the same wordmark, tint and 240pt geometry
 * into `dist/index.html` to carry it from there until the app is ready. Every
 * other browser gets the second half alone, which is still the whole wait.
 *
 * This is the end of it. It fades rather than cuts, over the same 220ms the
 * native launch animation exits in.
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
