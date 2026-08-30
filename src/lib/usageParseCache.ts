import type { ParsedUsageScreenshot } from "@/hooks/useUsageAI";

/**
 * In-memory cache of screenshot parse results, keyed by the shared-import id.
 *
 * When a detected coupon code has no matching coupon, the user is sent to the
 * add-coupon screen and the usage flow resumes afterwards. Without this cache
 * the resume re-runs the AI parse on the same image — a second network call
 * whose result is not deterministic (the same screenshot can return the code
 * once and null the next time), so the flow could claim "coupon not found"
 * right after the user added it. Reusing the first parse keeps the detected
 * code stable across the detour.
 *
 * Memory only — never written to disk. Capped and expiring to stay tiny.
 */

const MAX_ENTRIES = 3;
const TTL_MS = 10 * 60 * 1000; // matches SHARED_IMPORT_TTL_MS in coupon-widget

type Entry = { result: ParsedUsageScreenshot; storedAt: number };

const cache = new Map<string, Entry>();

export function cacheParsedUsage(
  key: string,
  result: ParsedUsageScreenshot,
  now: number = Date.now()
): void {
  if (!key) return;
  cache.delete(key);
  cache.set(key, { result, storedAt: now });
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function getCachedParsedUsage(
  key: string,
  now: number = Date.now()
): ParsedUsageScreenshot | null {
  if (!key) return null;
  const entry = cache.get(key);
  if (!entry) return null;
  if (now - entry.storedAt > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

export function clearParsedUsageCache(): void {
  cache.clear();
}
