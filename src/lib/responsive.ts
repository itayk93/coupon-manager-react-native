/**
 * One source of truth for how the app lays itself out across iPhone and iPad.
 *
 * The app was drawn for a phone: one column, 16pt gutters, a bar along the
 * bottom. On an iPad that same sheet is not "a bigger phone" — it is a 1180pt
 * line of Hebrew text, a coupon card stretched to the width of a laptop, and a
 * tab bar the thumb cannot reach. So width alone decides the layout here, not
 * the device: an iPad in a narrow Split View is a phone as far as these
 * functions are concerned, and it goes back to being an iPad when the user
 * drags the divider.
 *
 * Everything below is pure arithmetic on a width, so it is unit-tested rather
 * than eyeballed on a simulator.
 */

export type LayoutClass = "compact" | "medium" | "expanded";

/**
 * Widths in points where the layout changes shape.
 *
 * `medium` sits at 700 rather than 768 so an iPad mini in portrait (744pt) is
 * treated as a tablet, while the 2/3 Split View column on an 11" iPad (~694pt)
 * stays on the phone layout — at that width two columns of coupon cards are
 * narrower than one card wants to be.
 */
export const LAYOUT_BREAKPOINTS = {
  medium: 700,
  expanded: 1024,
} as const;

export function layoutClass(width: number): LayoutClass {
  if (width >= LAYOUT_BREAKPOINTS.expanded) return "expanded";
  if (width >= LAYOUT_BREAKPOINTS.medium) return "medium";
  return "compact";
}

/** True for anything wider than a phone: iPad portrait and up. */
export function isTabletWidth(width: number): boolean {
  return layoutClass(width) !== "compact";
}

/**
 * Space between the content and the edge of the screen.
 *
 * It grows with the class rather than with every pixel: a card that slides a
 * little further from the bezel on every rotation reads as a bug, one that
 * steps once at a breakpoint reads as a design.
 */
export const CONTENT_GUTTER: Record<LayoutClass, number> = {
  compact: 16,
  medium: 28,
  expanded: 40,
};

export function contentGutter(width: number): number {
  return CONTENT_GUTTER[layoutClass(width)];
}

/**
 * How wide the content column is allowed to grow.
 *
 * `reading` is for anything that is read line by line — forms, legal text, a
 * settings list. Past roughly 640pt the eye loses the start of the next line,
 * which in Hebrew means losing the right edge.
 *
 * `grid` is for surfaces that fill their width with cards. It stops short of
 * the full iPad so the layout stays a page rather than a wall.
 *
 * `full` opts out: maps, the camera, anything that wants every pixel.
 */
export const READING_MAX_WIDTH = 640;
export const GRID_MAX_WIDTH = 1120;

export type ContentKind = "reading" | "grid" | "full";

export function contentMaxWidth(width: number, kind: ContentKind = "grid"): number | undefined {
  if (kind === "full") return undefined;
  const cap = kind === "reading" ? READING_MAX_WIDTH : GRID_MAX_WIDTH;
  // Below the cap there is nothing to cap: leaving it undefined keeps the
  // phone layout byte-for-byte what it was.
  return width - 2 * contentGutter(width) > cap ? cap : undefined;
}

/**
 * Number of columns that fit, given how narrow a card is allowed to get.
 *
 * Callers pass the width the card was drawn at, not a column count, so the
 * answer stays right on a screen size nobody has tested — including the
 * in-between widths Split View hands out.
 */
export function gridColumns(
  availableWidth: number,
  { min, max = 3, gap = 14 }: { min: number; max?: number; gap?: number },
): number {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return 1;
  // Solve n * min + (n - 1) * gap <= available for n.
  const fits = Math.floor((availableWidth + gap) / (min + gap));
  return Math.min(Math.max(fits, 1), max);
}

/** Width of one column in an `n`-column grid, gaps taken out first. */
export function columnWidth(availableWidth: number, columns: number, gap = 14): number {
  if (columns <= 1) return availableWidth;
  return (availableWidth - gap * (columns - 1)) / columns;
}

/**
 * Where the primary navigation lives.
 *
 * A bar across the bottom of a 1024pt iPad puts six targets under one thumb at
 * the far edge of the screen. On a tablet the same six move to a rail down the
 * side the reading starts from, which is also where iPadOS puts a sidebar.
 */
export type NavMode = "bottom" | "rail" | "sidebar";

export function navMode(width: number): NavMode {
  switch (layoutClass(width)) {
    case "expanded":
      return "sidebar";
    case "medium":
      return "rail";
    default:
      return "bottom";
  }
}

/** Icon-over-label rail; the sidebar spells the labels out beside the icon. */
export const NAV_RAIL_WIDTH = 92;
export const NAV_SIDEBAR_WIDTH = 232;

export function navWidth(width: number): number {
  const mode = navMode(width);
  if (mode === "sidebar") return NAV_SIDEBAR_WIDTH;
  if (mode === "rail") return NAV_RAIL_WIDTH;
  return 0;
}

/**
 * The duo layout: a list and the thing it opens, side by side.
 *
 * Only once the two panes can both be themselves — a list column that still
 * shows a full coupon row, and a detail pane wide enough for the barcode — is
 * the split worth it. Below that the detail is pushed over the list as it is
 * on a phone.
 */
export const DUO_LIST_WIDTH = 380;
export const DUO_DETAIL_MIN_WIDTH = 460;
/**
 * Space the screen leaves between the two panes.
 *
 * Counted here rather than only in the screen, because a threshold that
 * ignores it promises a detail pane the layout then cannot deliver: at exactly
 * 840pt the split would fire and the detail would land at 444, below the very
 * minimum that justified splitting.
 */
export const DUO_GAP = 16;

export function canSplitPanes(width: number): boolean {
  return width >= DUO_LIST_WIDTH + DUO_GAP + DUO_DETAIL_MIN_WIDTH;
}

/** What is left for the detail pane once the list and the gap have taken theirs. */
export function detailPaneWidth(width: number): number {
  return width - listPaneWidth(width) - DUO_GAP;
}

/**
 * Width of the list pane in a duo layout: fixed at its natural width until the
 * screen is wide enough that a fixed column starts to look pinned, then a
 * third of what there is.
 */
export function listPaneWidth(width: number): number {
  if (!canSplitPanes(width)) return width;
  return Math.min(Math.max(DUO_LIST_WIDTH, width * 0.32), 460);
}

/**
 * Type scales up a little on a tablet — but only a little. The phone sizes are
 * the design; this keeps a 17pt heading from looking like a caption when it is
 * read from an iPad's arm's length.
 */
export function typeScale(width: number): number {
  switch (layoutClass(width)) {
    case "expanded":
      return 1.12;
    case "medium":
      return 1.06;
    default:
      return 1;
  }
}

/** Rounds to a half point so scaled type still lands on a crisp baseline. */
export function scaleFont(size: number, width: number): number {
  return Math.round(size * typeScale(width) * 2) / 2;
}
