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
