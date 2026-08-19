/**
 * The reminder windows, in days before expiry. 0 means the expiry date itself.
 *
 * Mirrored by the column default on notification_preferences and by
 * DEFAULT_WINDOWS in the send-expiry-alerts function, which cannot import from
 * here — keep the three in step.
 */
export const NOTIFICATION_WINDOWS = [
  { value: 30, label: "30 יום לפני" },
  { value: 7, label: "שבוע לפני" },
  { value: 1, label: "יום לפני" },
  { value: 0, label: "ביום התפוגה" },
] as const;

export const DEFAULT_NOTIFICATION_WINDOWS = NOTIFICATION_WINDOWS.map((w) => w.value) as number[];
