import { describe, expect, it } from "vitest";
import { mapsSearchUrl } from "./mapsUrl";

describe("mapsSearchUrl", () => {
  it("builds a link the phone's map app can take over", () => {
    expect(mapsSearchUrl(32.06323, 34.76786)).toBe(
      "https://www.google.com/maps/search/?api=1&query=32.06323,34.76786",
    );
  });

  it("refuses coordinates that cannot exist", () => {
    expect(mapsSearchUrl(91, 34)).toBeNull();
    expect(mapsSearchUrl(32, 181)).toBeNull();
    expect(mapsSearchUrl(Number.NaN, 34)).toBeNull();
    expect(mapsSearchUrl(32, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("accepts the poles and the antimeridian", () => {
    expect(mapsSearchUrl(90, 180)).not.toBeNull();
  });
});
