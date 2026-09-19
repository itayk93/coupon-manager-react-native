import { useResponsive } from "@/hooks/useResponsive";

/**
 * Width actually available to app content. On desktop web the UI lives inside a
 * fixed phone-width frame, so responsive breakpoints must measure that frame and
 * not the browser window. Everywhere else this is just the window width.
 *
 * `useResponsive` works the same width out and adds the layout class, gutters
 * and column counts with it; this stays for callers that only want the number.
 */
export function useContentWidth(): number {
  return useResponsive().width;
}
