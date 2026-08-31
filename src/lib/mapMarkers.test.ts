import { describe, expect, it } from "vitest";
import { groupByPoint, regionForPoints } from "./mapMarkers";

const MIDTOWN = { latitude: 32.0774742, longitude: 34.793_0598 };
const BEIT_ARCAFFE = { latitude: 32.0607841, longitude: 34.7828368 };

describe("groupByPoint", () => {
  it("draws one marker per place and counts the visits", () => {
    const grouped = groupByPoint([
      { ...MIDTOWN, title: "ארקפה - מידטאון" },
      { ...MIDTOWN, title: "ארקפה - מידטאון" },
      { ...MIDTOWN, title: "ארקפה - מידטאון" },
      { ...BEIT_ARCAFFE, title: "ארקפה - בית ארקפה" },
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].visits).toBe(3);
    expect(grouped[1].visits).toBe(1);
  });

  it("collapses readings that agree to five decimals", () => {
    // A metre-scale grid, not a radius: two readings either side of a grid line
    // stay separate. That is fine here — the pins are then a metre apart and
    // still read as one place on screen.
    const grouped = groupByPoint([
      MIDTOWN,
      { latitude: MIDTOWN.latitude + 0.0000004, longitude: MIDTOWN.longitude },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].visits).toBe(2);
  });

  it("keeps places a street apart separate", () => {
    expect(groupByPoint([MIDTOWN, BEIT_ARCAFFE])).toHaveLength(2);
  });

  it("takes the name from whichever visit recorded one", () => {
    const grouped = groupByPoint([
      { ...MIDTOWN },
      { ...MIDTOWN, title: "ארקפה - מידטאון", description: "דרך מנחם בגין" },
    ]);
    expect(grouped[0].title).toBe("ארקפה - מידטאון");
    expect(grouped[0].description).toBe("דרך מנחם בגין");
  });
});

describe("regionForPoints", () => {
  it("frames every point instead of only the first", () => {
    const region = regionForPoints([MIDTOWN, BEIT_ARCAFFE]);
    const north = region.latitude + region.latitudeDelta / 2;
    const south = region.latitude - region.latitudeDelta / 2;
    expect(north).toBeGreaterThan(MIDTOWN.latitude);
    expect(south).toBeLessThan(BEIT_ARCAFFE.latitude);
  });

  it("leaves margin so the outermost pins are not cut by the edge", () => {
    const span = MIDTOWN.latitude - BEIT_ARCAFFE.latitude;
    expect(regionForPoints([MIDTOWN, BEIT_ARCAFFE]).latitudeDelta).toBeGreaterThan(span);
  });

  it("keeps a readable zoom for a single point", () => {
    const region = regionForPoints([MIDTOWN]);
    expect(region.latitude).toBe(MIDTOWN.latitude);
    expect(region.latitudeDelta).toBe(0.01);
  });

  it("falls back to the whole country when there is nothing to show", () => {
    expect(regionForPoints([]).latitudeDelta).toBe(2.8);
  });
});
