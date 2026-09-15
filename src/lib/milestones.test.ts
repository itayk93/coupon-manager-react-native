import { describe, expect, it } from "vitest";
import { summariseMilestones } from "./milestones";

describe("summariseMilestones", () => {
  it("reads nothing out of an empty history", () => {
    const summary = summariseMilestones([]);
    expect(summary.total).toBe(0);
    expect(summary.oneOffs).toEqual([]);
    expect(summary.repeats).toEqual([]);
    expect(summary.ladders.every((l) => l.best === null)).toBe(true);
    // An untouched ladder still points at its first rung.
    expect(summary.ladders[0].next).toBe(5);
  });

  it("marks every rung at or below the best one as passed", () => {
    const { ladders } = summariseMilestones(["milestone:25"]);
    const counts = ladders[0];
    expect(counts.best).toBe(25);
    expect(counts.next).toBe(50);
    expect(counts.steps.map((s) => s.reached)).toEqual([true, true, true, false, false, false]);
  });

  it("has no next rung once the ladder is topped out", () => {
    const { ladders } = summariseMilestones(["savings:100000"]);
    expect(ladders[1].best).toBe(100_000);
    expect(ladders[1].next).toBeNull();
  });

  it("keeps only the best of a repeated one-off", () => {
    // Three wallet records in a row is one fact about the wallet.
    const { oneOffs } = summariseMilestones(["record:900", "record:1500", "record:1200"]);
    expect(oneOffs).toEqual([{ kind: "record", value: 1500 }]);
  });

  it("counts the months instead of listing them", () => {
    const { repeats } = summariseMilestones(["clean:2026-7", "clean:2026-8", "monthly:2026-8"]);
    expect(repeats).toEqual([
      { kind: "clean", count: 2 },
      { kind: "monthly", count: 1 },
    ]);
  });

  it("ignores anything that is not a token", () => {
    const summary = summariseMilestones(["", "nonsense", ":5", "milestone:10"]);
    expect(summary.ladders[0].best).toBe(10);
  });
});
