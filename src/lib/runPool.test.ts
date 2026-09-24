import { describe, expect, it } from "vitest";
import { runPool } from "./runPool";

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe("runPool", () => {
  it("runs every item", async () => {
    const seen: number[] = [];
    await runPool([1, 2, 3, 4, 5], 2, async (n) => { await tick(); seen.push(n); });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("never has more than the limit in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    await runPool(Array.from({ length: 12 }, (_, i) => i), 4, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight -= 1;
    });
    expect(peak).toBe(4);
  });

  it("keeps going past a failure and reports what failed", async () => {
    const done: string[] = [];
    const result = await runPool(["a", "bad", "c", "worse"], 2, async (code) => {
      await tick();
      if (code.startsWith("bad") || code === "worse") throw new Error(`no ${code}`);
      done.push(code);
    });
    expect(done.sort()).toEqual(["a", "c"]);
    expect(result.failed.sort()).toEqual(["bad", "worse"]);
    expect(String(result.firstError)).toMatch(/no (bad|worse)/);
  });

  it("handles an empty list", async () => {
    expect(await runPool([], 4, async () => {})).toEqual({ failed: [], firstError: undefined });
  });
});
