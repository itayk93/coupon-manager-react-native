import { describe, expect, it } from "vitest";
import { entityPublicId } from "./entityId";

describe("entityPublicId", () => {
  it("uses the opaque public id", () => {
    expect(entityPublicId({ id: 42, public_id: "cpn_0123456789abcdefabcd" }))
      .toBe("cpn_0123456789abcdefabcd");
    expect(entityPublicId({ id: 42, public_id: "usr_0123456789abcdefabcd" }))
      .toBe("usr_0123456789abcdefabcd");
  });

  it("keeps cached pre-migration records working with numeric fallback", () => {
    expect(entityPublicId({ id: 42 })).toBe("42");
    expect(entityPublicId({ id: 99, public_id: null })).toBe("99");
  });
});
