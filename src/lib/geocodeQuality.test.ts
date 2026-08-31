import { describe, expect, it } from "vitest";
import { isCountryLevelResult } from "../../supabase/functions/_shared/geocodeQuality";

const MIDTOWN = { latitude: 32.0774742, longitude: 34.7930598, address: "דרך מנחם בגין 144, תל אביב" };

describe("isCountryLevelResult", () => {
  it("rejects the centroid of Israel, whatever the address says", () => {
    expect(isCountryLevelResult({ latitude: 31.046051, longitude: 34.851612 })).toBe(true);
  });

  it("rejects a point that merely rounds to the centroid", () => {
    expect(isCountryLevelResult({ latitude: 31.0461, longitude: 34.8517 })).toBe(true);
  });

  it("rejects a result whose whole address is the country", () => {
    expect(isCountryLevelResult({ ...MIDTOWN, address: "ישראל" })).toBe(true);
    expect(isCountryLevelResult({ ...MIDTOWN, address: " Israel " })).toBe(true);
  });

  it("rejects a result typed only as an area", () => {
    expect(isCountryLevelResult({ ...MIDTOWN, types: ["country", "political"] })).toBe(true);
    expect(isCountryLevelResult({ ...MIDTOWN, types: ["administrative_area_level_1"] })).toBe(true);
  });

  it("accepts a street address, which also carries the political type", () => {
    expect(isCountryLevelResult({ ...MIDTOWN, types: ["street_address", "political"] })).toBe(false);
  });

  it("accepts a real branch", () => {
    expect(isCountryLevelResult(MIDTOWN)).toBe(false);
    expect(isCountryLevelResult({ latitude: 32.0607841, longitude: 34.7828368 })).toBe(false);
  });

  it("rejects coordinates that are not numbers at all", () => {
    expect(isCountryLevelResult({ latitude: Number.NaN, longitude: 34.79 })).toBe(true);
  });
});
