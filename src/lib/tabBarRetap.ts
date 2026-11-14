/**
 * Re-tapping the active tab is the platform's quiet convention: native tab
 * bars scroll the visible list back to the top. This app's bar is custom (see
 * BottomNav), so the signal has to be carried by hand from the bar to the
 * screen that owns the scroll view.
 *
 * The bar emits with the tab's root path; a screen subscribes with the path it
 * is mounted under and scrolls itself. Kept in `src/lib` so the contract is
 * unit-testable without rendering either side.
 */

type Handler = () => void;

const listeners = new Map<string, Set<Handler>>();

/** Subscribe to re-taps of the tab rooted at `path`. Returns the unsubscribe. */
export function onTabRetap(path: string, handler: Handler): () => void {
  let set = listeners.get(path);
  if (!set) {
    set = new Set();
    listeners.set(path, set);
  }
  set.add(handler);
  return () => {
    set.delete(handler);
    if (set.size === 0) listeners.delete(path);
  };
}

/** Emit a re-tap of the tab rooted at `path`. */
export function emitTabRetap(path: string): void {
  const set = listeners.get(path);
  if (!set) return;
  // A handler that unsubscribes a sibling mid-emit must not skip it.
  for (const handler of [...set]) handler();
}
