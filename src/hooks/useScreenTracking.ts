import { useEffect, useRef } from "react";
import { usePathname } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { logActivity, startActivityLog } from "@/lib/activityLog";

/**
 * Records a `page_access` event every time the route changes.
 *
 * Mounted once at the root, so a new screen is tracked by existing — nobody
 * has to remember to add a call, and a screen added next year is covered the
 * day it ships. That is the whole reason this is a route watcher rather than a
 * hook each screen opts into.
 */
export function useScreenTracking() {
  const pathname = usePathname();
  const { session } = useAuth();
  const previous = useRef<string | null>(null);

  useEffect(() => startActivityLog(), []);

  useEffect(() => {
    // Events are attributed to an account, so nothing is recorded before there
    // is one. The login screen itself is not worth a row.
    if (!session || !pathname) return;
    // A re-render on the same route is not another visit.
    if (previous.current === pathname) return;

    const from = previous.current;
    previous.current = pathname;

    logActivity("page_access", {
      screen: pathname,
      // Where they came from is what turns a list of screens into a path
      // through the app, and it is the part that cannot be reconstructed
      // afterwards from timestamps alone.
      metadata: from ? { from } : undefined,
    });
  }, [pathname, session]);
}
