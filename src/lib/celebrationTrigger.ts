import type { DecryptedCoupon } from "@/hooks/useCoupons";
import { couponRemainingValue, isSpendableCoupon, totalRemainingValue } from "./couponTotals";

/**
 * Which celebration scene, if any, the home-screen widget should show today.
 *
 * Pure on purpose: the caller supplies the wallet, the clock and what has
 * already been celebrated, so the rules are testable without a device.
 */

export type CelebrationKind =
  | "redeemed"
  | "rescue"
  | "anniversary"
  | "record"
  | "milestone"
  | "savings"
  | "clean"
  | "monthly";

export type CelebrationState = {
  /** ISO date (yyyy-MM-dd) the user signed up, if known. */
  memberSince?: string | null;
  /** Highest wallet value ever seen, so a new high can be recognised. */
  walletRecord?: number | null;
  /** `kind:token` strings already celebrated — one entry per milestone reached. */
  celebrated?: string[];
};

export type CelebrationPick = {
  kind: CelebrationKind;
  /** Stable id for this specific milestone, e.g. "milestone:25". Stored once shown. */
  token: string;
};

/** Coupon counts worth a scene. Passing 24 -> 25 is an event; 26 is not. */
const COUNT_STEPS = [5, 10, 25, 50, 100, 250];
/** Shekel savings worth a scene. */
const SAVINGS_STEPS = [1000, 5000, 10_000, 25_000, 50_000, 100_000];

/** A wallet has to beat its old high by this much before it counts as a record. */
const RECORD_MARGIN = 250;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function parseDateOnly(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const value = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

/** Full years between two dates, counting only completed anniversaries. */
export function completedYears(from: Date, now: Date): number {
  let years = now.getFullYear() - from.getFullYear();
  const beforeAnniversary =
    now.getMonth() < from.getMonth() ||
    (now.getMonth() === from.getMonth() && now.getDate() < from.getDate());
  if (beforeAnniversary) years -= 1;
  return years;
}

/** True on the calendar day the signup date recurs. */
function isAnniversaryToday(from: Date, now: Date): boolean {
  return from.getMonth() === now.getMonth() && from.getDate() === now.getDate();
}

/** The highest step the value has reached, or null below the first step. */
function reachedStep(value: number, steps: number[]): number | null {
  let hit: number | null = null;
  for (const step of steps) if (value >= step) hit = step;
  return hit;
}

/** What the wallet was worth minus what it cost to acquire. */
export function lifetimeSavings(coupons: DecryptedCoupon[]): number {
  return coupons.reduce((sum, coupon) => sum + ((coupon.value ?? 0) - (coupon.cost ?? 0)), 0);
}

/** Spendable coupons that expired before today without being fully used. */
function expiredThisMonth(coupons: DecryptedCoupon[], now: Date): number {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const today = startOfDay(now);
  return coupons.filter((coupon) => {
    if (coupon.status === "נוצל") return false;
    if (couponRemainingValue(coupon) <= 0) return false;
    const end = parseDateOnly(coupon.expiration);
    if (!end) return false;
    const day = startOfDay(end);
    return day >= monthStart && day < today;
  }).length;
}

/**
 * Picks today's celebration, or null when there is nothing to celebrate.
 *
 * Order matters: rarer events win, so a first anniversary is never buried by a
 * routine monthly recap. Anything already in `celebrated` is skipped, which is
 * what stops the same milestone reappearing every single sync.
 */
export function pickCelebration(
  coupons: DecryptedCoupon[],
  state: CelebrationState = {},
  now: Date = new Date()
): CelebrationPick | null {
  const seen = new Set(state.celebrated ?? []);
  const spendable = coupons.filter(isSpendableCoupon);

  const candidates: CelebrationPick[] = [];

  const joined = parseDateOnly(state.memberSince);
  if (joined) {
    const years = completedYears(joined, now);
    if (years >= 1 && isAnniversaryToday(joined, now)) {
      candidates.push({ kind: "anniversary", token: `anniversary:${years}` });
    }
  }

  const wallet = totalRemainingValue(coupons);
  const previousRecord = state.walletRecord ?? 0;
  if (wallet > 0 && wallet >= previousRecord + RECORD_MARGIN) {
    // Bucketed so a wallet that keeps creeping up does not celebrate daily.
    candidates.push({ kind: "record", token: `record:${Math.floor(wallet / RECORD_MARGIN)}` });
  }

  const countStep = reachedStep(spendable.length, COUNT_STEPS);
  if (countStep) candidates.push({ kind: "milestone", token: `milestone:${countStep}` });

  const savingsStep = reachedStep(lifetimeSavings(coupons), SAVINGS_STEPS);
  if (savingsStep) candidates.push({ kind: "savings", token: `savings:${savingsStep}` });

  const monthToken = `${now.getFullYear()}-${now.getMonth() + 1}`;
  // Only in the first three days of a month, and only once that month.
  if (now.getDate() <= 3) {
    if (spendable.length > 0 && expiredThisMonth(coupons, now) === 0) {
      candidates.push({ kind: "clean", token: `clean:${monthToken}` });
    }
    if (lifetimeSavings(coupons) > 0) {
      candidates.push({ kind: "monthly", token: `monthly:${monthToken}` });
    }
  }

  return candidates.find((candidate) => !seen.has(candidate.token)) ?? null;
}

// ------------------------------------------------------------- redemption

const ISRAEL_TZ = "Asia/Jerusalem";

/** A coupon spent this close to its expiry was rescued, not just used. */
export const RESCUE_WINDOW_DAYS = 3;

/** Longest company name the small widget headline can carry before wrapping badly. */
const MAX_COMPANY_CHARS = 18;

/** Israel wall-clock date parts for an instant, or null when Intl cannot say. */
function israelParts(now: Date): { y: number; m: number; d: number; offsetMs: number } | null {
  try {
    const parts: Record<string, string> = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: ISRAEL_TZ,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(now)
      .forEach((part) => {
        parts[part.type] = part.value;
      });
    const y = Number(parts.year);
    const m = Number(parts.month);
    const d = Number(parts.day);
    const wallAsUtc = Date.UTC(y, m - 1, d, Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
    if (!Number.isFinite(wallAsUtc)) return null;
    return { y, m, d, offsetMs: wallAsUtc - Math.floor(now.getTime() / 1000) * 1000 };
  } catch {
    return null;
  }
}

/**
 * The next 00:00 in Israel. Israel changes clocks at 02:00, never between an
 * afternoon and the following midnight, so today's offset holds until then.
 */
export function endOfIsraelDay(now: Date = new Date()): Date {
  const parts = israelParts(now);
  if (!parts) return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return new Date(Date.UTC(parts.y, parts.m - 1, parts.d + 1) - parts.offsetMs);
}

/** Whole days from today (Israel) to a yyyy-MM-dd expiry. Negative = already past. */
function israelDaysUntil(expiration: string | null | undefined, now: Date): number | null {
  const match = expiration?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const parts = israelParts(now);
  const today = parts
    ? Date.UTC(parts.y, parts.m - 1, parts.d)
    : Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const end = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Math.round((end - today) / 86_400_000);
}

export type RedeemedCoupon = {
  company?: string | null;
  value?: number | null;
  cost?: number | null;
  expiration?: string | null;
  is_one_time?: boolean | null;
};

export type RedemptionCelebration = {
  kind: "redeemed" | "rescue";
  text: string;
  /** The scene comes down at this instant — the next midnight in Israel. */
  until: Date;
};

const shekelsText = (value: number) => `₪${Math.round(value).toLocaleString("en-US")}`;

/**
 * The scene for a coupon that was just spent to the end.
 *
 * `rescuedAmount` is what this last usage took off the balance — the money
 * that would have been lost had the coupon expired instead.
 */
export function redemptionCelebration(
  coupon: RedeemedCoupon,
  rescuedAmount: number,
  now: Date = new Date()
): RedemptionCelebration {
  const rawName = (coupon.company || "").trim() || "הקופון";
  const company = rawName.length > MAX_COMPANY_CHARS ? `${rawName.slice(0, MAX_COMPANY_CHARS - 1)}…` : rawName;
  const until = endOfIsraelDay(now);

  const days = israelDaysUntil(coupon.expiration, now);
  if (days !== null && days >= 0 && days <= RESCUE_WINDOW_DAYS) {
    const text =
      coupon.is_one_time || !(rescuedAmount > 0)
        ? `הצלת את ${company} רגע לפני שפג`
        : `הצלת ${shekelsText(rescuedAmount)} רגע לפני שפג`;
    return { kind: "rescue", text, until };
  }

  // Same number the "coupon finished" notification quotes, so the two agree.
  const saved = Math.max(0, (coupon.value ?? 0) - (coupon.cost ?? 0));
  const text =
    coupon.is_one_time || saved <= 0 ? `מימשת את ${company}` : `מימשת את ${company} · חסכת ${shekelsText(saved)}`;
  return { kind: "redeemed", text, until };
}
