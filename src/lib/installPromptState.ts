/**
 * Whether the install invitation has already been shown and waved away.
 *
 * `localStorage` and not the app's own storage on purpose: this only ever runs
 * in a mobile browser, it is per-browser by nature, and it holds a single
 * timestamp. Nothing here identifies anyone.
 *
 * Dismissal is a snooze, not a refusal. Someone who is browsing on the train
 * and closes the sheet may well install a week later, and asking again then is
 * the whole point. Choosing the app is a permanent answer, so that one sticks.
 */

const SNOOZE_KEY = "pwa_install:snoozed_at";
const INSTALLED_KEY = "pwa_install:installed";

/** Long enough not to nag, short enough that a casual visitor is asked twice. */
export const INSTALL_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function storage(): Store | null {
  try {
    // Private mode and locked-down browsers throw on access, not on use.
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function isInstallPromptSnoozed(now = Date.now(), store: Store | null = storage()): boolean {
  if (!store) return false;
  try {
    if (store.getItem(INSTALLED_KEY)) return true;
    const raw = store.getItem(SNOOZE_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    // A clock that moved backwards should not extend the snooze forever.
    if (at > now) return true;
    return now - at < INSTALL_SNOOZE_MS;
  } catch {
    return false;
  }
}

export function snoozeInstallPrompt(now = Date.now(), store: Store | null = storage()): void {
  try {
    store?.setItem(SNOOZE_KEY, String(now));
  } catch {
    // A browser that refuses to remember will ask again. That is acceptable.
  }
}

export function markInstalled(store: Store | null = storage()): void {
  try {
    store?.setItem(INSTALLED_KEY, "1");
  } catch {
    // Same: worst case the sheet reappears once.
  }
}
