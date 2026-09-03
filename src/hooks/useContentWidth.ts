import { Platform, useWindowDimensions } from "react-native";
import { DESKTOP_FRAME_WIDTH, DESKTOP_WEB_MIN_WIDTH } from "@/lib/theme";

/**
 * Width actually available to app content. On desktop web the UI lives inside a
 * fixed phone-width frame, so responsive breakpoints must measure that frame and
 * not the browser window. Everywhere else this is just the window width.
 */
export function useContentWidth(): number {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width > DESKTOP_WEB_MIN_WIDTH;
  return isDesktopWeb ? DESKTOP_FRAME_WIDTH : width;
}
