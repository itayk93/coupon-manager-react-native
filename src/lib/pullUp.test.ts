import { describe, expect, it } from "vitest";
import {
  DISARM_AT,
  FINGER_TO_ARM,
  MAX_TRAVEL,
  TRAVEL_AT_ARM,
  pullArmed,
  pullTravel,
} from "./pullUp";

describe("pullTravel", () => {
  it("rests at zero until the finger goes past the end", () => {
    expect(pullTravel(0)).toBe(0);
    expect(pullTravel(-40)).toBe(0);
    expect(pullTravel(Number.NaN)).toBe(0);
  });

  it("arms at exactly the finger distance it advertises", () => {
    expect(pullTravel(FINGER_TO_ARM)).toBeCloseTo(TRAVEL_AT_ARM, 6);
  });

  it("never goes backwards as the pull grows", () => {
    let previous = 0;
    for (let past = 0; past <= 300; past += 5) {
      const travel = pullTravel(past);
      expect(travel).toBeGreaterThanOrEqual(previous);
      previous = travel;
    }
  });

  it("tracks the finger one to one up to the line, so the tab is never behind it", () => {
    const half = pullTravel(FINGER_TO_ARM / 2);
    expect(half).toBeCloseTo(TRAVEL_AT_ARM / 2, 6);
  });

  it("gets heavier past the line", () => {
    const first = pullTravel(FINGER_TO_ARM + 20) - pullTravel(FINGER_TO_ARM);
    const second = pullTravel(FINGER_TO_ARM + 40) - pullTravel(FINGER_TO_ARM + 20);
    expect(second).toBeLessThan(first);
  });

  it("arms within a short, deliberate pull", () => {
    // The old 120pt pull was never reached in practice; keep it under a thumb's
    // easy reach past the end of the page.
    expect(FINGER_TO_ARM).toBeLessThanOrEqual(64);
  });

  it("stops rising once there is nothing further to reach", () => {
    expect(pullTravel(10_000)).toBeCloseTo(MAX_TRAVEL, 6);
    expect(pullTravel(10_000)).toBeLessThanOrEqual(MAX_TRAVEL);
  });

  it("keeps registering a little past the line, then stops", () => {
    // The ceiling sits above the line rather than on it, so crossing is not
    // also the instant the curve goes flat — but it is close enough that a
    // hard pull cannot run the number away from the tab that is drawing it.
    expect(MAX_TRAVEL).toBeGreaterThan(TRAVEL_AT_ARM);
    expect(MAX_TRAVEL).toBeLessThan(TRAVEL_AT_ARM * 1.5);
  });
});

describe("pullArmed", () => {
  it("is off for anything short of the line", () => {
    expect(pullArmed(0)).toBe(false);
    expect(pullArmed(TRAVEL_AT_ARM - 0.01)).toBe(false);
  });

  it("is on at the line and past it", () => {
    expect(pullArmed(TRAVEL_AT_ARM)).toBe(true);
    expect(pullArmed(MAX_TRAVEL)).toBe(true);
  });

  it("agrees with the curve about where the line is", () => {
    expect(pullArmed(pullTravel(FINGER_TO_ARM - 1))).toBe(false);
    expect(pullArmed(pullTravel(FINGER_TO_ARM + 1))).toBe(true);
  });

  it("stays armed through a small wobble back, then lets go", () => {
    expect(pullArmed(DISARM_AT + 1, true)).toBe(true);
    expect(pullArmed(DISARM_AT - 1, true)).toBe(false);
    expect(pullArmed(DISARM_AT + 1, false)).toBe(false);
  });
});
