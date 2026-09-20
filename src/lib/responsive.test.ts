import { describe, expect, it } from "vitest";
import {
  canSplitPanes,
  columnWidth,
  contentGutter,
  contentMaxWidth,
  gridColumns,
  isTabletWidth,
  layoutClass,
  detailPaneWidth,
  listPaneWidth,
  navMode,
  navWidth,
  scaleFont,
  GRID_MAX_WIDTH,
  READING_MAX_WIDTH,
  DUO_DETAIL_MIN_WIDTH,
} from "./responsive";

// Point widths of the devices the app actually ships to.
const IPHONE_SE = 320;
const IPHONE_15 = 393;
const IPHONE_MAX = 440;
const IPAD_MINI_PORTRAIT = 744;
const IPAD_11_PORTRAIT = 834;
const IPAD_PRO_PORTRAIT = 1024;
const IPAD_11_LANDSCAPE = 1194;
const IPAD_PRO_LANDSCAPE = 1366;
// Widths iPadOS hands out in Split View and Slide Over.
const SLIDE_OVER = 320;
const SPLIT_HALF = 507;
const SPLIT_TWO_THIRDS = 694;

describe("layoutClass", () => {
  it("calls every iPhone compact", () => {
    for (const width of [IPHONE_SE, IPHONE_15, IPHONE_MAX]) {
      expect(layoutClass(width)).toBe("compact");
    }
  });

  it("calls an iPad in portrait medium, and in landscape expanded", () => {
    expect(layoutClass(IPAD_MINI_PORTRAIT)).toBe("medium");
    expect(layoutClass(IPAD_11_PORTRAIT)).toBe("medium");
    expect(layoutClass(IPAD_11_LANDSCAPE)).toBe("expanded");
    expect(layoutClass(IPAD_PRO_LANDSCAPE)).toBe("expanded");
  });

  it("treats the 12.9\" portrait width as expanded — it is as wide as a laptop", () => {
    expect(layoutClass(IPAD_PRO_PORTRAIT)).toBe("expanded");
  });

  it("drops an iPad back to the phone layout in Slide Over and narrow Split View", () => {
    expect(layoutClass(SLIDE_OVER)).toBe("compact");
    expect(layoutClass(SPLIT_HALF)).toBe("compact");
    expect(layoutClass(SPLIT_TWO_THIRDS)).toBe("compact");
    expect(isTabletWidth(SPLIT_TWO_THIRDS)).toBe(false);
    expect(isTabletWidth(IPAD_MINI_PORTRAIT)).toBe(true);
  });
});

describe("contentGutter", () => {
  it("leaves the phone's 16pt margin exactly where it was", () => {
    expect(contentGutter(IPHONE_15)).toBe(16);
    expect(contentGutter(SPLIT_HALF)).toBe(16);
  });

  it("opens up once by class, not continuously", () => {
    expect(contentGutter(IPAD_MINI_PORTRAIT)).toBe(contentGutter(IPAD_11_PORTRAIT));
    expect(contentGutter(IPAD_11_LANDSCAPE)).toBeGreaterThan(contentGutter(IPAD_11_PORTRAIT));
  });
});

describe("contentMaxWidth", () => {
  it("caps nothing on a phone, so the existing layout is untouched", () => {
    expect(contentMaxWidth(IPHONE_15, "reading")).toBeUndefined();
    expect(contentMaxWidth(IPHONE_15, "grid")).toBeUndefined();
  });

  it("holds a form to a readable column on an iPad", () => {
    expect(contentMaxWidth(IPAD_11_PORTRAIT, "reading")).toBe(READING_MAX_WIDTH);
    expect(contentMaxWidth(IPAD_PRO_LANDSCAPE, "reading")).toBe(READING_MAX_WIDTH);
  });

  it("lets a grid run wider than text, but not to the bezel", () => {
    expect(contentMaxWidth(IPAD_11_PORTRAIT, "grid")).toBeUndefined();
    expect(contentMaxWidth(IPAD_PRO_LANDSCAPE, "grid")).toBe(GRID_MAX_WIDTH);
  });

  it("never caps what asked for the whole screen", () => {
    expect(contentMaxWidth(IPAD_PRO_LANDSCAPE, "full")).toBeUndefined();
  });
});

describe("gridColumns", () => {
  it("keeps one column of coupon cards on a phone", () => {
    expect(gridColumns(IPHONE_15 - 32, { min: 300 })).toBe(1);
    expect(gridColumns(IPHONE_SE - 32, { min: 300 })).toBe(1);
  });

  it("gives an iPad two columns in portrait and three in landscape", () => {
    expect(gridColumns(IPAD_11_PORTRAIT - 56, { min: 300 })).toBe(2);
    expect(gridColumns(GRID_MAX_WIDTH, { min: 300 })).toBe(3);
  });

  it("honours the ceiling the caller sets", () => {
    expect(gridColumns(GRID_MAX_WIDTH, { min: 200, max: 2 })).toBe(2);
  });

  it("never returns zero or a fraction for a nonsense width", () => {
    expect(gridColumns(0, { min: 300 })).toBe(1);
    expect(gridColumns(-40, { min: 300 })).toBe(1);
    expect(gridColumns(Number.NaN, { min: 300 })).toBe(1);
  });

  it("agrees with columnWidth: the columns and gaps add back up", () => {
    const available = 900;
    const gap = 14;
    const columns = gridColumns(available, { min: 260, gap });
    const width = columnWidth(available, columns, gap);
    expect(width * columns + gap * (columns - 1)).toBeCloseTo(available);
  });
});

describe("navMode", () => {
  it("keeps the bar at the bottom of a phone", () => {
    expect(navMode(IPHONE_15)).toBe("bottom");
    expect(navWidth(IPHONE_15)).toBe(0);
  });

  it("stands the navigation up as a rail on an iPad, and spells it out when there is room", () => {
    expect(navMode(IPAD_11_PORTRAIT)).toBe("rail");
    expect(navMode(IPAD_11_LANDSCAPE)).toBe("sidebar");
    expect(navWidth(IPAD_11_LANDSCAPE)).toBeGreaterThan(navWidth(IPAD_11_PORTRAIT));
  });
});

describe("the duo layout", () => {
  it("does not split a phone, or an iPad in portrait that has no room for both", () => {
    expect(canSplitPanes(IPHONE_MAX)).toBe(false);
    expect(canSplitPanes(IPAD_11_PORTRAIT - navWidth(IPAD_11_PORTRAIT))).toBe(false);
    expect(listPaneWidth(IPHONE_MAX)).toBe(IPHONE_MAX);
  });

  it("splits once list and detail can both be themselves", () => {
    const landscapeContent = IPAD_11_LANDSCAPE - navWidth(IPAD_11_LANDSCAPE);
    expect(canSplitPanes(landscapeContent)).toBe(true);
    const pane = listPaneWidth(landscapeContent);
    expect(pane).toBeGreaterThanOrEqual(380);
    expect(landscapeContent - pane).toBeGreaterThanOrEqual(460);
  });

  it("stops the list pane growing without bound on the widest iPad", () => {
    expect(listPaneWidth(IPAD_PRO_LANDSCAPE)).toBeLessThanOrEqual(460);
  });

  it("leaves the list pane measuring as a phone, because that is what it is", () => {
    // The point of `LayoutWidth`: inside the pane, everything asks the pane.
    // A list column that kept reading the iPad's width would pair up cards
    // into a 460pt column and give each one 222pt, which is narrower than the
    // card works at.
    for (const window of [IPAD_11_LANDSCAPE, IPAD_PRO_LANDSCAPE]) {
      const pane = listPaneWidth(window - navWidth(window));
      expect(layoutClass(pane)).toBe("compact");
      expect(isTabletWidth(pane)).toBe(false);
      expect(gridColumns(pane - 2 * contentGutter(pane), { min: 320, max: 3 })).toBe(1);
    }
  });

  it("never splits into a detail pane narrower than the split promised", () => {
    // The threshold has to count the gap between the columns, or the split
    // fires at a width where the detail then lands below its own minimum.
    for (let width = 700; width <= 1400; width += 1) {
      if (!canSplitPanes(width)) continue;
      expect(detailPaneWidth(width)).toBeGreaterThanOrEqual(DUO_DETAIL_MIN_WIDTH);
    }
  });
});

describe("scaleFont", () => {
  it("leaves phone type alone", () => {
    expect(scaleFont(17, IPHONE_15)).toBe(17);
  });

  it("lifts type a step on an iPad, landing on a half point", () => {
    expect(scaleFont(17, IPAD_11_PORTRAIT)).toBe(18);
    expect(scaleFont(17, IPAD_11_LANDSCAPE)).toBe(19);
    expect(scaleFont(13, IPAD_11_LANDSCAPE) % 0.5).toBe(0);
  });
});

describe("the columns the app actually asks for", () => {
  /** Content width a screen gets: the window, less the rail, less its gutters. */
  const inner = (width: number) =>
    Math.min(width - navWidth(width), GRID_MAX_WIDTH) - 2 * contentGutter(width);

  it("keeps one coupon card per row on every iPhone", () => {
    for (const width of [IPHONE_SE, IPHONE_15, IPHONE_MAX, SLIDE_OVER, SPLIT_HALF]) {
      expect(gridColumns(inner(width), { min: 280 })).toBe(1);
    }
  });

  it("still takes a second column in a wide Split View, where the cards fit", () => {
    // The chrome is phone-shaped at this width; the grid answers to the cards,
    // not to the chrome, and 662pt holds two of them comfortably.
    const available = inner(SPLIT_TWO_THIRDS);
    expect(gridColumns(available, { min: 280 })).toBe(2);
    expect(columnWidth(available, 2)).toBeGreaterThan(280);
  });

  it("gets a second coupon column on an iPad in portrait — the mini included", () => {
    expect(gridColumns(inner(IPAD_MINI_PORTRAIT), { min: 280 })).toBe(2);
    expect(gridColumns(inner(IPAD_11_PORTRAIT), { min: 280 })).toBe(2);
  });

  it("gets a third in landscape, and stops there", () => {
    expect(gridColumns(inner(IPAD_11_LANDSCAPE), { min: 280 })).toBe(3);
    expect(gridColumns(inner(IPAD_PRO_LANDSCAPE), { min: 280 })).toBe(3);
  });

  it("never hands a card less than the width it was promised", () => {
    for (const width of [IPAD_MINI_PORTRAIT, IPAD_11_PORTRAIT, IPAD_11_LANDSCAPE, IPAD_PRO_LANDSCAPE]) {
      const available = inner(width);
      expect(
        columnWidth(available, gridColumns(available, { min: 280 })),
      ).toBeGreaterThanOrEqual(280);
    }
  });

  it("puts all four statistics figures in one row on an iPad, two on a phone", () => {
    expect(gridColumns(inner(IPHONE_SE), { min: 130, max: 4, gap: 10 })).toBe(2);
    expect(gridColumns(inner(IPAD_MINI_PORTRAIT), { min: 130, max: 4, gap: 10 })).toBe(4);
  });
});
