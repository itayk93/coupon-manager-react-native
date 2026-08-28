import { describe, expect, it } from "vitest";
import { publicUserId } from "./userId";

describe("publicUserId", () => {
  it("uses the opaque public id", () => {
    expect(publicUserId({ id: 42, public_id: "usr_0123456789abcdefabcd" }))
      .toBe("usr_0123456789abcdefabcd");
  });

  it("keeps cached pre-rollout sessions working", () => {
    expect(publicUserId({ id: 42 })).toBe("42");
  });
});
