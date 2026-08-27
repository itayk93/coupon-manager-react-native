/**
 * Display-side helpers for the notifications screen.
 *
 * Kept separate from the screen so the legacy-English translation and the
 * duplicate-merge can be unit tested without mounting the whole feed.
 */

export type NotificationFeedItem = {
  id: string;
  kind?: string | null;
  type?: "warning" | "system";
  title: string;
  message: string;
  urgent?: boolean;
};

/** Translate English notification rows written before kinds were localised. */
export function legacyHebrew(value: string): string {
  return value
    .replace(/^You now have access to (.+) coupon$/i, "קיבלת גישה לקופון של $1")
    .replace(/^Access to (.+) coupon was revoked$/i, "הגישה לקופון של $1 בוטלה")
    .replace(/^You revoked access to (.+) coupon$/i, "ביטלת את הגישה לקופון של $1")
    .replace(/ accepted your shared coupon$/i, " אישר/ה את הקופון ששיתפת");
}

/**
 * Merge two feeds (live expiry warnings + stored rows) without repeating the
 * same event. Identity is kind/type + title + message, case-folded.
 */
export function mergeNotificationFeeds<T extends NotificationFeedItem>(feeds: T[][]): T[] {
  return Array.from(
    new Map(
      feeds
        .flat()
        .map((item) => [
          `${item.kind || item.type || "system"}:${item.title}:${item.message}`.toLocaleLowerCase("he"),
          item,
        ])
    ).values()
  );
}
