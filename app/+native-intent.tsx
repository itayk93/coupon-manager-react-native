/**
 * The iOS share extension opens `couponmaster://shared-import` purely to bring
 * the app to the foreground — the screenshot itself is picked up by
 * `SharedScreenshotUsage`, which polls the App Group container on `active`.
 * There is no `/shared-import` route, so rewrite it to the home tab and let the
 * poll open the approval sheet.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes("shared-import")) return "/(tabs)";
    return path;
  } catch {
    return "/(tabs)";
  }
}
