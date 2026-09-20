import React, { createContext, useContext, useMemo } from "react";
import { Platform, useWindowDimensions } from "react-native";
import type { ViewStyle } from "react-native";
import { DESKTOP_FRAME_WIDTH, DESKTOP_WEB_MIN_WIDTH } from "@/lib/theme";
import {
  ContentKind,
  GRID_MAX_WIDTH,
  LayoutClass,
  NavMode,
  canSplitPanes,
  columnWidth,
  contentGutter,
  contentMaxWidth,
  gridColumns,
  layoutClass,
  listPaneWidth,
  navMode,
  navWidth,
  scaleFont,
} from "@/lib/responsive";

/**
 * Width a subtree should measure itself against, when it is not the window.
 *
 * A pane in a duo layout is 460pt wide on a 1194pt iPad; everything inside it
 * has to answer to the pane, or it will lay itself out for a screen it does
 * not have.
 */
const LayoutWidthContext = createContext<number | null>(null);

export function LayoutWidth({ width, children }: { width: number; children: React.ReactNode }) {
  return <LayoutWidthContext.Provider value={width}>{children}</LayoutWidthContext.Provider>;
}

export type Responsive = {
  /** Width the app actually has, which on desktop web is the phone frame. */
  width: number;
  height: number;
  isLandscape: boolean;
  layout: LayoutClass;
  /** iPad-sized and up. False for an iPad in a narrow Split View. */
  isTablet: boolean;
  isCompact: boolean;
  isExpanded: boolean;
  gutter: number;
  navMode: NavMode;
  navWidth: number;
  /** Width left for content once the navigation rail has taken its side. */
  contentWidth: number;
  /** Width inside the centred content column, gutters and cap taken off. */
  innerWidth: number;
  canSplit: boolean;
  /** Columns that fit a card of at least `min` points, capped at `max`. */
  columns: (min: number, max?: number, gap?: number) => number;
  columnWidth: (columns: number, gap?: number) => number;
  /** Phone font size, nudged up a step per layout class. */
  font: (size: number) => number;
};

/**
 * Everything a screen needs to know about the space it has been given.
 *
 * Screens ask this rather than comparing widths themselves, so an iPad mini and
 * a Split View column are classified in one place instead of in forty.
 */
export function useResponsive(): Responsive {
  const { width: windowWidth, height } = useWindowDimensions();
  const paneWidth = useContext(LayoutWidthContext);
  // Desktop web renders inside a fixed phone-width frame, so the browser window
  // is the wrong thing to measure — it would pick the iPad layout and overflow
  // the frame. See `useContentWidth`.
  const isDesktopWeb = Platform.OS === "web" && windowWidth > DESKTOP_WEB_MIN_WIDTH;
  const width = paneWidth ?? (isDesktopWeb ? DESKTOP_FRAME_WIDTH : windowWidth);

  return useMemo(() => {
    const layout = layoutClass(width);
    // A pane never carries the navigation; the window it sits in does.
    const nav = paneWidth === null ? navWidth(width) : 0;
    const contentWidth = width - nav;
    const gutter = contentGutter(width);
    // What a grid on this screen actually gets: the column is centred and
    // capped, so counting columns against the full width would promise one
    // more than fits.
    const innerWidth = Math.min(contentWidth, GRID_MAX_WIDTH) - 2 * gutter;
    return {
      width,
      height,
      isLandscape: windowWidth > height,
      layout,
      isTablet: layout !== "compact",
      isCompact: layout === "compact",
      isExpanded: layout === "expanded",
      gutter,
      navMode: navMode(width),
      navWidth: nav,
      contentWidth,
      innerWidth,
      canSplit: canSplitPanes(contentWidth),
      columns: (min, max, gap) => gridColumns(innerWidth, { min, max, gap }),
      columnWidth: (columns, gap) => columnWidth(innerWidth, columns, gap),
      font: (size) => scaleFont(size, width),
    };
  }, [width, windowWidth, height, paneWidth]);
}

/**
 * Style for the one content column on a screen: full width on a phone, a
 * centered column with wider margins on an iPad.
 *
 * Spread it *after* the screen's own padding style so it wins the gutter, e.g.
 * `contentContainerStyle={[styles.scrollContent, useContentStyle()]}`.
 */
export function useContentStyle(kind: ContentKind = "grid"): ViewStyle {
  const { width, gutter, isCompact } = useResponsive();
  return useMemo(() => {
    const maxWidth = contentMaxWidth(width, kind);
    return {
      width: "100%",
      alignSelf: "center",
      // A phone keeps the margin the screen already had — screens differ, and
      // the point of this is the iPad, not a global re-spacing of the app.
      ...(isCompact ? null : { paddingHorizontal: gutter }),
      ...(maxWidth ? { maxWidth } : null),
    };
  }, [width, gutter, isCompact, kind]);
}

/**
 * Keeps one wide control — a bottom action bar, a submit button, a lone card —
 * from stretching across an iPad. Empty on a phone, where the control already
 * fits the hand.
 */
export function useCappedWidth(max = 480): ViewStyle {
  const { isTablet } = useResponsive();
  return useMemo(
    () => (isTablet ? { width: "100%", maxWidth: max, alignSelf: "center" } : {}),
    [isTablet, max],
  );
}

/** The split ratio for a duo (list + detail) screen, in points. */
export function useDuoPanes(): { split: boolean; listWidth: number } {
  const { contentWidth, canSplit } = useResponsive();
  return useMemo(
    () => ({ split: canSplit, listWidth: listPaneWidth(contentWidth) }),
    [contentWidth, canSplit],
  );
}
