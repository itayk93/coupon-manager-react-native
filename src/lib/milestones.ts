import { COUNT_STEPS, SAVINGS_STEPS } from "./celebrationTrigger";

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
 */

export type LadderStep = { value: number; reached: boolean };

export type Ladder = {
  kind: "milestone" | "savings";
  /** The highest step passed, or null when none have been. */
  best: number | null;
  /** The next step, or null once the ladder is topped out. */
  next: number | null;
  steps: LadderStep[];
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

function ladder(kind: Ladder["kind"], all: number[], reached: number[]): Ladder {
  const passed = new Set(reached);
  const best = reached.length ? Math.max(...reached) : null;
  return {
    kind,
    best,
    next: all.find((step) => (best === null ? true : step > best)) ?? null,
    steps: all.map((value) => ({ value, reached: passed.has(value) || (best !== null && value <= best) })),
  };
}

export function summariseMilestones(tokens: string[] = []): MilestoneSummary {
  const byKind = parse(tokens);
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

  return { ladders, oneOffs, repeats, total: tokens.length };
}
