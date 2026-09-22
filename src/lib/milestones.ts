import { baselineCelebrationTokens, lifetimeSavings, COUNT_STEPS, SAVINGS_STEPS } from "./celebrationTrigger";
import { isSpendableCoupon } from "./couponTotals";
import type { DecryptedCoupon } from "@/hooks/useCoupons";

/**
 * What the stored celebration tokens add up to.
 *
 * `celebrationMemory` keeps a `kind:value` token for every milestone the
 * wallet has passed, so the app already knows the whole history — it just
 * threw it away after showing each scene once. This turns that list into
 * something a person can look at.
 *
 * Deliberately worded as milestones REACHED, not celebrations seen. A wallet
 * first seen with thirty coupons is seeded with `milestone:25` by
 * `seedCelebrationBaseline` without ever showing a scene, and those tokens are
 * indistinguishable from earned ones. "You have passed 25 coupons" is true in
 * both cases; "we celebrated this together" would not be, and no date is
 * claimed for the same reason.
 *
 * Which is why `milestonesFor` reads the wallet as well as the memory. The
 * tokens live in device storage, so reinstalling the web app, clearing site
 * data or signing in on a second device wipes the lot — and a wallet holding
 * 35 coupons and ₪5,000 of savings was being told it had never passed
 * anything. The memory is the only record of a record broken or a clean month
 * survived, so it still counts; it is simply no longer the only witness to the
 * two ladders the wallet can prove on its own.
 */

export type LadderStep = { value: number; reached: boolean };

export type Ladder = {
  kind: "milestone" | "savings";
  /** The highest step passed, or null when none have been. */
  best: number | null;
  /** The next step, or null once the ladder is topped out. */
  next: number | null;
  steps: LadderStep[];
  /**
   * Where the wallet stands right now, in this ladder's own unit — coupons or
   * shekels. The steps say what has been passed; this is what says how far the
   * next one is, which is the only part a person can act on.
   */
  value: number;
};

export type MilestoneSummary = {
  ladders: Ladder[];
  /** One-time moments, newest-valued first. */
  oneOffs: { kind: "anniversary" | "record" | "six-seven"; value: number }[];
  /** Months that earned a scene, counted rather than listed. */
  repeats: { kind: "clean" | "monthly"; count: number }[];
  /** How many milestones have been passed in total. */
  total: number;
};

function parse(tokens: string[]): Map<string, number[]> {
  const byKind = new Map<string, number[]>();
  for (const token of tokens) {
    const separator = token.indexOf(":");
    if (separator <= 0) continue;
    const kind = token.slice(0, separator);
    const raw = token.slice(separator + 1);
    // `clean` and `monthly` carry a "2026-9" month, not a number; they are
    // counted, so the value only has to be distinct per occurrence.
    const value = Number(raw);
    const list = byKind.get(kind) ?? [];
    list.push(Number.isFinite(value) ? value : 0);
    byKind.set(kind, list);
  }
  return byKind;
}

function ladder(kind: Ladder["kind"], all: number[], reached: number[], value = 0): Ladder {
  const passed = new Set(reached);
  const best = reached.length ? Math.max(...reached) : null;
  return {
    kind,
    best,
    value,
    next: all.find((step) => (best === null ? true : step > best)) ?? null,
    steps: all.map((value) => ({ value, reached: passed.has(value) || (best !== null && value <= best) })),
  };
}

export function summariseMilestones(tokens: string[] = []): MilestoneSummary {
  // The wallet and the memory both name the step a wallet stands on, and a
  // month celebrated twice is still one month.
  const byKind = parse([...new Set(tokens)]);
  const ladders: Ladder[] = [
    ladder("milestone", COUNT_STEPS, byKind.get("milestone") ?? []),
    ladder("savings", SAVINGS_STEPS, byKind.get("savings") ?? []),
  ];

  const oneOffs: MilestoneSummary["oneOffs"] = [];
  for (const kind of ["anniversary", "record", "six-seven"] as const) {
    const values = byKind.get(kind);
    // Only the best one is worth showing: three wallet records in a row is one
    // fact about the wallet, not three achievements.
    if (values?.length) oneOffs.push({ kind, value: Math.max(...values) });
  }

  const repeats: MilestoneSummary["repeats"] = [];
  for (const kind of ["clean", "monthly"] as const) {
    const values = byKind.get(kind);
    if (values?.length) repeats.push({ kind, count: values.length });
  }

  // Counted from the rungs rather than the tokens: a wallet that passed 5, 10
  // and 25 one at a time and a wallet derived at 25 in one go have reached the
  // same three milestones, and the headline should not depend on which.
  const total =
    ladders.reduce((sum, rung) => sum + rung.steps.filter((step) => step.reached).length, 0) +
    oneOffs.length +
    repeats.reduce((sum, moment) => sum + moment.count, 0);

  return { ladders, oneOffs, repeats, total };
}

/**
 * Every milestone this wallet has passed: what the device remembers, and what
 * the wallet itself proves regardless of what any device remembers.
 */
export function milestonesFor(
  coupons: DecryptedCoupon[] = [],
  remembered: string[] = [],
): MilestoneSummary {
  const summary = summariseMilestones([...remembered, ...baselineCelebrationTokens(coupons)]);
  const standing: Record<Ladder["kind"], number> = {
    milestone: coupons.filter(isSpendableCoupon).length,
    savings: lifetimeSavings(coupons),
  };
  return {
    ...summary,
    ladders: summary.ladders.map((rung) => ({ ...rung, value: standing[rung.kind] })),
  };
}
