import { useEffect } from "react";
import { Platform } from "react-native";
import {
  RELOAD_MEMORY_KEY,
  UPDATE_POLL_MS,
  isSafeToReload,
  isStale,
  parseBundlePath,
  parseReloadMemory,
  runningBundlePath,
  shouldReload,
} from "@/lib/webAppUpdate";

/**
 * Keeps the installed PWA on the current deploy.
 *
 * Checks on launch, whenever the app comes back to the foreground — the moment
 * an installed PWA is most likely to be running yesterday's bundle — and every
 * `UPDATE_POLL_MS` while it stays open. A no-op on native, where `expo-updates`
 * owns this.
 *
 * The reload is silent by design: there is no "a new version is available"
 * prompt to tap, because the only useful answer is yes and the screens where
 * the answer might be "not now" are skipped by `isSafeToReload`.
 */
export function useWebAppUpdate(): void {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const running = runningBundlePath(document);
    // The dev server serves an unhashed bundle, so there is nothing to compare
    // and nothing to do.
    if (!running) return;

    let cancelled = false;

    const check = async (immediate: boolean) => {
      if (cancelled) return;
      try {
        // `no-store` is the whole point of the request: the browser's copy of
        // this file is exactly what we are trying to see past.
        const response = await fetch("/index.html", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const latest = parseBundlePath(await response.text());
        if (cancelled || !latest || !isStale(running, latest)) return;

        // On launch nothing has been typed yet, so only the later checks have
        // to care which screen is open.
        if (!immediate && !isSafeToReload(
          window.location.pathname,
          document.activeElement?.tagName
        )) return;

        let memory = null;
        try {
          memory = parseReloadMemory(window.sessionStorage.getItem(RELOAD_MEMORY_KEY));
        } catch {
          // Private mode, or storage denied: treat it as a first attempt.
        }
        if (!shouldReload(latest, memory, Date.now())) return;

        try {
          window.sessionStorage.setItem(
            RELOAD_MEMORY_KEY,
            JSON.stringify({ target: latest, at: Date.now() })
          );
        } catch {
          // Without the memory a stuck edge could reload us twice. Still worth
          // the update.
        }
        window.location.reload();
      } catch {
        // Offline, or the request failed: the next check can try again.
      }
    };

    void check(true);
    const interval = setInterval(() => void check(false), UPDATE_POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void check(false);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
