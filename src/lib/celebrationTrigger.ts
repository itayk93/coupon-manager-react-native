import type { DecryptedCoupon } from "@/hooks/useCoupons";
import { couponRemainingValue, isSpendableCoupon, totalRemainingValue } from "./couponTotals";

/**
 * Which celebration scene, if any, the home-screen widget should show today.
 *
 * Pure on purpose: the caller supplies the wallet, the clock and what has
 * already been celebrated, so the rules are testable without a device.
 */

export type CelebrationKind =
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
