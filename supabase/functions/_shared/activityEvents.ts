/**
 * The vocabulary of things worth recording, shared by the app that sends
 * events and the function that stores them.
 *
 * Shared rather than duplicated so the server can reject an action the client
 * has no business sending, and so a typo is a compile error instead of a new
 * row nobody will ever think to query. Names that already exist in
 * `user_activities` from the old web app are kept exactly — the table has
 * 30k rows of history and splitting the vocabulary would strand them.
 *
 * Deliberately free of Deno and React Native APIs: both sides import this file.
 */

export const ACTIVITY_ACTIONS = [
  // Navigation. The route itself travels in metadata.screen.
  "page_access",

  // Session
  "login_success",
  "logout_success",
  "register_success",

  // Reading a coupon
  "view_coupon",
  "view_coupon_code",
  "open_redemption_url",

  // Changing a coupon
  "add_coupon_submit",
  "edit_coupon_submit",
  "delete_coupon",
  "bulk_import_submit",
  "scan_coupon",

  // Spending
  "record_coupon_usage",
  "mark_coupon_as_used",
  "delete_coupon_usage_record",

  // Sharing
  "share_coupon",
  "revoke_share",

  // Settings
  "update_notification_preferences",
  "enable_push",
  "disable_push",

  // First run
  "onboarding_start",
  "onboarding_complete",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

const ACTION_SET = new Set<string>(ACTIVITY_ACTIONS);

export function isActivityAction(value: unknown): value is ActivityAction {
  return typeof value === "string" && ACTION_SET.has(value);
}

/**
 * Metadata keys that must never be recorded, whatever a caller passes.
 *
 * An analytics table is the last place a coupon code should end up: it is the
 * one table read casually, exported to a spreadsheet, and kept forever. The
 * check is on the key name and runs on the server too, so a future caller
 * cannot opt out of it by accident.
 */
const FORBIDDEN_KEYS = [
  "code", "cvv", "card", "password", "token", "secret", "email", "phone",
];

export const MAX_EVENTS_PER_REQUEST = 50;
const MAX_METADATA_KEYS = 12;
const MAX_STRING_LENGTH = 200;

function keyIsForbidden(key: string): boolean {
  const lower = key.toLowerCase();
  return FORBIDDEN_KEYS.some((forbidden) => lower.includes(forbidden));
}

/**
 * Reduce metadata to short primitives, dropping anything sensitive or unbounded.
 * Returns null when nothing survives, so the column stays NULL rather than `{}`.
 */
export function sanitizeMetadata(input: unknown): Record<string, string | number | boolean> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const output: Record<string, string | number | boolean> = {};
  let kept = 0;

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (kept >= MAX_METADATA_KEYS) break;
    if (keyIsForbidden(key)) continue;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) continue;
      output[key] = trimmed.slice(0, MAX_STRING_LENGTH);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      output[key] = value;
    } else if (typeof value === "boolean") {
      output[key] = value;
    } else {
      continue; // objects, arrays, null, undefined, functions
    }
    kept += 1;
  }

  return kept > 0 ? output : null;
}

/** A coupon id is the only foreign key an event may carry. */
export function sanitizeCouponId(value: unknown): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
