/**
 * One source of truth for the app's date display.
 *
 * The previous layout had a local `formatDateShort` in three components and a
 * `daysUntil` in four, which was how the same expiry could read `12/08/2026` on
 * one screen and `12.8.2026` on another. Import these instead.
 */

/** `12/08/2026` — the compact form used on cards and sheets. */
export function formatDateShort(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** `12.8.2026` — the Hebrew locale form used on detail and history rows. */
export function formatDateHebrew(value: string | null | undefined): string {
  if (!value) return "ללא תוקף";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Whole days from now until `value`; negative when already past. */
export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/**
 * Israel time, spelled the way people here write it: `23/06/2026 22:29`.
 *
 * Usage timestamps are read off receipts and screenshots, and a receipt says
 * when the person was standing at the till — in Israel, on Israeli clocks.
 * Rendering them in the device's timezone means the same purchase reads
 * differently on a phone that came back from a trip with its clock still on
 * another continent. So the timezone is fixed, not local, and DST is left to
 * `Intl` rather than a hardcoded +02:00/+03:00 that is wrong half the year.
 */
export const ISRAEL_TIME_ZONE = "Asia/Jerusalem";

const ISRAEL_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: ISRAEL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** `dd/mm/yyyy hh:mm` in Israel time. Returns null for anything unparseable. */
export function formatIsraelDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(
    ISRAEL_PARTS.formatToParts(date).map((part) => [part.type, part.value]),
  );
  // `en-GB` at hour12: false renders midnight as 24 in some engines.
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.day}/${parts.month}/${parts.year} ${hour}:${parts.minute}`;
}

/** The offset Israel was on at a given instant, in minutes ahead of UTC. */
function israelOffsetMinutes(instant: Date): number {
  const parts = Object.fromEntries(
    ISRAEL_PARTS.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour),
    Number(parts.minute),
  );
  // Seconds are dropped by the formatter, so compare against a whole minute.
  return Math.round((asUtc - Math.floor(instant.getTime() / 60000) * 60000) / 60000);
}

/**
 * `dd/mm/yyyy hh:mm` typed by a person, back to an ISO instant.
 *
 * Two passes, because the offset depends on the answer: guess that the wall
 * clock is UTC, ask what offset Israel was on around then, subtract it, then
 * confirm. The second pass is what makes the hour before a DST change land on
 * the right side of it.
 */
export function parseIsraelDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match.map(Number) as unknown as number[];
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  let instant = new Date(wallClock - israelOffsetMinutes(new Date(wallClock)) * 60000);
  const corrected = wallClock - israelOffsetMinutes(instant) * 60000;
  if (corrected !== instant.getTime()) instant = new Date(corrected);

  // A date that does not exist (31/02) rolls over in Date.UTC. Reject it
  // rather than silently recording a different day than the one typed.
  if (formatIsraelDateTime(instant.toISOString()) !== `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`) {
    return null;
  }
  return instant.toISOString();
}
