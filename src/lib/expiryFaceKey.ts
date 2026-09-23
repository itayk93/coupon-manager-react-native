/**
 * Which of Kuponi's four expiry faces a reminder carries, by days left: calm a
 * week out, pressed at two or three days, alarmed the day before and on the
 * day. The server picks push icons on the same ladder
 * (supabase/functions/_shared/notificationIcons.ts); a test keeps them in step.
 */

export type ExpiryFaceKey = "expiry-week" | "expiry-soon" | "expiry-tomorrow" | "expiry-today";

export function expiryFaceKey(daysLeft: number): ExpiryFaceKey {
  if (daysLeft <= 0) return "expiry-today";
  if (daysLeft === 1) return "expiry-tomorrow";
  if (daysLeft <= 3) return "expiry-soon";
  return "expiry-week";
}
