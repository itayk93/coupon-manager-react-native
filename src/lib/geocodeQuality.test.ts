import { describe, expect, it } from "vitest";
import { geocodeConfidence, isCountryLevelResult, placeMatchesQuery } from "../../supabase/functions/_shared/geocodeQuality";

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

describe("geocodeConfidence", () => {
  it("is weak when Google admits it only partially matched the query", () => {
    // "גוד פארם יהודה הלוי תל אביב" → "המלך ג'ורג' 25": a real street address,
    // but Google dropped the words it did not understand to get there.
    expect(geocodeConfidence({
      partial_match: true,
      types: ["street_address"],
      address_components: [{ types: ["street_number"] }],
    })).toBe("weak");
  });

  it("is strong for a business or a single building", () => {
    expect(geocodeConfidence({ types: ["establishment", "point_of_interest"] })).toBe("strong");
    expect(geocodeConfidence({ types: ["premise"] })).toBe("strong");
    expect(geocodeConfidence({ types: ["street_address"] })).toBe("strong");
  });

  it("is strong for a route that still carries a house number", () => {
    expect(geocodeConfidence({
      types: ["route"],
      address_components: [{ types: ["street_number"] }, { types: ["route"] }],
    })).toBe("strong");
  });

  it("is weak for a street, a neighbourhood or a city", () => {
    expect(geocodeConfidence({ types: ["route"] })).toBe("weak");
    expect(geocodeConfidence({ types: ["neighborhood", "political"] })).toBe("weak");
    expect(geocodeConfidence({ types: ["locality", "political"] })).toBe("weak");
  });

  it("is weak when the result carries no typing at all", () => {
    expect(geocodeConfidence({})).toBe("weak");
    expect(geocodeConfidence({ types: null, address_components: null })).toBe("weak");
  });
});

describe("placeMatchesQuery", () => {
  it("accepts a place whose name shares a word with the query", () => {
    expect(placeMatchesQuery("גוד פארם יהודה הלוי תל אביב", ["GoodPharm גוד פארם", "יהודה הלוי 42, תל אביב-יפו"])).toBe(true);
  });

  it("accepts a match through the address alone", () => {
    expect(placeMatchesQuery("ארקפה - מיזטאון", ["Arcaffe", "דרך מנחם בגין 144, ארקפה מידטאון"])).toBe(true);
  });

  it("rejects a place that shares nothing with the query", () => {
    expect(placeMatchesQuery("אתר מפעל הפיס", ["Super-Pharm", "דיזנגוף 50, תל אביב-יפו"])).toBe(false);
  });

  it("does not count the country as a shared word", () => {
    expect(placeMatchesQuery("קפה נמרוד, ישראל", ["Aroma", "ישראל"])).toBe(false);
  });

  it("ignores punctuation and single letters", () => {
    expect(placeMatchesQuery("ג'ורג' & ג'ון", ["George & John", "המלך ג׳ורג׳ 12"])).toBe(true);
    expect(placeMatchesQuery("א ב", ["אבא", "כתובת"])).toBe(false);
  });

  it("rejects an empty candidate", () => {
    expect(placeMatchesQuery("גוד פארם", [null, undefined, ""])).toBe(false);
  });
});
