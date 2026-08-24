import { describe, expect, it } from "vitest";
import {
  BIOMETRIC_BACKGROUND_GRACE_MS,
  shouldRelockAfterBackground,
} from "./biometricLock";

describe("biometric background lock", () => {
  it("keeps the app unlocked after a short device unlock or app switch", () => {
    expect(shouldRelockAfterBackground(1_000, 2_000)).toBe(false);
  });

  it("relocks after the grace period", () => {
    expect(
      shouldRelockAfterBackground(
        1_000,
        1_000 + BIOMETRIC_BACKGROUND_GRACE_MS
      )
    ).toBe(true);
  });

  it("does not relock without a recorded background transition", () => {
    expect(shouldRelockAfterBackground(null, Date.now())).toBe(false);
  });
});
